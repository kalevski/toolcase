package meta

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func openTest(t *testing.T) *DB {
	t.Helper()
	d, err := Open(context.Background(), filepath.Join(t.TempDir(), "meta.db"), Options{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	return d
}

func mustUpdate(t *testing.T, d *DB, fn func(tx *Tx) error) {
	t.Helper()
	if err := d.Update(context.Background(), fn); err != nil {
		t.Fatal(err)
	}
}

func newBucket(t *testing.T, d *DB, name string) {
	t.Helper()
	mustUpdate(t, d, func(tx *Tx) error {
		return tx.CreateBucket(context.Background(), &Bucket{Name: name, Generation: "g1"})
	})
}

func put(t *testing.T, d *DB, bucket, key, version string, latest bool) *Object {
	t.Helper()
	o := &Object{Bucket: bucket, Key: key, Version: version, IsLatest: latest, Size: 3, ETag: "abc", CreatedAt: time.Now()}
	mustUpdate(t, d, func(tx *Tx) error { return tx.InsertObject(context.Background(), o) })
	return o
}

func TestMigrateAndBucketCRUD(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	v, _ := d.Version(ctx)
	if v != SchemaVersion() {
		t.Fatalf("version %d want %d", v, SchemaVersion())
	}
	newBucket(t, d, "photos")
	if err := d.Update(ctx, func(tx *Tx) error {
		return tx.CreateBucket(ctx, &Bucket{Name: "photos", Generation: "g2"})
	}); !errors.Is(err, ErrExists) {
		t.Fatalf("want ErrExists, got %v", err)
	}
	b, err := d.Read().GetBucket(ctx, "photos")
	if err != nil || b.Versioning != "off" || b.Revision != 1 {
		t.Fatalf("bucket %+v err %v", b, err)
	}
	q := int64(1000)
	b.QuotaBytes = &q
	b.Versioning = VersioningEnabled
	b.Lifecycle = []LifecycleRule{{ID: "r", ExpireDays: 3}}
	b.CORS = []CORSRule{{AllowedOrigins: []string{"*"}, AllowedMethods: []string{"GET"}}}
	mustUpdate(t, d, func(tx *Tx) error { return tx.UpdateBucketSettings(ctx, b, 1) })
	b2, _ := d.Read().GetBucket(ctx, "photos")
	if b2.Revision != 2 || *b2.QuotaBytes != 1000 || b2.Versioning != "enabled" || len(b2.Lifecycle) != 1 || len(b2.CORS) != 1 {
		t.Fatalf("settings not stored: %+v", b2)
	}
	// stale revision
	if err := d.Update(ctx, func(tx *Tx) error { return tx.UpdateBucketSettings(ctx, b2, 1) }); !errors.Is(err, ErrConflict) {
		t.Fatalf("want ErrConflict, got %v", err)
	}
	if _, err := d.Read().GetBucket(ctx, "nope"); !errors.Is(err, ErrNotFound) {
		t.Fatal("want not found")
	}
}

func TestGroupCommitIsolatesErrors(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	var wg sync.WaitGroup
	errs := make([]error, 40)
	for i := range errs {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			errs[i] = d.Update(ctx, func(tx *Tx) error {
				if err := tx.CreateBucket(ctx, &Bucket{Name: fmt.Sprintf("b%02d", i), Generation: "g"}); err != nil {
					return err
				}
				if i%5 == 0 {
					return errors.New("boom") // must roll back only this request
				}
				return nil
			})
		}(i)
	}
	wg.Wait()
	for i, err := range errs {
		if (i%5 == 0) != (err != nil) {
			t.Fatalf("request %d: err=%v", i, err)
		}
	}
	n, _ := d.Read().CountBuckets(ctx)
	if n != 32 {
		t.Fatalf("want 32 buckets, got %d", n)
	}
}

func TestAfterCommitHooksAndPanic(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	ran := 0
	mustUpdate(t, d, func(tx *Tx) error { tx.AfterCommit(func() { ran++ }); return nil })
	if ran != 1 {
		t.Fatal("after-commit hook not run")
	}
	err := d.Update(ctx, func(tx *Tx) error { tx.AfterCommit(func() { ran++ }); panic("x") })
	if err == nil || ran != 1 {
		t.Fatalf("panic must fail the request and skip hooks (err=%v ran=%d)", err, ran)
	}
	// the database still works
	newBucket(t, d, "ok")
}

func TestClosedDB(t *testing.T) {
	d := openTest(t)
	d.Close()
	if err := d.Update(context.Background(), func(tx *Tx) error { return nil }); !errors.Is(err, ErrClosed) {
		t.Fatalf("want ErrClosed, got %v", err)
	}
}

func TestListLatestDelimiterAndPaging(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	newBucket(t, d, "b")
	for _, k := range []string{"a", "d/1", "d/2", "d/sub/3", "e", "f/1", "g"} {
		put(t, d, "b", k, "v-"+k, true)
	}
	q := d.Read()
	res, err := q.ListLatest(ctx, "b", ListOptions{Delimiter: "/", MaxKeys: 100})
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, e := range res.Entries {
		if e.Obj != nil {
			got = append(got, e.Obj.Key)
		} else {
			got = append(got, "P:"+e.Prefix)
		}
	}
	want := []string{"a", "P:d/", "e", "P:f/", "g"}
	if fmt.Sprint(got) != fmt.Sprint(want) || res.Truncated {
		t.Fatalf("got %v want %v trunc=%v", got, want, res.Truncated)
	}
	// page of 2, resume after the common prefix d/
	res, _ = q.ListLatest(ctx, "b", ListOptions{Delimiter: "/", MaxKeys: 2})
	if len(res.Entries) != 2 || !res.Truncated || res.Entries[1].Prefix != "d/" {
		t.Fatalf("page1 %+v", res)
	}
	res, _ = q.ListLatest(ctx, "b", ListOptions{Delimiter: "/", MaxKeys: 2, SkipUnder: "d/", After: "d/"})
	if len(res.Entries) != 2 || res.Entries[0].Obj.Key != "e" || res.Entries[1].Prefix != "f/" || !res.Truncated {
		t.Fatalf("page2 %+v", res.Entries)
	}
	// prefix + no delimiter
	res, _ = q.ListLatest(ctx, "b", ListOptions{Prefix: "d/", MaxKeys: 10})
	if len(res.Entries) != 3 {
		t.Fatalf("prefix list: %d entries", len(res.Entries))
	}
	// Allow filter hides keys and prefixes with no allowed key
	res, _ = q.ListLatest(ctx, "b", ListOptions{Delimiter: "/", MaxKeys: 10, Allow: func(k string) bool { return k == "e" || k == "d/2" }})
	got = nil
	for _, e := range res.Entries {
		if e.Obj != nil {
			got = append(got, e.Obj.Key)
		} else {
			got = append(got, "P:"+e.Prefix)
		}
	}
	if fmt.Sprint(got) != fmt.Sprint([]string{"P:d/", "e"}) {
		t.Fatalf("filtered %v", got)
	}
}

func TestListLatestHidesDeleteMarkersAndLargeBuckets(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	newBucket(t, d, "b")
	mustUpdate(t, d, func(tx *Tx) error {
		for i := 0; i < 700; i++ { // more than one internal batch
			o := &Object{Bucket: "b", Key: fmt.Sprintf("k%04d", i), Version: fmt.Sprintf("v%d", i), IsLatest: true, CreatedAt: tx.Now()}
			if i == 5 {
				o.DeleteMarker = true
			}
			if err := tx.InsertObject(ctx, o); err != nil {
				return err
			}
		}
		return nil
	})
	var all []string
	after := ""
	for {
		res, err := d.Read().ListLatest(ctx, "b", ListOptions{After: after, MaxKeys: 250})
		if err != nil {
			t.Fatal(err)
		}
		for _, e := range res.Entries {
			all = append(all, e.Obj.Key)
			after = e.Obj.Key
		}
		if !res.Truncated {
			break
		}
	}
	if len(all) != 699 {
		t.Fatalf("got %d keys, want 699 (one delete marker hidden)", len(all))
	}
	for i := 1; i < len(all); i++ {
		if all[i-1] >= all[i] {
			t.Fatal("not strictly ascending")
		}
	}
}

func TestListVersionsOrderAndMarkers(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	newBucket(t, d, "b")
	// key a: v1 (oldest) .. v3 (latest); key b: one version; key c: marker over one version
	var seqA []int64
	for i, v := range []string{"a1", "a2", "a3"} {
		o := put(t, d, "b", "a", v, i == 2)
		seqA = append(seqA, o.Seq)
	}
	put(t, d, "b", "b", "b1", true)
	put(t, d, "b", "c", "c1", false)
	mk := &Object{Bucket: "b", Key: "c", Version: "c2", IsLatest: true, DeleteMarker: true, CreatedAt: time.Now()}
	mustUpdate(t, d, func(tx *Tx) error { return tx.InsertObject(ctx, mk) })

	res, err := d.Read().ListVersions(ctx, "b", ListOptions{MaxKeys: 100})
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, e := range res.Entries {
		got = append(got, e.Obj.Version)
	}
	if fmt.Sprint(got) != "[a3 a2 a1 b1 c2 c1]" {
		t.Fatalf("order %v", got)
	}
	// paging one at a time, resuming inside key a after a3 (seq of a3)
	res, _ = d.Read().ListVersions(ctx, "b", ListOptions{MaxKeys: 1})
	if res.Entries[0].Obj.Version != "a3" || !res.Truncated {
		t.Fatalf("first page %+v", res)
	}
	res, _ = d.Read().ListVersions(ctx, "b", ListOptions{MaxKeys: 2, After: "a", VersionSeq: seqA[2]})
	if res.Entries[0].Obj.Version != "a2" || res.Entries[1].Obj.Version != "a1" || !res.Truncated {
		t.Fatalf("resume inside key: %+v", res.Entries)
	}
	res, _ = d.Read().ListVersions(ctx, "b", ListOptions{MaxKeys: 10, After: "a", VersionSeq: seqA[0]})
	if res.Entries[0].Obj.Version != "b1" {
		t.Fatalf("resume after oldest version of a: %+v", res.Entries[0].Obj)
	}
}

func TestBlobRefCounting(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	mustUpdate(t, d, func(tx *Tx) error {
		return tx.InsertBlob(ctx, &Blob{BlobID: "bl1", Bucket: "b", Size: 10, PlainSize: 10, Refs: 1})
	})
	mustUpdate(t, d, func(tx *Tx) error {
		if n, err := tx.RefBlob(ctx, "bl1", 1); err != nil || n != 2 {
			return fmt.Errorf("n=%d err=%v", n, err)
		}
		if n, _ := tx.RefBlob(ctx, "bl1", -2); n != 0 {
			return fmt.Errorf("n=%d", n)
		}
		return nil
	})
	b, _ := d.Read().GetBlob(ctx, "bl1")
	if b.Refs != 0 || b.ZeroSince == nil {
		t.Fatalf("blob %+v", b)
	}
	c, _ := d.Read().GCCandidates(ctx, time.Now().Add(time.Hour).UnixMilli(), 10)
	if len(c) != 1 {
		t.Fatal("expected one GC candidate")
	}
	// re-referencing within the grace clears zero_since
	mustUpdate(t, d, func(tx *Tx) error { _, err := tx.RefBlob(ctx, "bl1", 1); return err })
	b, _ = d.Read().GetBlob(ctx, "bl1")
	if b.Refs != 1 || b.ZeroSince != nil {
		t.Fatalf("blob %+v", b)
	}
}

// The collector deletes a blob row only if it is still unreferenced and has been for longer than
// the grace period: a row that was taken back since it was listed stays.
func TestDeleteBlobRowIfCollectable(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	mustUpdate(t, d, func(tx *Tx) error {
		for _, id := range []string{"gone", "young", "held", "placed"} {
			if err := tx.InsertBlob(ctx, &Blob{BlobID: id, Bucket: "b", Size: 10, PlainSize: 10, Refs: 1}); err != nil {
				return err
			}
			if _, err := tx.RefBlob(ctx, id, -1); err != nil {
				return err
			}
		}
		return nil
	})
	cutoff := time.Now().Add(time.Hour).UnixMilli()
	mustUpdate(t, d, func(tx *Tx) error {
		// "held" was taken back after the listing: referenced again; "placed" is adopted, not yet referenced
		if _, err := tx.RefBlob(ctx, "held", 1); err != nil {
			return err
		}
		return tx.InsertPlacedBlob(ctx, &Blob{BlobID: "placed", Bucket: "b", Size: 10, PlainSize: 10})
	})
	for id, want := range map[string]bool{"gone": true, "held": false, "placed": false} {
		var got bool
		mustUpdate(t, d, func(tx *Tx) (err error) { got, err = tx.DeleteBlobRowIfCollectable(ctx, id, cutoff); return })
		if got != want {
			t.Fatalf("%s: removed=%v, want %v", id, got, want)
		}
		if known, _ := d.Read().BlobKnown(ctx, id); known == want {
			t.Fatalf("%s: row known=%v after the call (removed=%v)", id, known, got)
		}
	}
	// not collectable yet: the grace period has not passed
	var got bool
	mustUpdate(t, d, func(tx *Tx) (err error) {
		got, err = tx.DeleteBlobRowIfCollectable(ctx, "young", time.Now().Add(-time.Hour).UnixMilli())
		return
	})
	if got {
		t.Fatal("a blob inside the grace period was removed")
	}
	// a row that does not exist (anymore) is not an error
	mustUpdate(t, d, func(tx *Tx) (err error) { got, err = tx.DeleteBlobRowIfCollectable(ctx, "never", cutoff); return })
	if got {
		t.Fatal("removed a row that does not exist")
	}
}

func TestSchemaNewerThanBinaryRefused(t *testing.T) {
	path := filepath.Join(t.TempDir(), "meta.db")
	d, err := Open(context.Background(), path, Options{})
	if err != nil {
		t.Fatal(err)
	}
	d.w.Exec(fmt.Sprintf(`PRAGMA user_version = %d`, SchemaVersion()+5))
	d.Close()
	if _, err := Open(context.Background(), path, Options{}); err == nil {
		t.Fatal("must refuse a newer schema")
	}
}

// A client that disconnects (its context is cancelled) while its statement runs
// must not fail the other requests of the same group commit, nor roll back
// their rows: the driver interrupts a running statement whose context is
// cancelled, and SQLite then rolls back the whole shared transaction.
func TestCancelledRequestDoesNotPoisonTheBatch(t *testing.T) {
	bg := context.Background()
	d, err := Open(bg, filepath.Join(t.TempDir(), "meta.db"), Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	gate, started := make(chan struct{}), make(chan struct{})
	var blocker sync.WaitGroup
	blocker.Add(1)
	go func() { // keeps the committer busy so A, B and C queue up as ONE batch
		defer blocker.Done()
		_ = d.Update(bg, func(tx *Tx) error { close(started); <-gate; return nil })
	}()
	<-started

	res := make([]error, 3)
	ctxB, cancelB := context.WithCancel(bg)
	var wg sync.WaitGroup
	launch := func(i int, ctx context.Context, fn func(tx *Tx) error) {
		wg.Add(1)
		go func() { defer wg.Done(); res[i] = d.Update(ctx, fn) }()
		time.Sleep(50 * time.Millisecond) // enqueue strictly in order A, B, C
	}
	launch(0, bg, func(tx *Tx) error { return tx.KVSet(bg, "A", "1") })
	launch(1, ctxB, func(tx *Tx) error {
		go func() { time.Sleep(30 * time.Millisecond); cancelB() }() // the client goes away mid-statement
		_, err := tx.q.ExecContext(ctxB, `INSERT INTO kv(key, value) WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c WHERE x < 150000) SELECT 'big'||x, 'v' FROM c`)
		return err
	})
	launch(2, bg, func(tx *Tx) error { return tx.KVSet(bg, "C", "1") })
	close(gate)
	blocker.Wait()
	wg.Wait()

	// every request's answer must agree with what the database holds
	for i, name := range []string{"A", "B", "C"} {
		key := name
		if name == "B" {
			key = "big1"
		}
		_, gerr := d.Read().KVGet(bg, key)
		if (res[i] == nil) != (gerr == nil) {
			t.Errorf("request %s: Update returned %v but the row is present=%v", name, res[i], gerr == nil)
		}
	}
	// and the innocent neighbours of the cancelled client succeed
	if res[0] != nil || res[2] != nil {
		t.Fatalf("A and C must not be failed by B's cancellation: A=%v C=%v", res[0], res[2])
	}
}
