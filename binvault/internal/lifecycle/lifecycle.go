// Package lifecycle applies bucket lifecycle rules (spec §3.12): expiry of
// current versions, removal of noncurrent versions and lone delete markers,
// and aborting stale multipart uploads. A janitor job calls Run on an interval.
package lifecycle

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/obs"
)

// Worker evaluates the rules of every bucket that has any.
type Worker struct {
	Eng   *engine.Engine
	Batch int // actions per transaction (BINVAULT_LIFECYCLE_BATCH)
	Log   *slog.Logger
	Now   func() time.Time
	// Skip, when set, names buckets whose rules are not applied on this node: in a
	// cluster, local data the catalog no longer gives to it (an orphan, spec §8.5)
	// is kept as it is.
	Skip func(bucket string) bool

	actions   *obs.CounterVec
	perBucket bool
}

// New returns a worker that counts its actions per bucket; reg may be nil.
func New(eng *engine.Engine, batch int, log *slog.Logger, reg *obs.Registry) *Worker {
	return NewWith(eng, batch, log, reg, true)
}

// NewWith is New with the choice of BINVAULT_METRICS_PER_BUCKET (spec §9.2): with
// perBucket false the binvault_lifecycle_actions_total family has no bucket label
// and counts across all buckets.
func NewWith(eng *engine.Engine, batch int, log *slog.Logger, reg *obs.Registry, perBucket bool) *Worker {
	if batch <= 0 {
		batch = 1000
	}
	if log == nil {
		log = slog.Default()
	}
	w := &Worker{Eng: eng, Batch: batch, Log: log, Now: time.Now, perBucket: perBucket}
	if reg != nil {
		if perBucket {
			w.actions = reg.Counter("binvault_lifecycle_actions_total", "Lifecycle actions applied.", "bucket", "action")
		} else {
			w.actions = reg.Counter("binvault_lifecycle_actions_total", "Lifecycle actions applied, all buckets.", "action")
		}
	}
	return w
}

func (w *Worker) count(bucket, action string, n int) {
	if w.actions == nil || n <= 0 {
		return
	}
	if w.perBucket {
		w.actions.Add(float64(n), bucket, action)
	} else {
		w.actions.Add(float64(n), action)
	}
}

// Run visits the buckets with rules and applies them in batches until nothing
// is left or deadline passes (the interval, spec §3.12). It returns the number
// of actions applied.
func (w *Worker) Run(ctx context.Context, deadline time.Time) (int, error) {
	names, err := w.Eng.DB.Read().BucketsWithLifecycle(ctx)
	if err != nil {
		return 0, err
	}
	total := 0
	for _, name := range names {
		if ctx.Err() != nil || !w.Now().Before(deadline) {
			break
		}
		if w.Skip != nil && w.Skip(name) {
			continue
		}
		n, err := w.RunBucket(ctx, name, deadline)
		total += n
		if err != nil {
			w.Log.Warn("lifecycle failed", "bucket", name, "error", err)
		}
	}
	return total, nil
}

// RunBucket applies one bucket's rules. A bucket that is frozen for a move (spec
// §8.8) is left alone, and the rules a freeze catches in the middle stop there: what
// they changed after the rows were copied would be lost.
func (w *Worker) RunBucket(ctx context.Context, name string, deadline time.Time) (int, error) {
	if g := w.Eng.Gate; g != nil {
		gctx, end, err := g.Begin(ctx, name, true)
		if err != nil {
			return 0, nil
		}
		defer end()
		ctx = gctx
	}
	n, err := w.runBucket(ctx, name, deadline)
	if err != nil && errors.Is(context.Cause(ctx), engine.ErrFrozen) {
		err = nil
	}
	return n, err
}

func (w *Worker) runBucket(ctx context.Context, name string, deadline time.Time) (int, error) {
	b, err := w.Eng.DB.Read().GetBucket(ctx, name)
	if err != nil {
		return 0, err
	}
	total := 0
	for i := range b.Lifecycle {
		r := &b.Lifecycle[i]
		if !r.IsEnabled() {
			continue
		}
		for _, step := range []func(context.Context, *meta.Bucket, *meta.LifecycleRule, time.Time) (int, error){
			w.expireCurrent, w.removeNoncurrent, w.removeLoneMarkers, w.abortUploads,
		} {
			n, err := step(ctx, b, r, deadline)
			total += n
			if err != nil {
				return total, err
			}
		}
	}
	return total, nil
}

func (w *Worker) more(ctx context.Context, deadline time.Time) bool {
	return ctx.Err() == nil && w.Now().Before(deadline)
}

// expireCurrent: the current data version expires when it is expire_days old.
func (w *Worker) expireCurrent(ctx context.Context, b *meta.Bucket, r *meta.LifecycleRule, deadline time.Time) (int, error) {
	if r.ExpireDays <= 0 {
		return 0, nil
	}
	cutoff := w.Now().Add(-time.Duration(r.ExpireDays) * engine.Day)
	var curCreated, curSeq int64
	total := 0
	for w.more(ctx, deadline) {
		rows, err := w.Eng.DB.Read().LifecycleCurrent(ctx, b.Name, cutoff, curCreated, curSeq, w.Batch)
		if err != nil {
			return total, err
		}
		if len(rows) == 0 {
			break
		}
		var items []engine.ExpireItem
		for _, o := range rows {
			curCreated, curSeq = o.CreatedAt.UnixMilli(), o.Seq
			if engine.RuleMatches(r, o) {
				items = append(items, engine.ExpireItem{Key: o.Key, Seq: o.Seq})
			}
		}
		if len(items) > 0 {
			n, err := w.Eng.ExpireBatch(ctx, b.Name, items)
			if err != nil {
				return total, err
			}
			total += n
			w.count(b.Name, "expire", n)
		}
		if len(rows) < w.Batch {
			break
		}
	}
	return total, nil
}

// removeNoncurrent: a noncurrent version goes noncurrent_days after it became
// noncurrent, except the noncurrent_keep newest ones of each key.
func (w *Worker) removeNoncurrent(ctx context.Context, b *meta.Bucket, r *meta.LifecycleRule, deadline time.Time) (int, error) {
	if r.NoncurrentDays <= 0 {
		return 0, nil
	}
	cutoff := w.Now().Add(-time.Duration(r.NoncurrentDays) * engine.Day)
	var curSince, curSeq int64
	total := 0
	for w.more(ctx, deadline) {
		rows, err := w.Eng.DB.Read().LifecycleNoncurrent(ctx, b.Name, cutoff, curSince, curSeq, w.Batch)
		if err != nil {
			return total, err
		}
		if len(rows) == 0 {
			break
		}
		var items []engine.ExpireItem
		for _, o := range rows {
			if o.NoncurrentSince != nil {
				curSince = o.NoncurrentSince.UnixMilli()
			}
			curSeq = o.Seq
			if !engine.RuleMatches(r, o) {
				continue
			}
			if r.NoncurrentKeep > 0 {
				newer, err := w.Eng.DB.Read().NoncurrentRank(ctx, b.Name, o.Key, o.Seq)
				if err != nil {
					return total, err
				}
				if newer < r.NoncurrentKeep {
					continue
				}
			}
			items = append(items, engine.ExpireItem{Key: o.Key, Seq: o.Seq, Remove: true})
		}
		if len(items) > 0 {
			n, err := w.Eng.ExpireBatch(ctx, b.Name, items)
			if err != nil {
				return total, err
			}
			total += n
			w.count(b.Name, "noncurrent", n)
		}
		if len(rows) < w.Batch {
			break
		}
	}
	return total, nil
}

// removeLoneMarkers: expire_delete_markers removes a delete marker once it is
// the only version of its key left.
func (w *Worker) removeLoneMarkers(ctx context.Context, b *meta.Bucket, r *meta.LifecycleRule, deadline time.Time) (int, error) {
	if !r.ExpireDeleteMarkers {
		return 0, nil
	}
	after := ""
	total := 0
	for w.more(ctx, deadline) {
		rows, err := w.Eng.DB.Read().LifecycleLoneMarkers(ctx, b.Name, after, w.Batch)
		if err != nil {
			return total, err
		}
		if len(rows) == 0 {
			break
		}
		var items []engine.ExpireItem
		for _, o := range rows {
			after = o.Key
			if r.Filter.Prefix == "" || strings.HasPrefix(o.Key, r.Filter.Prefix) {
				items = append(items, engine.ExpireItem{Key: o.Key, Seq: o.Seq, Remove: true})
			}
		}
		if len(items) > 0 {
			n, err := w.Eng.ExpireBatch(ctx, b.Name, items)
			if err != nil {
				return total, err
			}
			total += n
			w.count(b.Name, "delete_marker", n)
		}
		if len(rows) < w.Batch {
			break
		}
	}
	return total, nil
}

// abortUploads: abort_multipart_days aborts uploads this many days after they
// were initiated.
func (w *Worker) abortUploads(ctx context.Context, b *meta.Bucket, r *meta.LifecycleRule, deadline time.Time) (int, error) {
	if r.AbortMultipartDays <= 0 {
		return 0, nil
	}
	cutoff := w.Now().Add(-time.Duration(r.AbortMultipartDays) * engine.Day)
	total := 0
	for w.more(ctx, deadline) {
		us, err := w.Eng.DB.Read().OpenUploadsOlder(ctx, b.Name, cutoff, r.Filter.Prefix, w.Batch)
		if err != nil {
			return total, err
		}
		if len(us) == 0 {
			break
		}
		progressed := false
		for _, u := range us {
			if err := w.Eng.AbortUpload(ctx, b, u); err == nil {
				total++
				progressed = true
				w.count(b.Name, "abort_multipart", 1)
			}
		}
		if !progressed {
			break // the same uploads would come back every round
		}
	}
	return total, nil
}
