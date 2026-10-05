package pipeline

import (
	"context"
	"errors"
	"sync"
	"time"
)

// errBucketFrozen is the cause the calls of a frozen bucket are cancelled with.
var errBucketFrozen = errors.New("pipeline: the bucket is being moved")

// freezer is what the pipeline manager knows about the buckets being moved
// (spec §8.8): no run of a frozen bucket is started, the calls in flight are
// cancelled and their runs go back to the queue, and the bucket's backfill walks
// do nothing, so that the rows of the bucket stay as they were when they were
// copied.
type freezer struct {
	mu       sync.Mutex
	cond     *sync.Cond
	frozen   map[string]bool
	inflight map[string]map[string]context.CancelCauseFunc // bucket -> run -> cancel; "" run: a walk step
	walkers  map[string]int
}

func newFreezer() *freezer {
	f := &freezer{frozen: map[string]bool{}, inflight: map[string]map[string]context.CancelCauseFunc{}, walkers: map[string]int{}}
	f.cond = sync.NewCond(&f.mu)
	return f
}

// reserve counts a run as in flight unless its bucket is frozen; the returned
// context is the one to execute it under, cancelled with errBucketFrozen when
// the bucket freezes. done must be called when the run has been recorded.
func (f *freezer) reserve(parent context.Context, bucket, run string) (context.Context, func(), bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.frozen[bucket] {
		return nil, nil, false
	}
	ctx, cancel := context.WithCancelCause(parent)
	runs := f.inflight[bucket]
	if runs == nil {
		runs = map[string]context.CancelCauseFunc{}
		f.inflight[bucket] = runs
	}
	runs[run] = cancel
	return ctx, func() {
		f.mu.Lock()
		delete(runs, run)
		if len(runs) == 0 {
			delete(f.inflight, bucket)
		}
		f.cond.Broadcast()
		f.mu.Unlock()
		cancel(nil)
	}, true
}

// enterWalk counts a step of a backfill walk as in flight unless the bucket is
// frozen.
func (f *freezer) enterWalk(bucket string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.frozen[bucket] {
		return false
	}
	f.walkers[bucket]++
	return true
}

func (f *freezer) leaveWalk(bucket string) {
	f.mu.Lock()
	f.walkers[bucket]--
	if f.walkers[bucket] <= 0 {
		delete(f.walkers, bucket)
	}
	f.cond.Broadcast()
	f.mu.Unlock()
}

func (f *freezer) isFrozen(bucket string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.frozen[bucket]
}

func (f *freezer) frozenBuckets() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.frozen) == 0 {
		return nil
	}
	out := make([]string, 0, len(f.frozen))
	for b := range f.frozen {
		out = append(out, b)
	}
	return out
}

// freeze marks the bucket, cancels its calls and waits until they and the walk
// steps in flight have been recorded.
func (f *freezer) freeze(ctx context.Context, bucket string) error {
	f.mu.Lock()
	f.frozen[bucket] = true
	for _, cancel := range f.inflight[bucket] {
		cancel(errBucketFrozen)
	}
	stop := context.AfterFunc(ctx, func() {
		f.mu.Lock()
		f.cond.Broadcast()
		f.mu.Unlock()
	})
	defer stop()
	defer f.mu.Unlock()
	for len(f.inflight[bucket]) > 0 || f.walkers[bucket] > 0 {
		if err := ctx.Err(); err != nil {
			return err
		}
		f.cond.Wait()
	}
	return nil
}

func (f *freezer) thaw(bucket string) {
	f.mu.Lock()
	delete(f.frozen, bucket)
	f.mu.Unlock()
}

// FreezeBucket stops the pipelines of a bucket that is about to move (spec §8.8
// step 3): nothing of it is dispatched, its calls in flight are cancelled and their
// runs go back to queued. It returns once those runs are recorded.
func (m *Manager) FreezeBucket(ctx context.Context, bucket string) error {
	return m.frz.freeze(ctx, bucket)
}

// ThawBucket lets the bucket's pipelines work again (a move that failed).
func (m *Manager) ThawBucket(bucket string) {
	m.frz.thaw(bucket)
	m.notify()
}

// BucketMoved forgets what the node cached of a bucket that has left it; the
// bucket stays frozen here, so nothing of it ever runs on this node again.
func (m *Manager) BucketMoved(bucket string) {
	m.atts.forget(bucket)
	m.bf.forgetBucket(bucket)
}

// BucketArrived starts what a bucket that was moved here needs: the walks of its
// running backfills, and the dispatch of its queued runs.
func (m *Manager) BucketArrived(ctx context.Context, bucket string) error {
	m.atts.forget(bucket)
	m.frz.thaw(bucket)
	list, err := m.db.Read().RunningBackfills(ctx)
	if err != nil {
		return err
	}
	for _, bf := range list {
		if bf.Bucket == bucket {
			m.bf.start(bf)
		}
	}
	m.notify()
	// this node is the home now (the catalog says so before this is called): the entry
	// names the pipelines the bucket is attached to as the source last saw them, and
	// the import may have dropped some; a failure is repaired by the periodic
	// reconciliation
	if err := m.PublishAttachments(ctx, bucket); err != nil {
		m.log.Warn("publishing a moved bucket's attachments failed", "bucket", bucket, "error", err)
	}
	return nil
}

// SetServedBy installs the question a cluster node asks about a bucket (spec
// §8.5): does this node serve it? The queued runs and the backfill walks of a
// bucket it does not serve — an orphan, a bucket that moved away, a node that is
// still starting — are left alone, so that their service is not called for data
// that belongs to nobody here. It must be set before Start.
func (m *Manager) SetServedBy(fn func(bucket string) bool) { m.servedBy = fn }

// unserved reports whether the node must leave the bucket's pipelines alone.
func (m *Manager) unserved(bucket string) bool {
	return m.servedBy != nil && !m.servedBy(bucket)
}

// blockedBuckets lists the buckets whose runs are not dispatched now: those being
// moved and those this node does not serve. The second list is looked up at most
// once a second.
func (m *Manager) blockedBuckets(ctx context.Context) []string {
	out := m.frz.frozenBuckets()
	if m.servedBy == nil {
		return out
	}
	c := &m.unservedCache
	c.mu.Lock()
	defer c.mu.Unlock()
	if time.Since(c.at) >= time.Second {
		var names []string
		ok := true
		for after := ""; ok; {
			bs, err := m.db.Read().ListBuckets(ctx, after, 500)
			if err != nil {
				ok = false // keep what was known
				break
			}
			for _, b := range bs {
				after = b.Name
				if !m.servedBy(b.Name) {
					names = append(names, b.Name)
				}
			}
			if len(bs) < 500 {
				break
			}
		}
		if ok {
			c.names, c.at = names, time.Now()
		}
	}
	return append(out, c.names...)
}

// unservedCache remembers blockedBuckets' second list.
type unservedCache struct {
	mu    sync.Mutex
	at    time.Time
	names []string
}
