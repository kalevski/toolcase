package meta

import (
	"bytes"
	"context"
	"errors"
	"testing"
	"time"
)

// A bucket carries the epoch of this node's copy; it starts at 0 and is changed only
// for the incarnation it names.
func TestBucketEpoch(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	newBucket(t, d, "photos")
	if b, err := d.Read().GetBucket(ctx, "photos"); err != nil || b.Epoch != 0 {
		t.Fatalf("a new bucket: %+v %v", b, err)
	}
	var ok bool
	mustUpdate(t, d, func(tx *Tx) (err error) { ok, err = tx.SetBucketEpoch(ctx, "photos", "g1", 3); return })
	if !ok {
		t.Fatal("epoch not set")
	}
	mustUpdate(t, d, func(tx *Tx) (err error) { ok, err = tx.SetBucketEpoch(ctx, "photos", "other-generation", 9); return })
	if ok {
		t.Fatal("the epoch of another incarnation was set")
	}
	if b, _ := d.Read().GetBucket(ctx, "photos"); b.Epoch != 3 {
		t.Fatalf("epoch %d", b.Epoch)
	}
}

// The state of a move changes only from the states the caller names, so a decision is
// taken once; final states stamp finished_at; the list pages by id.
func TestMoveRows(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	mk := func(id, role, bucket, state string) *Move {
		return &Move{ID: id, Role: role, Bucket: bucket, Generation: "g", Peer: "n_peer", State: state, Epoch: 1}
	}
	mustUpdate(t, d, func(tx *Tx) error {
		for _, m := range []*Move{
			mk("m1", MoveOut, "a", MoveDone), mk("m2", MoveOut, "b", MoveCutover), mk("m3", MoveIn, "c", MoveReceiving), mk("m4", MoveOut, "d", MoveQueued),
		} {
			if err := tx.InsertMove(ctx, m); err != nil {
				return err
			}
		}
		return nil
	})
	if err := d.Update(ctx, func(tx *Tx) error { return tx.InsertMove(ctx, mk("m1", MoveOut, "a", MoveQueued)) }); !errors.Is(err, ErrExists) {
		t.Fatalf("a duplicate id: %v", err)
	}
	all, err := d.Read().ListMoves(ctx, MoveFilter{})
	if err != nil || len(all) != 4 || all[0].ID != "m4" || all[3].ID != "m1" {
		t.Fatalf("list: %+v %v", all, err)
	}
	open, _ := d.Read().ListMoves(ctx, MoveFilter{Open: true, Asc: true})
	if len(open) != 3 || open[0].ID != "m2" {
		t.Fatalf("open moves: %+v", open)
	}
	if page, _ := d.Read().ListMoves(ctx, MoveFilter{Before: "m3", Limit: 1}); len(page) != 1 || page[0].ID != "m2" {
		t.Fatalf("page below m3: %+v", page)
	}
	if in, _ := d.Read().ListMoves(ctx, MoveFilter{Role: MoveIn}); len(in) != 1 || in[0].ID != "m3" {
		t.Fatalf("incoming: %+v", in)
	}

	// decisions are taken once
	var changed bool
	mustUpdate(t, d, func(tx *Tx) (err error) {
		changed, err = tx.MoveTransition(ctx, "m3", []string{MoveVerified}, MoveActivated, "")
		return
	})
	if changed {
		t.Fatal("a receiving move was activated: only a verified one may be")
	}
	mustUpdate(t, d, func(tx *Tx) (err error) {
		changed, err = tx.MoveTransition(ctx, "m3", []string{MoveReceiving, MoveVerified}, MoveAbandoned, "boot")
		return
	})
	if !changed {
		t.Fatal("not abandoned")
	}
	mustUpdate(t, d, func(tx *Tx) (err error) {
		changed, err = tx.MoveTransition(ctx, "m3", []string{MoveVerified}, MoveActivated, "")
		return
	})
	if changed {
		t.Fatal("an abandoned move was activated")
	}
	m3, _ := d.Read().GetMove(ctx, "m3")
	if m3.State != MoveAbandoned || m3.Error != "boot" || m3.FinishedAt == nil || !m3.Final() {
		t.Fatalf("m3: %+v", m3)
	}
	// a non-final transition leaves finished_at alone and an empty error keeps the old one
	mustUpdate(t, d, func(tx *Tx) (err error) {
		changed, err = tx.MoveTransition(ctx, "m2", nil, MoveMoved, "")
		return
	})
	if m2, _ := d.Read().GetMove(ctx, "m2"); !changed || m2.State != MoveMoved || m2.FinishedAt != nil || m2.Final() {
		t.Fatalf("m2: %+v", m2)
	}
	if _, err := d.Read().GetMove(ctx, "nope"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("a missing move: %v", err)
	}
	// counters and times
	now := time.Now()
	m4, _ := d.Read().GetMove(ctx, "m4")
	m4.State, m4.BytesCopied, m4.ObjectsCopied, m4.StartedAt = MoveCopying, 77, 5, &now
	mustUpdate(t, d, func(tx *Tx) error { return tx.SaveMove(ctx, m4) })
	if got, _ := d.Read().GetMove(ctx, "m4"); got.State != MoveCopying || got.BytesCopied != 77 || got.ObjectsCopied != 5 || got.StartedAt == nil {
		t.Fatalf("m4: %+v", got)
	}
	counts, err := d.Read().CountMoves(ctx)
	if err != nil || counts[[2]string{MoveOut, MoveCopying}] != 1 || counts[[2]string{MoveIn, MoveAbandoned}] != 1 {
		t.Fatalf("counts %v %v", counts, err)
	}
}

// Blob files that arrive before the bucket's rows are recorded as rows nobody
// references and the collector leaves alone; the import takes them over, refuses rows
// whose blob never arrived, and leaves what no version references to the collector.
func TestImportTakesOverPlacedBlobs(t *testing.T) {
	ctx := context.Background()
	src, dst := openTest(t), openTest(t)
	moveFixture(t, src)
	var stream bytes.Buffer
	if _, err := src.ExportBucket(ctx, "photos", &stream); err != nil {
		t.Fatal(err)
	}

	// nothing was received: the import is refused and leaves nothing behind
	err := dst.Update(ctx, func(tx *Tx) error {
		_, err := tx.ImportBucketWith(ctx, bytes.NewReader(stream.Bytes()), ImportOptions{Placed: true})
		return err
	})
	if !errors.Is(err, ErrMoveData) {
		t.Fatalf("an import with no blobs received: %v", err)
	}
	if _, err := dst.Read().GetBucket(ctx, "photos"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("a refused import left the bucket behind: %v", err)
	}

	// b1 arrives with a wrong size, b2 right; z9 is a blob the sender sent that no version references
	place := func(id string, size int64) {
		mustUpdate(t, dst, func(tx *Tx) error {
			return tx.InsertPlacedBlob(ctx, &Blob{BlobID: id, Bucket: "photos", Size: size, PlainSize: size, SSE: id == "b2"})
		})
	}
	place("b1", 11)
	place("b2", 20)
	place("z9", 4)
	place("z9", 4) // idempotent
	err = dst.Update(ctx, func(tx *Tx) error {
		_, err := tx.ImportBucketWith(ctx, bytes.NewReader(stream.Bytes()), ImportOptions{Placed: true})
		return err
	})
	if !errors.Is(err, ErrMoveData) {
		t.Fatalf("a blob that arrived with another size: %v", err)
	}
	place("b1", 10) // the placeholder keeps its row; a second place with the right size does not fix the size
	mustUpdate(t, dst, func(tx *Tx) error { return tx.DeleteBlobRows(ctx, []string{"b1"}) })
	place("b1", 10)
	mustUpdate(t, dst, func(tx *Tx) error {
		_, err := tx.ImportBucketWith(ctx, bytes.NewReader(stream.Bytes()), ImportOptions{Placed: true})
		return err
	})

	q := dst.Read()
	for id, refs := range map[string]int64{"b1": 1, "b2": 2} {
		bl, err := q.GetBlob(ctx, id)
		if err != nil || bl.Refs != refs || bl.ZeroSince != nil || !bl.SSE == (id == "b2") {
			t.Fatalf("blob %s: %+v %v", id, bl, err)
		}
	}
	z, err := q.GetBlob(ctx, "z9")
	if err != nil || z.Refs != 0 || z.ZeroSince == nil {
		t.Fatalf("an unreferenced blob must be left to the collector: %+v %v", z, err)
	}
	blobs, _ := q.BucketBlobs(ctx, "photos", "", 10)
	if len(blobs) != 3 || blobs[0].BlobID != "b1" || blobs[2].BlobID != "z9" {
		t.Fatalf("blob rows %+v", blobs)
	}
	n, bytes, _ := q.BucketBlobStats(ctx, "photos")
	if n != 3 || bytes != 34 {
		t.Fatalf("stats %d %d", n, bytes)
	}

	// a row that waits for the collector is taken back by a new arrival
	mustUpdate(t, dst, func(tx *Tx) error {
		return tx.InsertBlob(ctx, &Blob{BlobID: "w1", Bucket: "x", Size: 1, PlainSize: 1, Refs: 0, ZeroSince: &time.Time{}})
	})
	mustUpdate(t, dst, func(tx *Tx) error {
		return tx.InsertPlacedBlob(ctx, &Blob{BlobID: "w1", Bucket: "x", Size: 1, PlainSize: 1})
	})
	if w, _ := q.GetBlob(ctx, "w1"); w.ZeroSince != nil {
		t.Fatalf("a placed blob stays collectable: %+v", w)
	}
}

// The blob rows of a bucket page by seq: one entry per version row (a shared blob twice), the
// neighbour's blobs and the delete markers stay out.
func TestBucketBlobRowsAfter(t *testing.T) {
	ctx := context.Background()
	d := openTest(t)
	moveFixture(t, d)
	q := d.Read()
	all, err := q.BucketBlobRowsAfter(ctx, "photos", 0, 0)
	if err != nil || len(all) != 3 {
		t.Fatalf("rows: %+v %v", all, err)
	}
	if all[0].BlobID != "b1" || all[1].BlobID != "b2" || all[2].BlobID != "b2" || !all[1].SSE || all[0].SSE || all[0].Size != 10 || all[1].PlainSize != 20 {
		t.Fatalf("rows: %+v", all)
	}
	if !(all[0].Seq < all[1].Seq && all[1].Seq < all[2].Seq) {
		t.Fatalf("the rows are not in seq order: %+v", all)
	}
	// paging: a page of two, then the rest after the last seq
	page, _ := q.BucketBlobRowsAfter(ctx, "photos", 0, 2)
	rest, _ := q.BucketBlobRowsAfter(ctx, "photos", page[len(page)-1].Seq, 2)
	if len(page) != 2 || len(rest) != 1 || rest[0].Seq != all[2].Seq {
		t.Fatalf("paging: %+v then %+v", page, rest)
	}
	if none, _ := q.BucketBlobRowsAfter(ctx, "photos", all[2].Seq, 10); len(none) != 0 {
		t.Fatalf("after the last row: %+v", none)
	}
	if max, _ := q.BucketMaxSeq(ctx, "photos"); max < all[2].Seq {
		t.Fatalf("max seq %d", max)
	}
}
