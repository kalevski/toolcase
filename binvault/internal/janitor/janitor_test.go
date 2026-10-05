package janitor

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/store"
)

func setup(t *testing.T) (*meta.DB, *store.Store) {
	t.Helper()
	dir := t.TempDir()
	st, err := store.Open(dir, false)
	if err != nil {
		t.Fatal(err)
	}
	db, err := meta.Open(context.Background(), filepath.Join(dir, "meta.db"), meta.Options{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return db, st
}

func mkBlob(t *testing.T, st *store.Store, data string) string {
	t.Helper()
	s, err := st.NewStaged()
	if err != nil {
		t.Fatal(err)
	}
	s.File.WriteString(data)
	id := s.ID
	if err := st.Commit(s); err != nil {
		t.Fatal(err)
	}
	return id
}

func TestGCUnlinksOnlyAfterGrace(t *testing.T) {
	ctx := context.Background()
	db, st := setup(t)
	keep, drop := mkBlob(t, st, "keep"), mkBlob(t, st, "drop")
	if err := db.Update(ctx, func(tx *meta.Tx) error {
		if err := tx.CreateBucket(ctx, &meta.Bucket{Name: "bkt"}); err != nil {
			return err
		}
		for _, id := range []string{keep, drop} {
			if err := tx.InsertBlob(ctx, &meta.Blob{BlobID: id, Bucket: "bkt", Size: 4, PlainSize: 4, Refs: 1}); err != nil {
				return err
			}
		}
		_, err := tx.RefBlob(ctx, drop, -1) // last reference released
		return err
	}); err != nil {
		t.Fatal(err)
	}
	grace := time.Hour
	// inside the grace period nothing is unlinked (file-level backups stay consistent)
	n, err := GC(ctx, db, st, grace, time.Now())
	if err != nil || n != 0 {
		t.Fatalf("inside grace: %d %v", n, err)
	}
	if _, err := st.Open(drop); err != nil {
		t.Fatal("blob unlinked inside the grace period")
	}
	// after the grace the unreferenced blob goes, the referenced one stays
	n, err = GC(ctx, db, st, grace, time.Now().Add(2*time.Hour))
	if err != nil || n != 1 {
		t.Fatalf("after grace: %d %v", n, err)
	}
	if _, err := st.Open(drop); err == nil {
		t.Fatal("the unreferenced blob must be gone")
	}
	if _, err := st.Open(keep); err != nil {
		t.Fatal("a referenced blob was unlinked")
	}
	if ok, _ := db.Read().BlobKnown(ctx, drop); ok {
		t.Fatal("blob row must be deleted with the file")
	}
	// an open reader keeps reading an unlinked blob (in-flight downloads finish)
	f, _ := st.Open(keep)
	defer f.Close()
	st.Remove(keep)
	buf := make([]byte, 4)
	if n, _ := f.Read(buf); string(buf[:n]) != "keep" {
		t.Fatal("open reader lost its data")
	}
}

func TestGCFinishesACrashedUnlink(t *testing.T) {
	ctx := context.Background()
	db, st := setup(t)
	id := mkBlob(t, st, "x")
	_ = db.Update(ctx, func(tx *meta.Tx) error {
		_ = tx.CreateBucket(ctx, &meta.Bucket{Name: "bkt"})
		_ = tx.InsertBlob(ctx, &meta.Blob{BlobID: id, Bucket: "bkt", Size: 1, PlainSize: 1, Refs: 1})
		_, err := tx.RefBlob(ctx, id, -1)
		return err
	})
	st.Remove(id) // the file is already gone (crash between unlink and row delete)
	if n, err := GC(ctx, db, st, time.Minute, time.Now().Add(time.Hour)); err != nil || n != 1 {
		t.Fatalf("%d %v", n, err)
	}
	if ok, _ := db.Read().BlobKnown(ctx, id); ok {
		t.Fatal("row must be cleaned up")
	}
}

func TestSweepOrphans(t *testing.T) {
	ctx := context.Background()
	db, st := setup(t)
	known, orphanOld, orphanNew := mkBlob(t, st, "known"), mkBlob(t, st, "old"), mkBlob(t, st, "new")
	_ = db.Update(ctx, func(tx *meta.Tx) error {
		_ = tx.CreateBucket(ctx, &meta.Bucket{Name: "bkt"})
		return tx.InsertBlob(ctx, &meta.Blob{BlobID: known, Bucket: "bkt", Size: 5, PlainSize: 5, Refs: 1})
	})
	// age the "old" orphan; the "new" one could belong to a commit in flight
	old := time.Now().Add(-2 * time.Hour)
	if err := os.Chtimes(st.BlobPath(orphanOld), old, old); err != nil {
		t.Fatal(err)
	}
	// an upload directory with no row, old and new
	oldDir, newDir := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	for _, d := range []string{oldDir, newDir} {
		if err := os.MkdirAll(filepath.Join(st.Dir(), "uploads", d), 0o750); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Chtimes(filepath.Join(st.Dir(), "uploads", oldDir), old, old); err != nil {
		t.Fatal(err)
	}

	blobs, uploads, err := SweepOrphans(ctx, db, st, time.Hour, time.Now())
	if err != nil || blobs != 1 || uploads != 1 {
		t.Fatalf("swept %d blobs %d uploads: %v", blobs, uploads, err)
	}
	for id, want := range map[string]bool{known: true, orphanOld: false, orphanNew: true} {
		_, err := st.Open(id)
		if (err == nil) != want {
			t.Fatalf("blob %s present=%v want %v", id, err == nil, want)
		}
	}
	dirs, _ := st.UploadDirs()
	if _, ok := dirs[oldDir]; ok {
		t.Fatal("old orphan upload dir must go")
	}
	if _, ok := dirs[newDir]; !ok {
		t.Fatal("young upload dir must stay")
	}
}

func TestRunnerRunsJobsAndStops(t *testing.T) {
	r := &Runner{}
	ran := make(chan struct{}, 8)
	r.Add(Job{Name: "tick", Interval: 10 * time.Millisecond, RunAtStart: true, Fn: func(context.Context) error {
		ran <- struct{}{}
		return nil
	}})
	r.Add(Job{Name: "panics", Interval: 10 * time.Millisecond, Fn: func(context.Context) error { panic("boom") }})
	ctx, cancel := context.WithCancel(context.Background())
	r.Start(ctx)
	for i := 0; i < 3; i++ {
		select {
		case <-ran:
		case <-time.After(2 * time.Second):
			t.Fatal("job did not run")
		}
	}
	cancel()
	r.Wait() // a panicking job must not kill the process or block shutdown
}

// A job with a long interval runs once shortly after the start, not at once and not only after the
// first interval (spec §3.9): lifecycle and the scrubber would otherwise never run on a node that
// restarts more often than their interval.
func TestRunnerStartDelay(t *testing.T) {
	r := &Runner{}
	ran := make(chan time.Time, 8)
	r.Add(Job{Name: "delayed", Interval: time.Hour, RunAtStart: true, StartDelay: 150 * time.Millisecond, Fn: func(context.Context) error {
		ran <- time.Now()
		return nil
	}})
	start := time.Now()
	ctx, cancel := context.WithCancel(context.Background())
	r.Start(ctx)
	select {
	case at := <-ran:
		if d := at.Sub(start); d < 140*time.Millisecond {
			t.Fatalf("the job ran %v after the start: it must wait for its StartDelay", d)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("the job never ran")
	}
	select {
	case <-ran:
		t.Fatal("the job ran twice within an hour")
	case <-time.After(100 * time.Millisecond):
	}
	cancel()
	r.Wait()

	// a runner stopped during the delay never runs the job
	r2 := &Runner{}
	r2.Add(Job{Name: "never", Interval: time.Hour, RunAtStart: true, StartDelay: time.Hour, Fn: func(context.Context) error {
		t.Error("the job ran after its runner was stopped")
		return nil
	}})
	ctx2, cancel2 := context.WithCancel(context.Background())
	r2.Start(ctx2)
	cancel2()
	r2.Wait()
}

// An upload directory that a bucket move is still receiving part files into has no upload row yet:
// the sweeper leaves it alone, however old, when told so (spec §8.8), and a blob that a move placed
// (a row nobody references, no zero_since) is known to it and kept too.
func TestSweepOrphansKeepsWhatAMoveIsReceiving(t *testing.T) {
	ctx := context.Background()
	db, st := setup(t)
	old := time.Now().Add(-3 * time.Hour)
	mkUpload := func(id string) {
		t.Helper()
		if err := os.MkdirAll(filepath.Join(st.Dir(), "uploads", id), 0o750); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(st.Dir(), "uploads", id, "part"), []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(filepath.Join(st.Dir(), "uploads", id), old, old); err != nil {
			t.Fatal(err)
		}
	}
	mkUpload("incoming-upload")
	mkUpload("stray-upload")
	placed, stray := mkBlob(t, st, "placed"), mkBlob(t, st, "stray")
	for _, id := range []string{placed, stray} {
		if err := os.Chtimes(st.BlobPath(id), old, old); err != nil {
			t.Fatal(err)
		}
	}
	if err := db.Update(ctx, func(tx *meta.Tx) error {
		return tx.InsertPlacedBlob(ctx, &meta.Blob{BlobID: placed, Bucket: "arriving", Size: 6, PlainSize: 6})
	}); err != nil {
		t.Fatal(err)
	}
	blobs, uploads, err := SweepOrphans(ctx, db, st, time.Hour, time.Now(), func(id string) bool { return id == "incoming-upload" })
	if err != nil || blobs != 1 || uploads != 1 {
		t.Fatalf("sweep: %d blobs %d uploads %v", blobs, uploads, err)
	}
	if _, err := os.Stat(st.BlobPath(placed)); err != nil {
		t.Fatal("a blob that a move placed was swept")
	}
	if _, err := os.Stat(st.BlobPath(stray)); err == nil {
		t.Fatal("a stray blob was kept")
	}
	if _, err := os.Stat(filepath.Join(st.Dir(), "uploads", "incoming-upload")); err != nil {
		t.Fatal("the upload directory of a move that is being received was swept")
	}
	if _, err := os.Stat(filepath.Join(st.Dir(), "uploads", "stray-upload")); err == nil {
		t.Fatal("a stray upload directory was kept")
	}
	// the collector does not take a placed blob either: it has no zero_since
	if n, err := GC(ctx, db, st, 0, time.Now().Add(time.Hour)); err != nil || n != 0 {
		t.Fatalf("gc removed %d blobs of an arriving bucket (%v)", n, err)
	}
}
