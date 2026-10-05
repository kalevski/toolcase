package pipeline

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// backfiller walks buckets for backfills (spec §6.8): it runs an after
// pipeline over the objects that already exist by raising an object.created
// event, with operation backfill and actor.kind backfill, for every visible
// key that matches. The walk is throttled (at most 2 × max_concurrency of the
// backfill's runs open at a time), its cursor is persisted with each batch of
// runs so a restart resumes it, and objects that change or vanish mid-walk are
// handled by the supersession check every run makes.
type backfiller struct {
	m       *Manager
	mu      sync.Mutex
	active  map[string]context.CancelFunc
	buckets map[string]string // backfill id -> bucket of the walks in active
	stopped bool
	wg      sync.WaitGroup
}

func newBackfiller(m *Manager) *backfiller {
	return &backfiller{m: m, active: map[string]context.CancelFunc{}, buckets: map[string]string{}}
}

// backfillBatch is how many keys one walk step examines.
const backfillBatch = 256

// backfillPoll is how long a throttled walk waits before looking again.
const backfillPoll = 200 * time.Millisecond

// resume restarts the walks that were running at the last shutdown or crash.
func (b *backfiller) resume(ctx context.Context) error {
	list, err := b.m.db.Read().RunningBackfills(ctx)
	if err != nil {
		return err
	}
	for _, bf := range list {
		b.start(bf)
	}
	return nil
}

// start launches the walk of a running backfill.
func (b *backfiller) start(bf *meta.Backfill) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.stopped {
		return
	}
	if _, ok := b.active[bf.ID]; ok {
		return
	}
	ctx, cancel := context.WithCancel(b.m.ctx)
	b.active[bf.ID] = cancel
	b.buckets[bf.ID] = bf.Bucket
	b.wg.Add(1)
	go b.walk(ctx, bf)
}

// cancel stops one walk (the database state is changed by the caller).
func (b *backfiller) cancel(id string) {
	b.mu.Lock()
	cancel := b.active[id]
	b.mu.Unlock()
	if cancel != nil {
		cancel()
	}
}

// stopAll stops every walk; the persisted cursors let the next start resume.
func (b *backfiller) stopAll() {
	b.mu.Lock()
	b.stopped = true
	for _, cancel := range b.active {
		cancel()
	}
	b.mu.Unlock()
}

func (b *backfiller) wait() { b.wg.Wait() }

// forgetBucket ends the walks of a bucket that has left this node; the backfills
// themselves went with its rows.
func (b *backfiller) forgetBucket(bucket string) {
	b.mu.Lock()
	var cancels []context.CancelFunc
	for id, cancel := range b.active {
		if b.buckets[id] == bucket {
			cancels = append(cancels, cancel)
		}
	}
	b.mu.Unlock()
	for _, cancel := range cancels {
		cancel()
	}
}

func (b *backfiller) walk(ctx context.Context, bf *meta.Backfill) {
	defer b.wg.Done()
	defer func() {
		b.mu.Lock()
		delete(b.active, bf.ID)
		delete(b.buckets, bf.ID)
		b.mu.Unlock()
	}()
	m := b.m
	for ctx.Err() == nil {
		if m.unserved(bf.Bucket) || !m.frz.enterWalk(bf.Bucket) {
			sleepCtx(ctx, backfillPoll) // the bucket is being moved, or is not ours to serve: nothing changes in it
			continue
		}
		done, err := b.step(ctx, bf)
		m.frz.leaveWalk(bf.Bucket)
		if err != nil {
			if ctx.Err() != nil || errors.Is(err, errBackfillStopped) {
				return
			}
			m.log.Warn("backfill failed", "backfill", bf.ID, "bucket", bf.Bucket, "pipeline", bf.Pipeline, "error", err)
			bf.State, bf.Error = meta.BackfillFailed, err.Error()
			fin := m.Now()
			bf.FinishedAt = &fin
			b.save(bf)
			return
		}
		if done {
			bf.State = meta.BackfillCompleted
			fin := m.Now()
			bf.FinishedAt = &fin
			b.save(bf)
			m.log.Info("backfill finished", "backfill", bf.ID, "bucket", bf.Bucket, "pipeline", bf.Pipeline,
				"scanned", bf.Scanned, "enqueued", bf.Enqueued)
			return
		}
	}
}

func (b *backfiller) save(bf *meta.Backfill) {
	pctx, cancel := b.m.persistCtx()
	defer cancel()
	if err := b.m.db.Update(pctx, func(tx *meta.Tx) error { _, err := tx.SaveBackfill(pctx, bf); return err }); err != nil {
		b.m.log.Error("cannot record a backfill", "backfill", bf.ID, "error", err)
	}
}

func sleepCtx(ctx context.Context, d time.Duration) {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
	case <-t.C:
	}
}

// errBackfillGone ends a walk whose pipeline or attachment no longer exists.
var errBackfillGone = errors.New("the pipeline is no longer attached to the bucket")

// errBackfillStopped ends a walk whose backfill was cancelled (or otherwise
// ended) while it examined a batch: the batch's runs are not queued.
var errBackfillStopped = errors.New("the backfill is no longer running")

// step examines one batch of keys and enqueues the matching ones. It reports
// whether the walk is over.
func (b *backfiller) step(ctx context.Context, bf *meta.Backfill) (bool, error) {
	m := b.m
	q := m.db.Read()
	p := m.pipes.get(bf.Pipeline)
	if p == nil || p.Before() {
		return false, fmt.Errorf("pipeline %q no longer exists", bf.Pipeline)
	}
	att, err := q.GetAttachment(ctx, bf.Bucket, bf.Pipeline)
	if errors.Is(err, meta.ErrNotFound) {
		return false, errBackfillGone
	}
	if err != nil {
		return false, err
	}
	if !att.Enabled || !p.Def.Enabled || !p.Subscribes(EventCreated) {
		sleepCtx(ctx, backfillPoll) // nothing is enqueued while the pipeline is off
		return false, nil
	}
	open, err := q.CountOpenRunsOfBackfill(ctx, bf.ID)
	if err != nil {
		return false, err
	}
	room := 2*p.Def.Limits.MaxConcurrency - int(open)
	if room <= 0 {
		sleepCtx(ctx, backfillPoll)
		return false, nil
	}
	res, err := q.ListLatest(ctx, bf.Bucket, meta.ListOptions{Prefix: bf.Prefix, After: bf.Cursor, MaxKeys: backfillBatch})
	if err != nil {
		return false, err
	}
	attm := newAttEntry(att)
	var chosen []*meta.Object
	cursor, scanned := bf.Cursor, int64(0)
	exhausted := true
	for _, e := range res.Entries {
		o := e.Obj
		if o == nil {
			continue
		}
		if room <= 0 {
			exhausted = false
			break
		}
		cursor = o.Key
		scanned++
		if bf.ModifiedAfter != nil && !o.CreatedAt.After(*bf.ModifiedAfter) {
			continue
		}
		if bf.ModifiedBefore != nil && !o.CreatedAt.Before(*bf.ModifiedBefore) {
			continue
		}
		// the bytes are not read: a condition on the sniffed type is taken as met
		f := Facts{Key: o.Key, Operation: "backfill", Size: o.Size, DeclaredType: o.ContentType, SniffUnknown: true}
		if !matchBoth(p.matcher, attm.matcher, f) {
			continue
		}
		chosen = append(chosen, o)
		room--
	}
	if res.Truncated {
		exhausted = false
	}
	pctx, cancel := m.persistCtx()
	defer cancel()
	err = m.db.Update(pctx, func(tx *meta.Tx) error {
		// first, so that a cancel answered before this commit leaves no run behind
		next := *bf
		next.Scanned += scanned
		next.Enqueued += int64(len(chosen))
		next.Cursor = cursor
		if running, err := tx.SaveBackfill(pctx, &next); err != nil {
			return err
		} else if !running {
			return errBackfillStopped
		}
		for _, o := range chosen {
			info := &eventInfo{Type: EventCreated, Operation: "backfill", Bucket: bf.Bucket, Key: o.Key, Obj: o,
				Actor: engine.Actor{Kind: "backfill", ID: bf.ID, Name: "backfill"}, At: tx.Now(), BackfillID: bf.ID}
			runs, err := m.newGroup(pctx, tx, info, []pick{{p: p, att: &attm}}, bf.ID)
			if err != nil {
				return err
			}
			if err := tx.InsertRuns(pctx, runs...); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return false, err
	}
	bf.Scanned += scanned
	bf.Enqueued += int64(len(chosen))
	bf.Cursor = cursor
	if len(chosen) > 0 {
		m.notify()
	}
	return exhausted, nil
}
