package engine

import (
	"strings"
	"testing"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

func (v *env) copyObj(b *meta.Bucket, src *meta.Object, dst string, mod ...func(*CopyRequest)) (*CommitResult, error) {
	v.t.Helper()
	req := &CopyRequest{Bucket: v.reload(b.Name), Src: src, DstKey: dst, Actor: Actor{Kind: "token", ID: "BVKTEST"}}
	for _, m := range mod {
		m(req)
	}
	return v.e.Copy(v.ctx, req)
}

func TestCopySharesBlob(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("b", nil)
	src := v.mustPut(b, "src", "payload", func(r *PutRequest) {
		r.Headers.ContentType = "text/plain"
		r.Metadata = map[string]string{"a": "1"}
		r.Tags = map[string]string{"t": "1"}
	})
	res, err := v.copyObj(b, src.Obj, "dst")
	if err != nil {
		t.Fatal(err)
	}
	if res.Obj.BlobID != src.Obj.BlobID || res.Obj.ETag != src.Obj.ETag {
		t.Fatalf("copy must share the blob: %+v", res.Obj)
	}
	bl, _ := v.db.Read().GetBlob(v.ctx, src.Obj.BlobID)
	if bl.Refs != 2 {
		t.Fatalf("refs %d", bl.Refs)
	}
	body, o, _ := v.get(b, "dst", "")
	if body != "payload" || o.ContentType != "text/plain" || o.Metadata["a"] != "1" || o.Tags["t"] != "1" {
		t.Fatalf("%q %+v", body, o)
	}
	last := v.evs[len(v.evs)-1]
	if last.Operation != "copy" || last.Type != EventCreated || last.CopySource == nil || last.CopySource.Key != "src" {
		t.Fatalf("%+v", last)
	}
	// deleting the source leaves the copy readable
	v.del(b, "src", "")
	if body, _, err := v.get(b, "dst", ""); err != nil || body != "payload" {
		t.Fatal(body, err)
	}
}

func TestCopyDirectives(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("b", nil)
	src := v.mustPut(b, "src", "x", func(r *PutRequest) {
		r.Headers.ContentType = "text/plain"
		r.Metadata = map[string]string{"a": "1"}
		r.Tags = map[string]string{"t": "1"}
	})
	res, err := v.copyObj(b, src.Obj, "dst", func(r *CopyRequest) {
		r.ReplaceMetadata, r.ReplaceTags = true, true
		r.Headers = Headers{ContentType: "image/png"}
		r.Metadata = map[string]string{"b": "2"}
		r.Tags = map[string]string{"u": "2"}
	})
	if err != nil {
		t.Fatal(err)
	}
	o := res.Obj
	if o.ContentType != "image/png" || o.Metadata["b"] != "2" || o.Metadata["a"] != "" || o.Tags["u"] != "2" || o.Tags["t"] != "" {
		t.Fatalf("%+v", o)
	}
	// REPLACE with no content type falls back to the default
	res, _ = v.copyObj(b, src.Obj, "dst2", func(r *CopyRequest) { r.ReplaceMetadata = true })
	if res.Obj.ContentType != DefaultContentType {
		t.Fatal(res.Obj.ContentType)
	}
}

func TestCopyOntoItself(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("b", func(b *meta.Bucket) { b.Versioning = meta.VersioningEnabled })
	r1 := v.mustPut(b, "k", "one")
	_, err := v.copyObj(b, r1.Obj, "k")
	wantCode(t, err, "InvalidRequest") // unchanged self-copy, as S3
	// REPLACE of metadata is a change
	if _, err := v.copyObj(b, r1.Obj, "k", func(r *CopyRequest) { r.ReplaceMetadata = true; r.Metadata = map[string]string{"x": "1"} }); err != nil {
		t.Fatal(err)
	}
	// restoring an old version onto its key is an ordinary copy
	r2 := v.mustPut(b, "k", "two")
	old, _ := v.e.Lookup(v.ctx, v.reload("b"), "k", r1.Obj.Version)
	if _, err := v.copyObj(b, old, "k"); err != nil {
		t.Fatalf("restore: %v", err)
	}
	if body, _, _ := v.get(b, "k", ""); body != "one" {
		t.Fatal(body)
	}
	_ = r2
	// a different encryption state is a change too
	if _, err := v.copyObj(b, r1.Obj, "k", func(r *CopyRequest) { r.SSE = true }); err != nil {
		t.Fatalf("encrypting copy: %v", err)
	}
	_, o, _ := v.get(b, "k", "")
	if !o.SSE {
		t.Fatal("the self-copy with SSE must produce an encrypted object")
	}
}

func TestCopyEncryption(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("b", nil)
	plain := v.mustPut(b, "plain", strings.Repeat("p", 100000))
	// plain -> encrypted: a new blob is written
	res, err := v.copyObj(b, plain.Obj, "enc", func(r *CopyRequest) { r.SSE = true })
	if err != nil {
		t.Fatal(err)
	}
	if !res.Obj.SSE || res.Obj.BlobID == plain.Obj.BlobID {
		t.Fatalf("%+v", res.Obj)
	}
	if body, _, _ := v.get(b, "enc", ""); body != strings.Repeat("p", 100000) {
		t.Fatal("encrypted copy differs")
	}
	// encrypted -> copy keeps the encrypted blob (never silently decrypts)
	res2, err := v.copyObj(b, res.Obj, "enc2")
	if err != nil {
		t.Fatal(err)
	}
	if !res2.Obj.SSE || res2.Obj.BlobID != res.Obj.BlobID {
		t.Fatalf("%+v", res2.Obj)
	}
}

func TestCopyRulesAndGuards(t *testing.T) {
	v := newEnv(t)
	q := int64(10)
	b := v.bucket("b", func(b *meta.Bucket) { b.QuotaBytes = &q })
	src := v.mustPut(b, "src", "123456")
	_, err := v.copyObj(b, src.Obj, "dst")
	wantCode(t, err, "QuotaExceeded") // a copy counts as logical bytes

	// the stale-write guard: the source must still be this version
	b2 := v.bucket("c", func(b *meta.Bucket) { b.Versioning = meta.VersioningEnabled })
	s1 := v.mustPut(b2, "k", "one")
	v.mustPut(b2, "k", "two")
	_, err = v.copyObj(b2, s1.Obj, "dst", func(r *CopyRequest) { r.RequireSrcVersion = "someone-else" })
	wantCode(t, err, "PreconditionFailed")
	if _, err := v.copyObj(b2, s1.Obj, "dst", func(r *CopyRequest) { r.RequireSrcVersion = s1.Obj.Version }); err != nil {
		t.Fatal(err)
	}

	// the source vanishing before the commit fails the copy (never a dangling blob)
	b3 := v.bucket("d", nil)
	s := v.mustPut(b3, "k", "gone")
	v.del(b3, "k", "")
	_, err = v.copyObj(b3, s.Obj, "dst")
	wantCode(t, err, "NoSuchKey")
}
