package engine

import (
	"context"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// Regression tests for the findings of the correctness review (2026-10-02).

func TestOverwriteAtMaxObjectsIsNotANewObject(t *testing.T) {
	v := newEnv(t)
	one := int64(1)
	b := v.bucket("bkt", func(b *meta.Bucket) { b.MaxObjects = &one })
	v.mustPut(b, "a", "1")
	if _, err := v.put(b, "a", "2"); err != nil { // an overwrite replaces the only version
		t.Fatalf("overwriting at max_objects: %v", err)
	}
	_, err := v.put(b, "b", "3")
	wantCode(t, err, "QuotaExceeded")
	// copy and overwrite-by-copy are judged the same way
	src := v.mustPut(b, "a", "4")
	if _, err := v.copyObj(b, src.Obj, "a", func(r *CopyRequest) { r.ReplaceMetadata = true }); err != nil {
		t.Fatalf("copy over an existing key at max_objects: %v", err)
	}
}

// A part uploaded while CompleteMultipartUpload is assembling must not leak
// upload_bytes (the release is computed inside the commit transaction).
func TestCompleteRacingUploadPartDoesNotLeakUploadBytes(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("mp", nil)
	u := v.upload(b, "k")
	p1 := v.part(b, u, 1, "only part")
	late := strings.Repeat("x", 1234)
	v.e.Before = func(ctx context.Context, c *BeforeCall) (*BeforeOutcome, error) {
		if c.Multipart { // the window between assembly and commit
			if _, err := v.e.UploadPart(ctx, &PartRequest{Bucket: v.reload("mp"), Upload: u, Number: 2, Body: strings.NewReader(late), Size: int64(len(late))}); err != nil {
				t.Errorf("late part: %v", err)
			}
		}
		return nil, nil
	}
	if _, err := v.complete(b, u, p1); err != nil {
		t.Fatal(err)
	}
	if c := v.counters(b); c.UploadBytes != 0 {
		t.Fatalf("upload_bytes leaked: %+v", c)
	}
	if dirs, _ := v.st.UploadDirs(); len(dirs) != 0 {
		t.Fatalf("upload dir left: %v", dirs)
	}
}

// ... and a LISTED part replaced meanwhile makes the assembled object stale.
func TestCompleteRefusesWhenAListedPartWasReplaced(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("mp", nil)
	u := v.upload(b, "k")
	p1 := v.part(b, u, 1, "first version")
	v.e.Before = func(ctx context.Context, c *BeforeCall) (*BeforeOutcome, error) {
		if c.Multipart {
			if _, err := v.e.UploadPart(ctx, &PartRequest{Bucket: v.reload("mp"), Upload: u, Number: 1, Body: strings.NewReader("replaced"), Size: 8}); err != nil {
				t.Errorf("re-upload: %v", err)
			}
		}
		return nil, nil
	}
	_, err := v.complete(b, u, p1)
	wantCode(t, err, "InvalidPart")
	if _, gerr := v.e.GetUpload(v.ctx, "mp", "k", u.UploadID); gerr != nil {
		t.Fatalf("the upload must stay open for a retry: %v", gerr)
	}
	if c := v.counters(b); c.UploadBytes != 8 {
		t.Fatalf("only the live part is counted: %+v", c)
	}
}

// An overlapping retry of CompleteMultipartUpload waits for the original and
// returns its result instead of failing with NoSuchUpload (SDK timeouts retry).
func TestOverlappingCompleteRetryReplaysTheResult(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("mp", func(b *meta.Bucket) { b.Versioning = meta.VersioningEnabled })
	u := v.upload(b, "k")
	p1 := v.part(b, u, 1, "payload")
	var once sync.Once
	v.e.Before = func(ctx context.Context, c *BeforeCall) (*BeforeOutcome, error) {
		once.Do(func() { time.Sleep(300 * time.Millisecond) }) // the original is slow
		return nil, nil
	}
	var wg sync.WaitGroup
	res := make([]*CompleteResult, 2)
	errs := make([]error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			if i == 1 {
				time.Sleep(60 * time.Millisecond) // the retry arrives while the original runs
			}
			res[i], errs[i] = v.complete(b, u, p1)
		}(i)
	}
	wg.Wait()
	for i := range errs {
		if errs[i] != nil {
			t.Fatalf("complete %d: %v", i, errs[i])
		}
	}
	if res[0].Version != res[1].Version || res[0].ETag != res[1].ETag {
		t.Fatalf("the retry must return the original's result: %+v vs %+v", res[0], res[1])
	}
	if res[1].S3VersionID == "" || res[1].S3VersionID != res[0].S3VersionID {
		t.Fatalf("the replayed result lost the version id: %+v", res[1])
	}
	if c := v.counters(b); c.Versions != 1 {
		t.Fatalf("one object version expected, got %+v", c)
	}
	// a later retry (after the fact) replays too and still carries the id
	prev, err := v.e.PreviousComplete(v.ctx, "mp", "k", u.UploadID, []PartRef{{1, p1.ETag, ""}})
	if err != nil || prev == nil || prev.S3VersionID != res[0].Version {
		t.Fatalf("recorded result: %+v %v", prev, err)
	}
}

func TestSharedBlobCopyNeedsNoFreeSpace(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("bkt", nil)
	src := v.mustPut(b, "src", strings.Repeat("x", 4096))
	v.e.Cfg.MinFreeBytes = 1 << 60 // "the disk is full"
	if _, err := v.put(b, "new", "x"); !apierr.Is(err, "StorageFull") {
		t.Fatalf("a real write must be refused: %v", err)
	}
	if _, err := v.copyObj(b, src.Obj, "dst"); err != nil {
		t.Fatalf("an O(1) copy writes no bytes and must not need free space: %v", err)
	}
}

func TestCopyRespectsContentTypeRulesAddedLater(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("bkt", nil)
	src := v.mustPut(b, "doc.txt", "plain text, not an image")
	if err := v.db.Update(v.ctx, func(tx *meta.Tx) error {
		cur, _ := tx.GetBucket(v.ctx, "bkt")
		cur.AllowedContentTypes = []string{"image/*"}
		return tx.UpdateBucketSettings(v.ctx, cur, 0)
	}); err != nil {
		t.Fatal(err)
	}
	_, err := v.copyObj(b, src.Obj, "copy.txt")
	wantCode(t, err, "ContentTypeNotAllowed")
}

func TestEncryptedPartForcesAnEncryptedObjectEvenWithAStaleUploadRow(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("mp", nil)
	src := v.mustPut(b, "src", strings.Repeat("e", 1000), func(r *PutRequest) { r.SSE = true })
	u := v.upload(b, "dst")
	stale := *u // what a slow Complete would be holding: Encrypted=false
	bk := v.reload("mp")
	p, err := v.e.CopyPart(v.ctx, &CopyPartRequest{Bucket: bk, Upload: u, Number: 1, Src: src.Obj, Off: 0, Len: 1000})
	if err != nil {
		t.Fatal(err)
	}
	if stale.Encrypted {
		t.Fatal("precondition")
	}
	if _, err := v.e.Complete(v.ctx, &CompleteRequest{Bucket: bk, Upload: &stale, Parts: []PartRef{{Number: 1, ETag: p.ETag}}}); err != nil {
		t.Fatal(err)
	}
	if _, o, _ := v.get(b, "dst", ""); !o.SSE {
		t.Fatal("an encrypted part's data was stored in the clear")
	}
}

func TestReconcileUploadsAbortsUploadsWhoseFilesAreGone(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("mp", nil)
	keep := v.upload(b, "keep")
	v.part(b, keep, 1, "kept")
	lost := v.upload(b, "lost")
	v.part(b, lost, 1, "lost data")
	if err := os.RemoveAll(v.st.Dir() + "/uploads/" + lost.UploadID); err != nil { // restored without uploads/
		t.Fatal(err)
	}
	n, err := v.e.ReconcileUploads(v.ctx)
	if err != nil || n != 1 {
		t.Fatalf("aborted %d: %v", n, err)
	}
	if _, err := v.e.GetUpload(v.ctx, "mp", "lost", lost.UploadID); !apierr.Is(err, "NoSuchUpload") {
		t.Fatalf("the lost upload must be gone: %v", err)
	}
	if _, err := v.e.GetUpload(v.ctx, "mp", "keep", keep.UploadID); err != nil {
		t.Fatalf("the intact upload must stay: %v", err)
	}
	if c := v.counters(b); c.UploadBytes != 4 {
		t.Fatalf("only the intact upload's bytes remain counted: %+v", c)
	}
}
