package janitor

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// A bucket move that comes back to a node still holding its old blobs (rows that wait for the
// collector, spec §8.8 step 2: "a file the target has is not sent again") takes such a blob back
// with InsertPlacedBlob, and the import then gives it references. If that happens while the
// collector works through a batch that already lists the blob, the collector must leave it alone:
// the row is deleted only if it is still collectable, in the transaction that unlinks the file.
func TestJanitorGCLeavesABlobThatWasTakenBackAfterTheListing(t *testing.T) {
	ctx := context.Background()
	db, st := setup(t)
	const n = 5
	ids := make([]string, n)
	for i := range ids {
		ids[i] = mkBlob(t, st, fmt.Sprintf("blob-%d", i))
	}
	old := time.Now().Add(-3 * time.Hour)
	if err := db.Update(ctx, func(tx *meta.Tx) error {
		if err := tx.CreateBucket(ctx, &meta.Bucket{Name: "bkt"}); err != nil {
			return err
		}
		for i, id := range ids {
			z := old.Add(time.Duration(i) * time.Millisecond)
			if err := tx.InsertBlob(ctx, &meta.Blob{BlobID: id, Bucket: "bkt", Size: 6, PlainSize: 6, Refs: 0, ZeroSince: &z}); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}

	back := ids[n-1] // the last of the batch: the collector reaches it after the move took it back
	afterList = func([]*meta.Blob) {
		afterList = nil
		if err := db.Update(ctx, func(tx *meta.Tx) error {
			if err := tx.InsertPlacedBlob(ctx, &meta.Blob{BlobID: back, Bucket: "bkt", Size: 6, PlainSize: 6}); err != nil {
				return err
			}
			_, err := tx.RefBlob(ctx, back, 1) // what the import's rebuild of the counts gives it
			return err
		}); err != nil {
			t.Error(err)
		}
	}
	t.Cleanup(func() { afterList = nil })

	removed, err := GC(ctx, db, st, time.Hour, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if removed != n-1 {
		t.Fatalf("the collector removed %d blobs, want %d (all but the one that was taken back)", removed, n-1)
	}
	b, err := db.Read().GetBlob(ctx, back)
	if err != nil || b.Refs != 1 {
		t.Fatalf("the blob that was taken back: %+v %v", b, err)
	}
	if _, err := st.Open(back); err != nil {
		t.Fatalf("the collector unlinked a blob that is referenced again: %v", err)
	}
	for _, id := range ids[:n-1] {
		if _, err := st.Open(id); err == nil {
			t.Fatalf("blob %s should have been collected", id)
		}
		if known, _ := db.Read().BlobKnown(ctx, id); known {
			t.Fatalf("the row of blob %s should have been collected", id)
		}
	}
}

// A row that was taken back but has no reference yet (the blob is placed, the rows are still to
// arrive) is not collectable either: its zero_since is cleared.
func TestJanitorGCLeavesAPlacedBlobAlone(t *testing.T) {
	ctx := context.Background()
	db, st := setup(t)
	id := mkBlob(t, st, "placed")
	old := time.Now().Add(-3 * time.Hour)
	if err := db.Update(ctx, func(tx *meta.Tx) error {
		if err := tx.CreateBucket(ctx, &meta.Bucket{Name: "bkt"}); err != nil {
			return err
		}
		return tx.InsertBlob(ctx, &meta.Blob{BlobID: id, Bucket: "bkt", Size: 6, PlainSize: 6, Refs: 0, ZeroSince: &old})
	}); err != nil {
		t.Fatal(err)
	}
	if err := db.Update(ctx, func(tx *meta.Tx) error {
		return tx.InsertPlacedBlob(ctx, &meta.Blob{BlobID: id, Bucket: "bkt", Size: 6, PlainSize: 6})
	}); err != nil {
		t.Fatal(err)
	}
	if n, err := GC(ctx, db, st, time.Hour, time.Now()); err != nil || n != 0 {
		t.Fatalf("the collector took a placed blob: %d %v", n, err)
	}
	if _, err := st.Open(id); err != nil {
		t.Fatalf("the file of a placed blob is gone: %v", err)
	}
}

// A file whose row is gone (an unlink that failed after the row was removed, or a crash between the two
// in some older version) is the orphan sweeper's: it removes it once it is old enough.
func TestJanitorSweepCollectsAFileWhoseRowIsGone(t *testing.T) {
	ctx := context.Background()
	db, st := setup(t)
	id := mkBlob(t, st, "left behind")
	old := time.Now().Add(-2 * time.Hour)
	if err := os.Chtimes(st.BlobPath(id), old, old); err != nil {
		t.Fatal(err)
	}
	blobs, _, err := SweepOrphans(ctx, db, st, time.Hour, time.Now())
	if err != nil || blobs != 1 {
		t.Fatalf("swept %d blobs: %v", blobs, err)
	}
	if _, err := st.Open(id); err == nil {
		t.Fatal("the file whose row is gone is still there")
	}
}
