package engine

import (
	"context"
	"errors"
	"sync"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// ErrFrozen is what a write meets while its bucket is being moved (spec §8.8
// steps 3 and 5): SDKs retry it.
var ErrFrozen = apierr.New("SlowDown", "The bucket is being moved. Please retry.").WithHeader("Retry-After", "1")

// FrozenCause turns the cancellation of a write whose bucket was frozen into
// ErrFrozen; any other error is returned as it is.
func FrozenCause(ctx context.Context, err error) error {
	if err != nil && errors.Is(err, context.Canceled) && errors.Is(context.Cause(ctx), ErrFrozen) {
		return ErrFrozen
	}
	return err
}

type gateMode int

const (
	gateOpen gateMode = iota
	gateFrozen
	gatePaused
)

// Gate freezes buckets for a move (spec §8.8). While a bucket is frozen no write
// to it is admitted (reads continue); while it is paused nothing is. Freezing
// also ends the writes that have not reached their commit transaction, and waits
// for the commits that are running, so that when Freeze returns every write that
// was acknowledged is durable and no other will be.
//
// A write is admitted with Begin, which tags its context with the bucket (the
// meta write gate then sees it, wherever in the engine it commits) and registers
// it for cancellation. Writes that carry no such context (lifecycle, janitor,
// pipeline workers) are not stopped: after a move whatever they changed on the
// old home is done again by the new one.
type Gate struct {
	db   *meta.DB
	mu   sync.Mutex
	cond *sync.Cond
	by   map[string]*gateBucket
}

type gateBucket struct {
	mode    gateMode
	running int // write functions of this bucket inside the committer right now
	next    uint64
	cancels map[uint64]context.CancelCauseFunc
}

// newGate installs a gate on db's committer.
func newGate(db *meta.DB) *Gate {
	g := &Gate{db: db, by: map[string]*gateBucket{}}
	g.cond = sync.NewCond(&g.mu)
	db.SetWriteGate(g.enter)
	return g
}

func (g *Gate) bucket(name string) *gateBucket {
	b := g.by[name]
	if b == nil {
		b = &gateBucket{cancels: map[uint64]context.CancelCauseFunc{}}
		g.by[name] = b
	}
	return b
}

// forget drops the entry of a bucket nothing is going on in. Call with g.mu held.
func (g *Gate) forget(name string, b *gateBucket) {
	if b.mode == gateOpen && b.running == 0 && len(b.cancels) == 0 {
		delete(g.by, name)
	}
}

// Begin admits a request for a bucket: a write is refused while the bucket is
// frozen or paused, a read while it is paused. For a write the returned context
// is tagged with the bucket and ends, with cause ErrFrozen, when the bucket is
// frozen before the write has committed; the returned func releases it.
func (g *Gate) Begin(ctx context.Context, bucket string, write bool) (context.Context, func(), error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	b := g.by[bucket]
	if b != nil && (b.mode == gatePaused || write && b.mode == gateFrozen) {
		return ctx, func() {}, ErrFrozen
	}
	if !write {
		return ctx, func() {}, nil
	}
	b = g.bucket(bucket)
	ctx, cancel := context.WithCancelCause(meta.WithBucket(ctx, bucket))
	id := b.next
	b.next++
	b.cancels[id] = cancel
	return ctx, func() {
		g.mu.Lock()
		delete(b.cancels, id)
		g.forget(bucket, b)
		g.mu.Unlock()
		cancel(nil)
	}, nil
}

// enter is the meta write gate: the committer asks it before it runs a write of
// a bucket, and calls the returned func when the function has run.
func (g *Gate) enter(_ context.Context, bucket string) (func(), error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	b := g.by[bucket]
	if b != nil && b.mode != gateOpen {
		return nil, ErrFrozen
	}
	b = g.bucket(bucket)
	b.running++
	return func() {
		g.mu.Lock()
		b.running--
		if b.running == 0 {
			g.cond.Broadcast()
		}
		g.forget(bucket, b)
		g.mu.Unlock()
	}, nil
}

// Freeze stops writes to the bucket (spec §8.8 step 3). It returns once the
// writes that were still on their way have been ended with ErrFrozen and the
// commits that were running are durable. On error the bucket may still be frozen:
// Thaw it.
func (g *Gate) Freeze(ctx context.Context, bucket string) error {
	g.mu.Lock()
	b := g.bucket(bucket)
	if b.mode == gateOpen {
		b.mode = gateFrozen
	}
	for _, cancel := range b.cancels {
		cancel(ErrFrozen)
	}
	stop := context.AfterFunc(ctx, func() {
		g.mu.Lock()
		g.cond.Broadcast()
		g.mu.Unlock()
	})
	defer stop()
	for b.running > 0 {
		if err := ctx.Err(); err != nil {
			g.mu.Unlock()
			return err
		}
		g.cond.Wait()
	}
	g.mu.Unlock()
	// the committer works through its queue in order: once this empty write has
	// committed, so has everything that was in front of it
	return g.db.Update(ctx, func(*meta.Tx) error { return nil })
}

// Pause refuses reads as well (spec §8.8 step 5). The bucket should be frozen first.
func (g *Gate) Pause(bucket string) {
	g.mu.Lock()
	g.bucket(bucket).mode = gatePaused
	g.mu.Unlock()
}

// Thaw lets requests for the bucket through again.
func (g *Gate) Thaw(bucket string) {
	g.mu.Lock()
	if b := g.by[bucket]; b != nil {
		b.mode = gateOpen
		g.forget(bucket, b)
	}
	g.mu.Unlock()
}

// Frozen reports whether writes to the bucket are refused.
func (g *Gate) Frozen(bucket string) bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	b := g.by[bucket]
	return b != nil && b.mode != gateOpen
}

// Paused reports whether reads of the bucket are refused too.
func (g *Gate) Paused(bucket string) bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	b := g.by[bucket]
	return b != nil && b.mode == gatePaused
}
