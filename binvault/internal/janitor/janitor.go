// Package janitor runs the periodic maintenance jobs of spec §3.9: blob garbage
// collection, the orphan sweeper and (elsewhere) multipart expiry, lifecycle,
// run pruning and the scrubber. Each job is a function the Runner calls on a
// schedule; jobs are safe to run concurrently with traffic.
package janitor

import (
	"context"
	"errors"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/store"
)

// Job is one scheduled task.
type Job struct {
	Name     string
	Interval time.Duration
	// RunAtStart also runs the job once at boot: at once, or after StartDelay when
	// that is set. The ticker starts after that run, so the next one is an Interval
	// later.
	RunAtStart bool
	// StartDelay is how long a RunAtStart job waits after the runner starts (at most
	// one Interval): a heavy job (lifecycle, the scrubber) leaves the busy first
	// minute to the node's recovery (spec §3.9).
	StartDelay time.Duration
	Fn         func(ctx context.Context) error
}

// Runner runs jobs until its context is cancelled.
type Runner struct {
	Log  *slog.Logger
	jobs []Job
	wg   sync.WaitGroup
}

// Add registers a job.
func (r *Runner) Add(j Job) {
	if j.Interval > 0 && j.Fn != nil {
		r.jobs = append(r.jobs, j)
	}
}

// Start launches one goroutine per job.
func (r *Runner) Start(ctx context.Context) {
	if r.Log == nil {
		r.Log = slog.Default()
	}
	for _, j := range r.jobs {
		j := j
		r.wg.Add(1)
		go func() {
			defer r.wg.Done()
			run := func() {
				defer func() {
					if p := recover(); p != nil {
						r.Log.Error("janitor job panicked", "job", j.Name, "panic", p)
					}
				}()
				if err := j.Fn(ctx); err != nil && !errors.Is(err, context.Canceled) {
					r.Log.Warn("janitor job failed", "job", j.Name, "error", err)
				}
			}
			if j.RunAtStart {
				// the first run comes after StartDelay, but never later than one interval
				if d := min(j.StartDelay, j.Interval); d > 0 {
					t := time.NewTimer(d)
					select {
					case <-ctx.Done():
						t.Stop()
						return
					case <-t.C:
					}
				}
				run()
			}
			t := time.NewTicker(j.Interval)
			defer t.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-t.C:
					run()
				}
			}
		}()
	}
}

// Wait blocks until every job goroutine has stopped (after ctx is cancelled).
func (r *Runner) Wait() { r.wg.Wait() }

// afterList is a test seam: it runs after each batch of candidates was listed.
var afterList func(batch []*meta.Blob)

// GC unlinks blobs whose reference count has been zero for longer than grace
// and drops their rows (spec §3.4). Returns the number removed.
func GC(ctx context.Context, db *meta.DB, st *store.Store, grace time.Duration, now time.Time) (int, error) {
	removed := 0
	cutoff := now.Add(-grace).UnixMilli()
	for {
		cands, err := db.Read().GCCandidates(ctx, cutoff, 500)
		if err != nil {
			return removed, err
		}
		if len(cands) == 0 {
			return removed, nil
		}
		if afterList != nil {
			afterList(cands)
		}
		for _, b := range cands {
			if err := ctx.Err(); err != nil {
				return removed, err
			}
			// The row goes only if it is still collectable, and the file is unlinked in the
			// same writer transaction: the listing above may be old, and a bucket move that
			// comes back to this node takes the blobs that still wait here for the collector
			// back (its row is referenced again, the file is used by the version rows it
			// imports). That adoption looks at the file inside its own transaction, so it
			// sees either a blob that is no longer collectable or one that is gone. A failed
			// unlink rolls the row back; a failed commit after the unlink leaves a zero-ref
			// row whose file is gone, which the next pass finishes (Remove is idempotent).
			gone := false
			if err := db.Update(ctx, func(tx *meta.Tx) error {
				gone = false
				ok, err := tx.DeleteBlobRowIfCollectable(ctx, b.BlobID, cutoff)
				if err != nil || !ok {
					return err
				}
				if err := st.Remove(b.BlobID); err != nil {
					return err
				}
				gone = true
				return nil
			}); err != nil {
				return removed, err
			}
			if gone {
				removed++
			}
		}
		if len(cands) < 500 {
			return removed, nil
		}
	}
}

// SweepOrphans removes blob files that have no row and upload directories that
// have no upload row, when older than minAge (spec §3.9). The age guard keeps it
// away from files whose commit is in flight. An upload directory that keepUpload
// (any of them) claims is left alone however old: the part files of a bucket move
// that is being received sit in one before the rows that make it an upload arrive
// (spec §8.8).
func SweepOrphans(ctx context.Context, db *meta.DB, st *store.Store, minAge time.Duration, now time.Time, keepUpload ...func(id string) bool) (blobs, uploads int, err error) {
	q := db.Read()
	cutoff := now.Add(-minAge)
	werr := st.WalkBlobs(func(id string, size int64, mod time.Time) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		if mod.After(cutoff) {
			return nil
		}
		known, err := q.BlobKnown(ctx, id)
		if err != nil {
			return err
		}
		if !known {
			if err := st.Remove(id); err != nil {
				return err
			}
			blobs++
		}
		return nil
	})
	if werr != nil && !errors.Is(werr, fs.ErrNotExist) {
		return blobs, uploads, werr
	}
	dirs, derr := st.UploadDirs()
	if derr != nil {
		return blobs, uploads, derr
	}
	for id, mod := range dirs {
		if mod.After(cutoff) {
			continue
		}
		kept := false
		for _, keep := range keepUpload {
			if keep != nil && keep(id) {
				kept = true
			}
		}
		if kept {
			continue
		}
		known, err := q.UploadKnown(ctx, id)
		if err != nil {
			return blobs, uploads, err
		}
		if !known {
			if err := st.RemoveUpload(id); err == nil {
				uploads++
			}
		}
	}
	return blobs, uploads, nil
}

// EmptyDirs removes empty fan-out directories left behind under blobs/ (cosmetic).
func EmptyDirs(st *store.Store) {
	root := filepath.Join(st.Dir(), "blobs")
	subs, _ := os.ReadDir(root)
	for _, a := range subs {
		if !a.IsDir() {
			continue
		}
		inner, _ := os.ReadDir(filepath.Join(root, a.Name()))
		for _, b := range inner {
			if b.IsDir() {
				os.Remove(filepath.Join(root, a.Name(), b.Name())) // fails (harmlessly) when not empty
			}
		}
		os.Remove(filepath.Join(root, a.Name()))
	}
}
