// Package mover moves a bucket from its home node to another one, online (spec
// §8.8), and empties a node by moving its buckets away one after another (§6.9
// drain).
//
// The two nodes of a move play two roles. The old home, the source, runs the
// procedure (out.go, copy.go): prepare, copy the blobs while the bucket keeps
// serving, freeze, send the last blobs and all the rows, cut over, clean up. The
// new home, the target, answers its calls (in.go): it receives the blobs, imports
// the rows, and takes the one decision of the move — to activate or to refuse.
// Both keep their decisions in the moves table (meta.Move), so a crash forgets
// nothing; the bucket's local epoch (meta.Bucket.Epoch) is what makes a node
// serve a bucket or not.
//
// A node takes part in one move at a time: the slot is held by the move the node
// is executing as source and by the move it is receiving as target; every other
// move waits (as `queued` at the source, as `busy` at the target).
package mover

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math/rand/v2"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/obs"
	"github.com/kalevski/toolcase/binvault/internal/seal"
	"github.com/kalevski/toolcase/binvault/internal/store"
	"github.com/kalevski/toolcase/binvault/internal/ulid"
)

// Pipelines is what the mover needs from the pipeline manager (spec §8.8): the
// freeze of a bucket's runs and walks, and what each side does when the bucket
// has gone or has come.
type Pipelines interface {
	// FreezeBucket stops everything the bucket's pipelines do (step 3 on the
	// source; on the target while the rows are imported); ThawBucket undoes it.
	FreezeBucket(ctx context.Context, bucket string) error
	ThawBucket(bucket string)
	// BucketMoved is the source's: forget what is cached of the bucket (it stays
	// frozen). BucketLeaving runs in the transaction that removes the bucket's rows
	// from the source. ForgetBucket drops the freeze of a bucket whose rows are gone.
	BucketMoved(bucket string)
	BucketLeaving(ctx context.Context, tx *meta.Tx, bucket string) error
	ForgetBucket(bucket string)
	// BucketArrived is the target's, on activation: start the walks of the running
	// backfills, thaw, wake the scheduler.
	BucketArrived(ctx context.Context, bucket string) error
	// BucketImported is the target's, inside the transaction that imports the bucket's
	// rows: the attachments that came with them are made to agree with the catalog's
	// pipelines (one made for another generation of a pipeline, or for one that was
	// deleted, goes with its queued runs and backfills). missing names a pipeline the
	// catalog of this node does not hold yet: the import must not go on.
	BucketImported(ctx context.Context, tx *meta.Tx, bucket string) (missing string, err error)
}

// Options configure New.
type Options struct {
	Cfg   *config.Config
	DB    *meta.DB
	Store *store.Store
	Node  *cluster.Node
	// Gate freezes and pauses the bucket on the source (engine.Gate).
	Gate  *engine.Gate
	Ring  *seal.Keyring
	Pipes Pipelines
	Log   *slog.Logger
	// Registry receives the move metrics (§9.2); nil keeps them private.
	Registry *obs.Registry
	// Ready reports whether the node has finished its start-up (nil: always).
	Ready func() bool
	// FreeDisk reports the free bytes of the data volume (nil: the store's).
	FreeDisk func() int64
	// BucketGone is called when the rows of a bucket have left this node (a move's
	// cleanup): the caller drops the caches that name the bucket (tokens, limiters).
	BucketGone func(name string)
	Tuning     Tuning
}

// Tuning holds the timers and thresholds that the spec leaves to the
// implementation, so that tests can shrink them. A zero field takes its default.
type Tuning struct {
	// RequeueDelay is how long a move waits before it asks a busy target again (2s,
	// plus up to as much again at random, so that two nodes that ask each other at
	// once do not keep colliding).
	RequeueDelay time.Duration
	// ActivateTimeout bounds one activate call (30s); ActivateBackoff and
	// ActivateBackoffMax are the first and the longest pause between two calls that
	// got no answer (1s, 15s).
	ActivateTimeout    time.Duration
	ActivateBackoff    time.Duration
	ActivateBackoffMax time.Duration
	// ControlTimeout bounds the small calls: prepare, discard (30s).
	ControlTimeout time.Duration
	// SmallPassBytes and SmallPassBlobs say when an online blob pass is small
	// enough to freeze (64 MiB, 1000 blobs).
	SmallPassBytes int64
	SmallPassBlobs int
	// MaxPasses is the most online blob passes before the freeze (5).
	MaxPasses int
	// IdleTimeout is how long the target waits for a call of a move that has not
	// been activated before it gives the copy up (5m, plus twice the source's freeze
	// timeout).
	IdleTimeout time.Duration
	// Margin is the free space the target keeps beyond a bucket's bytes (64 MiB, or
	// BINVAULT_MIN_FREE_MB when that is more).
	Margin int64
	// DrainPoll is how often the drain controller looks for buckets to move (5s).
	DrainPoll time.Duration
	// CleanupChunk is how many rows the old home removes in one transaction when it
	// cleans up after a move (10000): a bucket with millions of versions is removed
	// in pieces, so that the node's writer is never held for long.
	CleanupChunk int
	// CrashPoint is a test seam: it is asked at named points of the source's procedure
	// ("ok": the target answered OK, nothing recorded yet; "moved": the move is
	// recorded, the catalog is not; "handoff": the catalog says it, the cleanup is
	// still to do; on the target, "activated": the decision is durable, nothing else
	// is) and a true makes the move stop there and hang, as a process that was
	// killed at that instant would, until the node is shut down.
	CrashPoint func(point string) bool
}

func (t Tuning) withDefaults() Tuning {
	dur := func(p *time.Duration, v time.Duration) {
		if *p <= 0 {
			*p = v
		}
	}
	dur(&t.RequeueDelay, 2*time.Second)
	dur(&t.ActivateTimeout, 30*time.Second)
	dur(&t.ActivateBackoff, time.Second)
	dur(&t.ActivateBackoffMax, 15*time.Second)
	dur(&t.ControlTimeout, 30*time.Second)
	dur(&t.IdleTimeout, 5*time.Minute)
	dur(&t.DrainPoll, 5*time.Second)
	if t.SmallPassBytes <= 0 {
		t.SmallPassBytes = 64 << 20
	}
	if t.SmallPassBlobs <= 0 {
		t.SmallPassBlobs = 1000
	}
	if t.MaxPasses <= 0 {
		t.MaxPasses = 5
	}
	if t.Margin <= 0 {
		t.Margin = 64 << 20
	}
	if t.CleanupChunk <= 0 {
		t.CleanupChunk = 10_000
	}
	return t
}

// Mover is the move machinery of one cluster node.
type Mover struct {
	o    Options
	log  *slog.Logger
	cfg  *config.Config
	tune Tuning
	now  func() time.Time

	// slot is held by the move this node takes part in (cap 1).
	slot chan struct{}

	mu   sync.Mutex
	outs map[string]*outMove // moves this node is executing as source
	ins  map[string]*inMove  // moves this node is receiving as target
	// retryAt holds queued moves back until their target had time to finish what it
	// was doing.
	retryAt map[string]time.Time
	// bytesCache remembers what a bucket takes on disk (bucketBytes).
	bytesCache map[string]cachedBytes
	// owned names the buckets whose local copy belongs to a move: one this node is
	// receiving, or one it has handed over and is about to remove (bucket -> move id).
	owned map[string]string
	// discards are the moves that ended at start-up and whose targets are told to drop
	// their copies, best effort.
	discards []meta.Move

	wake  chan struct{}
	drain chan struct{}
	// drainWarned throttles the drain's "nothing can take it" warning (drain goroutine only).
	drainWarned map[string]time.Time

	started atomic.Bool
	ctx     context.Context
	cancel  context.CancelFunc
	wg      sync.WaitGroup

	// stream carries the blobs, parts and rows: no overall timeout (a transfer is
	// bounded by its idleness, and the move by the freeze timeout).
	stream *http.Client

	met metrics
}

type metrics struct {
	moves    *obs.CounterVec
	bytes    *obs.CounterVec
	freeze   *obs.HistogramVec
	active   atomic.Int64
	passes   *obs.CounterVec
	refusals *obs.CounterVec
}

// New builds the mover. It starts nothing: call Recover before the node serves
// buckets and Start afterwards.
func New(o Options) (*Mover, error) {
	switch {
	case o.Cfg == nil || o.DB == nil || o.Store == nil || o.Node == nil || o.Gate == nil || o.Pipes == nil:
		return nil, errors.New("mover: Cfg, DB, Store, Node, Gate and Pipes are required")
	}
	if o.Log == nil {
		o.Log = slog.Default()
	}
	if o.Registry == nil {
		o.Registry = obs.NewRegistry()
	}
	if o.FreeDisk == nil {
		st := o.Store
		o.FreeDisk = func() int64 {
			free, err := st.FreeBytes()
			if err != nil {
				return 0
			}
			return int64(free)
		}
	}
	m := &Mover{
		o: o, log: o.Log, cfg: o.Cfg, tune: o.Tuning.withDefaults(), now: time.Now,
		slot: make(chan struct{}, 1), outs: map[string]*outMove{}, ins: map[string]*inMove{},
		retryAt: map[string]time.Time{}, bytesCache: map[string]cachedBytes{}, owned: map[string]string{}, wake: make(chan struct{}, 1), drain: make(chan struct{}, 1),
	}
	if t := o.Tuning.Margin; t <= 0 {
		m.tune.Margin = max(m.tune.Margin, o.Cfg.MinFreeBytes())
	}
	m.stream = &http.Client{Transport: streamTransport(o.Node, o.Cfg)}
	r := o.Registry
	m.met.moves = r.Counter("binvault_moves_total", "Bucket moves this node ran as source, by outcome.", "outcome")
	m.met.bytes = r.Counter("binvault_move_bytes_total", "Blob and part bytes this node sent in bucket moves.")
	m.met.freeze = r.Histogram("binvault_move_freeze_seconds", "How long a bucket's writes were frozen for a move: from the freeze to the end of the cutover (or the lift of the freeze).",
		[]float64{.05, .1, .25, .5, 1, 2.5, 5, 10, 30, 60, 120, 300, 900}, "outcome")
	m.met.passes = r.Counter("binvault_move_passes_total", "Online blob passes of bucket moves.")
	m.met.refusals = r.Counter("binvault_move_refusals_total", "Moves this node refused or abandoned as target, by reason.", "reason")
	r.GaugeFunc("binvault_moves_running", "Moves this node is executing as source or receiving as target.", nil, func() []obs.Sample {
		return []obs.Sample{{Value: float64(m.met.active.Load())}}
	})
	r.GaugeFunc("binvault_cluster_moves", "Move records on this node by state (both roles).", []string{"state"}, m.stateGauge)
	return m, nil
}

// stateGauge is the scrape-time gauge of the move records per state.
func (m *Mover) stateGauge() []obs.Sample {
	counts, err := m.o.DB.Read().CountMoves(context.Background())
	if err != nil {
		return nil
	}
	byState := map[string]int64{}
	for k, n := range counts {
		byState[k[1]] += n
	}
	var out []obs.Sample
	for _, st := range []string{meta.MoveQueued, meta.MovePreparing, meta.MoveCopying, meta.MoveFrozen, meta.MoveCutover, meta.MoveMoved,
		meta.MoveResuming, meta.MoveDone, meta.MoveFailed, meta.MoveCancelled, meta.MoveReceiving, meta.MoveVerified, meta.MoveActivated, meta.MoveAbandoned} {
		out = append(out, obs.Sample{Labels: []string{st}, Value: float64(byState[st])})
	}
	return out
}

// streamTransport derives the transport of the move streams from the cluster's: the
// same TLS and dial settings, no proxy, no compression, and a wait for the
// target's answer to Expect: 100-continue, so that a blob the target already has is
// not sent again.
func streamTransport(n *cluster.Node, cfg *config.Config) http.RoundTripper {
	tr, ok := n.ForwardTransport().(*http.Transport)
	if !ok {
		return n.ForwardTransport()
	}
	tr = tr.Clone()
	tr.Proxy = nil
	tr.DisableCompression = true
	tr.MaxIdleConns = 64
	tr.MaxIdleConnsPerHost = max(8, cfg.MoveStreams*2)
	tr.IdleConnTimeout = 60 * time.Second
	tr.ExpectContinueTimeout = 5 * time.Second
	tr.ResponseHeaderTimeout = 0
	return tr
}

// ---- ids, names ------------------------------------------------------------------------

const idPrefix = "mv_"

func newMoveID() string { return idPrefix + ulid.New() }

func validMoveID(id string) bool {
	if len(id) != len(idPrefix)+ulid.Len || id[:len(idPrefix)] != idPrefix {
		return false
	}
	for _, c := range id[len(idPrefix):] {
		if !(c >= '0' && c <= '9' || c >= 'A' && c <= 'Z' || c >= 'a' && c <= 'z') {
			return false
		}
	}
	return true
}

func (m *Mover) nodeName(id string) string {
	if n := m.o.Node.NodeName(id); n != "" {
		return n
	}
	return id
}

func (m *Mover) selfID() string { return m.o.Node.ID() }

// InMove reports whether the local copy of a bucket belongs to a move: this node is
// receiving it, or has handed it over and is removing it. Such a copy is neither
// served nor an orphan.
func (m *Mover) InMove(bucket string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, ok := m.owned[bucket]
	return ok
}

func (m *Mover) own(bucket, move string) {
	m.mu.Lock()
	m.owned[bucket] = move
	m.mu.Unlock()
}

func (m *Mover) disown(bucket, move string) {
	m.mu.Lock()
	if m.owned[bucket] == move {
		delete(m.owned, bucket)
	}
	m.mu.Unlock()
}

// ---- the slot ------------------------------------------------------------------------------

func (m *Mover) acquire(ctx context.Context) bool {
	select {
	case m.slot <- struct{}{}:
		return true
	case <-ctx.Done():
		return false
	}
}

func (m *Mover) tryAcquire() bool {
	select {
	case m.slot <- struct{}{}:
		return true
	default:
		return false
	}
}

func (m *Mover) release() {
	select {
	case <-m.slot:
	default:
	}
}

// ---- database helpers --------------------------------------------------------------------

// update runs a write that must happen whatever the caller's context says (a
// decision is recorded even when the request that caused it is gone).
func (m *Mover) update(ctx context.Context, fn func(tx *meta.Tx) error) error {
	return m.o.DB.Update(context.WithoutCancel(ctx), fn)
}

func (m *Mover) loadMove(ctx context.Context, id string) (*meta.Move, error) {
	return m.o.DB.Read().GetMove(ctx, id)
}

// ---- lifecycle ---------------------------------------------------------------------------

// Recover applies what a restart means for the moves on disk (spec §8.8, §9.4). It
// runs after the cluster start-up fence and before the node serves any bucket:
//
//   - a source move before the cutover is failed — there is no resume — and its
//     target is told to drop the copy (best effort, once Start has run);
//   - a source move from the cutover on keeps its bucket paused: the node asks its
//     target again, whatever the target decided meanwhile;
//   - a target move that was not activated is abandoned: the partial copy goes;
//   - a target move that was activated stays so (Start sees that the catalog knows).
func (m *Mover) Recover(ctx context.Context) error {
	q := m.o.DB.Read()
	outs, err := q.ListMoves(ctx, meta.MoveFilter{Role: meta.MoveOut, Open: true, Asc: true, Limit: 100000})
	if err != nil {
		return err
	}
	for _, mv := range outs {
		switch mv.State {
		case meta.MoveQueued:
		case meta.MovePreparing, meta.MoveCopying, meta.MoveFrozen:
			const why = "interrupted by a restart of this node"
			err := m.update(ctx, func(tx *meta.Tx) error {
				_, err := tx.MoveTransition(ctx, mv.ID, []string{meta.MovePreparing, meta.MoveCopying, meta.MoveFrozen}, meta.MoveFailed, why)
				return err
			})
			if err != nil {
				return err
			}
			mv.State, mv.Error = meta.MoveFailed, why
			m.discards = append(m.discards, *mv)
			m.log.Warn("move: ended by a restart before the cutover; start it again", "move", mv.ID, "bucket", mv.Bucket)
		default: // cutover, moved, resuming: the bucket stays out of service
			if mv.State != meta.MoveCutover {
				m.own(mv.Bucket, mv.ID)
			}
			m.o.Gate.Pause(mv.Bucket)
			if err := m.o.Pipes.FreezeBucket(ctx, mv.Bucket); err != nil {
				return err
			}
			m.log.Warn("move: resumes after a restart", "move", mv.ID, "bucket", mv.Bucket, "state", mv.State, "to", m.nodeName(mv.Peer))
		}
	}
	ins, err := q.ListMoves(ctx, meta.MoveFilter{Role: meta.MoveIn, Open: true, Asc: true, Limit: 100000})
	if err != nil {
		return err
	}
	for _, mv := range ins {
		m.log.Warn("move: the copy received for a move that was not activated is dropped", "move", mv.ID, "bucket", mv.Bucket)
		if err := m.abandonStored(ctx, mv, "this node restarted before the activation"); err != nil {
			return err
		}
	}
	return nil
}

// Start launches the mover's goroutines: the worker that runs queued moves and
// finishes the ones a restart interrupted, the watchdog of idle incoming moves, the
// drain controller. Call it once, when the node serves.
func (m *Mover) Start(ctx context.Context) {
	if !m.started.CompareAndSwap(false, true) {
		return
	}
	m.ctx, m.cancel = context.WithCancel(ctx)
	for _, f := range []func(){m.worker, m.watchdog, m.drainLoop, m.restartTasks} {
		m.wg.Add(1)
		go func(f func()) { defer m.wg.Done(); f() }(f)
	}
	m.poke()
}

// Close stops the mover's goroutines and the moves they run. A move at or past its
// cutover is left as it is: the next start finishes it.
func (m *Mover) Close() {
	if m.cancel != nil {
		m.cancel()
	}
	m.wg.Wait()
}

func (m *Mover) poke() {
	select {
	case m.wake <- struct{}{}:
	default:
	}
}

// jitter returns d plus up to as much again at random.
// crashAt asks the test seam whether the move stops at a point.
func (mv *outMove) crashAt(point string) bool {
	if mv.m.tune.CrashPoint == nil || !mv.m.tune.CrashPoint(point) {
		return false
	}
	<-mv.ctx.Done()
	return true
}

func jitter(d time.Duration) time.Duration {
	return d + time.Duration(rand.Int64N(int64(d)+1))
}

// closing reports whether the mover is shutting down.
func (m *Mover) closing() bool { return m.ctx != nil && m.ctx.Err() != nil }

// sleep waits for d; false when the mover is closing.
func (m *Mover) sleep(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return true
	case <-ctx.Done():
		return false
	}
}

func errf(format string, a ...any) error { return fmt.Errorf(format, a...) }
