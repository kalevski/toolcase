// Package engine implements the object operations of the data plane
// (spec §3.5, §3.10): admission, receiving and staging a body, the versioned
// commit transaction, deletes and permanent deletions, reads and tagging. It is
// protocol-agnostic: the s3 package maps HTTP onto it, and pipelines, lifecycle
// and the cluster mover call the same functions.
package engine

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/seal"
	"github.com/kalevski/toolcase/binvault/internal/store"
	"github.com/kalevski/toolcase/binvault/internal/ulid"
)

// Actor says who caused a change (spec §7.5 `actor`).
type Actor struct {
	Kind string // token | pipeline | anonymous | lifecycle | backfill | admin
	ID   string // access key id, pipeline name, ...
	Name string

	// Causal lineage for pipeline writes (loop protection, spec §7.11).
	RunID string
	Depth int
	Chain []string

	// Guard is the stale-write guard of an after run's token (spec §7.8): the
	// engine checks it, atomically with the change, on every request that names
	// the guarded key. It is never persisted.
	Guard *Guard `json:"-"`
}

// Event is one change to what a plain GET would return (spec §3.10, §7.5).
type Event struct {
	Type      string // object.created | object.updated | object.deleted
	Operation string // put | post | copy | multipart | delete | delete_version | lifecycle | pipeline | backfill
	Bucket    string
	Key       string
	Object    *meta.Object // the new visible object; nil for deleted
	Previous  *meta.Object // the visible object it replaced / removed; nil for created
	Actor     Actor
	// CopySource is set for operation=copy.
	CopySource *CopySource
	At         time.Time

	// Marker is the delete marker a delete raised in a versioned bucket (the
	// event's version, spec §7.6); nil otherwise.
	Marker *meta.Object
	// Sniffed is the content type found in the bytes of the write that raised
	// the event ("" when the write read no bytes: copies, deletes, lifecycle).
	Sniffed string
}

// CopySource names the source of a copy event.
type CopySource struct {
	Key     string
	Version string
}

// Event type names.
const (
	EventCreated = "object.created"
	EventUpdated = "object.updated"
	EventDeleted = "object.deleted"
)

// Hooks are the integration points of the pipeline package; all optional.
type Hooks struct {
	// Outbox runs inside the commit transaction of every change that raised an
	// event (the transactional outbox, spec §3.5 step 6).
	Outbox func(ctx context.Context, tx *meta.Tx, ev *Event) error
	// After runs once the commit is durable (wake the scheduler).
	After func(ev *Event)
	// Seal, Rate and Before are wired by other packages; see their setters.
}

// BeforeDeleteCall describes a delete awaiting its before chain.
type BeforeDeleteCall struct {
	Bucket *meta.Bucket
	Key    string
	Actor  Actor
	// Batch is shared by the entries of one DeleteObjects request, whose
	// chains share one time budget (spec §5.4.4); nil for a single delete.
	Batch *BeforeBatch
}

// Config is the part of the process configuration the engine needs.
type Config struct {
	MaxObjectBytes int64         // BINVAULT_MAX_OBJECT_MB
	MinFreeBytes   int64         // BINVAULT_MIN_FREE_MB
	GCGrace        time.Duration // BINVAULT_GC_GRACE
	Region         string
}

// Engine bundles the stores.
type Engine struct {
	DB    *meta.DB
	Store *store.Store
	Cfg   Config
	Log   *slog.Logger
	Hooks Hooks
	Ring  *seal.Keyring // master keyring: seals bucket data keys (spec §4.7)
	// Before runs the bucket's before chain on a staged write (pipeline package);
	// nil = no pipelines. It may replace the staged object or fail the write.
	Before func(ctx context.Context, c *BeforeCall) (*BeforeOutcome, error)
	// BeforeDelete runs the bucket's before chain for a delete (no version id)
	// and returns the seq of the vetted latest version (0 = nothing to
	// condition on); the delete then applies only if the key is unchanged.
	BeforeDelete func(ctx context.Context, c *BeforeDeleteCall) (seq int64, err error)
	// BeforeMatches reports whether a before chain would run for a write that
	// has not been staged yet (CopyObject): Copy materialises a staged copy of a
	// shared blob only when it says yes. c.Rec is nil; c.CopySrc names the source.
	BeforeMatches func(ctx context.Context, c *BeforeCall) (bool, error)

	// Gate freezes buckets for a move (freeze.go).
	Gate *Gate
	// Skip names the buckets background jobs must leave alone: the data of a bucket
	// this node does not serve (an orphan, spec §8.5) is kept as it is. Nil = none.
	Skip func(bucket string) bool

	ids ulid.Generator
	Now func() time.Time

	upMu sync.Mutex
	ups  map[string]*uploadLock
}

// uploadLock serialises CompleteMultipartUpload calls of one upload (a client
// retry that overlaps the original waits for it and replays its result).
type uploadLock struct {
	mu   sync.Mutex
	refs int
}

// lockUpload takes the per-upload lock; call the returned func to release it.
func (e *Engine) lockUpload(id string) func() {
	e.upMu.Lock()
	if e.ups == nil {
		e.ups = map[string]*uploadLock{}
	}
	l := e.ups[id]
	if l == nil {
		l = &uploadLock{}
		e.ups[id] = l
	}
	l.refs++
	e.upMu.Unlock()
	l.mu.Lock()
	return func() {
		l.mu.Unlock()
		e.upMu.Lock()
		if l.refs--; l.refs == 0 {
			delete(e.ups, id)
		}
		e.upMu.Unlock()
	}
}

// New returns an engine.
func New(db *meta.DB, st *store.Store, ring *seal.Keyring, cfg Config, log *slog.Logger) *Engine {
	if log == nil {
		log = slog.Default()
	}
	if cfg.MaxObjectBytes <= 0 {
		cfg.MaxObjectBytes = 5 << 40
	}
	return &Engine{DB: db, Store: st, Ring: ring, Cfg: cfg, Log: log, Now: time.Now, Gate: newGate(db)}
}

// NewVersionID allocates a version id (spec §3.3).
func (e *Engine) NewVersionID() string { return e.ids.NewAt(e.Now()) }

// Bucket loads a bucket or fails with NoSuchBucket.
func (e *Engine) Bucket(ctx context.Context, name string) (*meta.Bucket, error) {
	b, err := e.DB.Read().GetBucket(ctx, name)
	if err != nil {
		if errors.Is(err, meta.ErrNotFound) {
			return nil, noSuchBucket(name)
		}
		return nil, internal(err)
	}
	return b, nil
}

func noSuchBucket(name string) *apierr.Error {
	return apierr.New("NoSuchBucket", "The specified bucket does not exist.").WithExtra("BucketName", name)
}

func noSuchKey(key string) *apierr.Error {
	return apierr.New("NoSuchKey", "The specified key does not exist.").WithExtra("Key", key)
}

func internal(err error) *apierr.Error {
	if e, ok := apierr.As(err); ok {
		return e
	}
	return apierr.Wrap("InternalError", "We encountered an internal error. Please try again.", err)
}

// wrapErr turns any error into an *apierr.Error, passing S3 errors through.
func wrapErr(err error) error {
	if err == nil {
		return nil
	}
	if _, ok := apierr.As(err); ok {
		return err
	}
	if errors.Is(err, context.Canceled) {
		return err
	}
	return internal(err)
}
