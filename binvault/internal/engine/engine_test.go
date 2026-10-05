package engine

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"io"
	"log/slog"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/seal"
	"github.com/kalevski/toolcase/binvault/internal/store"
)

type env struct {
	t   *testing.T
	e   *Engine
	ctx context.Context
	db  *meta.DB
	st  *store.Store
	evs []*Event
}

func newEnv(t *testing.T) *env {
	t.Helper()
	ctx := context.Background()
	dir := t.TempDir()
	st, err := store.Open(dir, false)
	if err != nil {
		t.Fatal(err)
	}
	db, err := meta.Open(ctx, filepath.Join(dir, "meta.db"), meta.Options{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	key := bytes.Repeat([]byte{7}, 32)
	ring, err := seal.New(key)
	if err != nil {
		t.Fatal(err)
	}
	e := New(db, st, ring, Config{MaxObjectBytes: 1 << 30, MinFreeBytes: 0}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	v := &env{t: t, e: e, ctx: ctx, db: db, st: st}
	e.Hooks.Outbox = func(ctx context.Context, tx *meta.Tx, ev *Event) error {
		v.evs = append(v.evs, ev)
		return nil
	}
	return v
}

func (v *env) bucket(name string, mod func(*meta.Bucket)) *meta.Bucket {
	v.t.Helper()
	b := &meta.Bucket{Name: name, Versioning: meta.VersioningOff, Encryption: meta.EncryptionNone, AnonymousRead: meta.AnonOff}
	if mod != nil {
		mod(b)
	}
	if err := v.db.Update(v.ctx, func(tx *meta.Tx) error { return tx.CreateBucket(v.ctx, b) }); err != nil {
		v.t.Fatal(err)
	}
	return v.reload(name)
}

func (v *env) reload(name string) *meta.Bucket {
	v.t.Helper()
	b, err := v.e.Bucket(v.ctx, name)
	if err != nil {
		v.t.Fatal(err)
	}
	return b
}

func (v *env) put(b *meta.Bucket, key, body string, mod ...func(*PutRequest)) (*PutResult, error) {
	v.t.Helper()
	req := &PutRequest{Bucket: v.reload(b.Name), Key: key, Body: strings.NewReader(body), Size: int64(len(body)),
		Actor: Actor{Kind: "token", ID: "BVKTEST"}}
	for _, m := range mod {
		m(req)
	}
	return v.e.Put(v.ctx, req)
}

func (v *env) mustPut(b *meta.Bucket, key, body string, mod ...func(*PutRequest)) *PutResult {
	v.t.Helper()
	r, err := v.put(b, key, body, mod...)
	if err != nil {
		v.t.Fatalf("put %s: %v", key, err)
	}
	return r
}

func (v *env) get(b *meta.Bucket, key, version string) (string, *meta.Object, error) {
	v.t.Helper()
	bk := v.reload(b.Name)
	o, err := v.e.Lookup(v.ctx, bk, key, version)
	if err != nil {
		return "", nil, err
	}
	body, err := v.e.OpenBody(v.ctx, bk, o)
	if err != nil {
		return "", nil, err
	}
	defer body.Close()
	var buf bytes.Buffer
	if _, err := body.WriteRange(&buf, 0, body.Size()); err != nil {
		v.t.Fatal(err)
	}
	return buf.String(), o, nil
}

func (v *env) del(b *meta.Bucket, key, version string) *DeleteResult {
	v.t.Helper()
	r, err := v.e.Delete(v.ctx, &DeleteRequest{Bucket: b.Name, Key: key, VersionID: version, Actor: Actor{Kind: "token"}})
	if err != nil {
		v.t.Fatalf("delete %s: %v", key, err)
	}
	return r
}

func (v *env) counters(b *meta.Bucket) meta.Counters { return v.reload(b.Name).Counters }

func wantCode(t *testing.T, err error, code string) {
	t.Helper()
	if !apierr.Is(err, code) {
		t.Fatalf("want %s, got %v", code, err)
	}
}

func TestPutGetUnversioned(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("photos", nil)
	r := v.mustPut(b, "a/b.txt", "hello world", func(r *PutRequest) {
		r.Headers.ContentType = "text/plain"
		r.Metadata = map[string]string{"user": "42"}
		r.Tags = map[string]string{"k": "v"}
	})
	sum := md5.Sum([]byte("hello world"))
	if r.Obj.ETag != hex.EncodeToString(sum[:]) || r.Obj.Size != 11 || !r.Obj.NullVersion || r.Obj.Version == "" {
		t.Fatalf("%+v", r.Obj)
	}
	body, o, err := v.get(b, "a/b.txt", "")
	if err != nil || body != "hello world" || o.ContentType != "text/plain" || o.Metadata["user"] != "42" || o.Tags["k"] != "v" {
		t.Fatalf("%q %+v %v", body, o, err)
	}
	if len(v.evs) != 1 || v.evs[0].Type != EventCreated || v.evs[0].Operation != "put" {
		t.Fatalf("events %+v", v.evs)
	}
	c := v.counters(b)
	if c.Objects != 1 || c.Versions != 1 || c.Bytes != 11 || c.DeleteMarkers != 0 {
		t.Fatalf("%+v", c)
	}

	// overwrite replaces the only version and raises object.updated
	r2 := v.mustPut(b, "a/b.txt", "second!")
	if len(v.evs) != 2 || v.evs[1].Type != EventUpdated || v.evs[1].Previous == nil {
		t.Fatalf("events %+v", v.evs)
	}
	if body, _, _ := v.get(b, "a/b.txt", ""); body != "second!" {
		t.Fatalf("%q", body)
	}
	c = v.counters(b)
	if c.Objects != 1 || c.Versions != 1 || c.Bytes != 7 {
		t.Fatalf("%+v", c)
	}
	_ = r2

	// default content type
	r3 := v.mustPut(b, "plain", "x")
	if r3.Obj.ContentType != DefaultContentType {
		t.Fatal(r3.Obj.ContentType)
	}

	// delete removes it; missing key then 404
	d := v.del(b, "a/b.txt", "")
	if !d.Existed || d.Event == nil || d.Event.Type != EventDeleted {
		t.Fatalf("%+v", d)
	}
	_, _, err = v.get(b, "a/b.txt", "")
	wantCode(t, err, "NoSuchKey")
	c = v.counters(b)
	if c.Objects != 1 || c.Versions != 1 || c.Bytes != 1 {
		t.Fatalf("%+v", c)
	}
	// deleting a missing key is a no-op
	if d := v.del(b, "a/b.txt", ""); d.Existed || d.Event != nil {
		t.Fatalf("%+v", d)
	}
}

func TestEmptyObjectAndBlobGC(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("b", nil)
	r := v.mustPut(b, "empty", "")
	if r.Obj.Size != 0 || r.Obj.ETag != "d41d8cd98f00b204e9800998ecf8427e" {
		t.Fatalf("%+v", r.Obj)
	}
	body, _, err := v.get(b, "empty", "")
	if err != nil || body != "" {
		t.Fatal(body, err)
	}
	// the overwritten blob drops to zero references
	r1 := v.mustPut(b, "k", "one")
	blob1 := r1.Obj.BlobID
	v.mustPut(b, "k", "two")
	bl, err := v.db.Read().GetBlob(v.ctx, blob1)
	if err != nil || bl.Refs != 0 || bl.ZeroSince == nil {
		t.Fatalf("%+v %v", bl, err)
	}
}

func TestVersioning(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("v", func(b *meta.Bucket) { b.Versioning = meta.VersioningEnabled })
	r1 := v.mustPut(b, "k", "one")
	r2 := v.mustPut(b, "k", "two")
	if r1.Obj.NullVersion || r1.Obj.Version == r2.Obj.Version {
		t.Fatal("versions")
	}
	if body, _, _ := v.get(b, "k", ""); body != "two" {
		t.Fatal(body)
	}
	if body, _, _ := v.get(b, "k", r1.Obj.Version); body != "one" {
		t.Fatal(body)
	}
	c := v.counters(b)
	if c.Objects != 1 || c.Versions != 2 || c.Bytes != 6 {
		t.Fatalf("%+v", c)
	}

	// delete adds a marker
	d := v.del(b, "k", "")
	if !d.DeleteMarker || d.VersionID == "" || d.Event == nil || d.Event.Type != EventDeleted {
		t.Fatalf("%+v", d)
	}
	_, _, err := v.get(b, "k", "")
	if e, ok := apierr.As(err); !ok || e.Code != "NoSuchKey" || e.Header.Get("x-amz-delete-marker") != "true" {
		t.Fatalf("%v", err)
	}
	_, _, err = v.get(b, "k", d.VersionID)
	wantCode(t, err, "MethodNotAllowed")
	c = v.counters(b)
	if c.Objects != 0 || c.Versions != 3 || c.DeleteMarkers != 1 || c.Bytes != 6 {
		t.Fatalf("%+v", c)
	}
	// a second delete adds nothing
	d2 := v.del(b, "k", "")
	if d2.Event != nil || d2.VersionID != d.VersionID {
		t.Fatalf("%+v", d2)
	}
	if c := v.counters(b); c.Versions != 3 {
		t.Fatalf("%+v", c)
	}

	// writing over a marker: created, not updated
	n := len(v.evs)
	v.mustPut(b, "k", "three")
	if ev := v.evs[n]; ev.Type != EventCreated {
		t.Fatalf("%+v", ev)
	}
	c = v.counters(b)
	if c.Objects != 1 || c.Versions != 4 || c.DeleteMarkers != 1 {
		t.Fatalf("%+v", c)
	}

	// unknown version id
	_, _, err = v.get(b, "k", "01ZZZZZZZZZZZZZZZZZZZZZZZZ")
	wantCode(t, err, "NoSuchVersion")
}

func TestPurgeUncoversOlderVersion(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("v", func(b *meta.Bucket) { b.Versioning = meta.VersioningEnabled })
	r1 := v.mustPut(b, "k", "one")
	r2 := v.mustPut(b, "k", "two")
	n := len(v.evs)

	// purging the latest uncovers the older version: object.updated
	d := v.del(b, "k", r2.Obj.Version)
	if !d.Existed || d.Event == nil || d.Event.Type != EventUpdated || d.Event.Operation != "delete_version" {
		t.Fatalf("%+v", d)
	}
	if len(v.evs) != n+1 {
		t.Fatal("event not queued")
	}
	if body, o, err := v.get(b, "k", ""); err != nil || body != "one" || o.Version != r1.Obj.Version || !o.IsLatest || o.NoncurrentSince != nil {
		t.Fatalf("%q %+v %v", body, o, err)
	}
	c := v.counters(b)
	if c.Objects != 1 || c.Versions != 1 || c.Bytes != 3 {
		t.Fatalf("%+v", c)
	}

	// marker removal brings the key back (object.created)
	dm := v.del(b, "k", "")
	v.mustPut(b, "other", "x")
	n = len(v.evs)
	d = v.del(b, "k", dm.VersionID)
	if d.Event == nil || d.Event.Type != EventCreated {
		t.Fatalf("%+v", d)
	}
	if body, _, _ := v.get(b, "k", ""); body != "one" {
		t.Fatal(body)
	}

	// purging the only version raises object.deleted
	d = v.del(b, "k", r1.Obj.Version)
	if d.Event == nil || d.Event.Type != EventDeleted {
		t.Fatalf("%+v", d)
	}
	// purging a noncurrent version raises nothing
	a1 := v.mustPut(b, "n", "a")
	v.mustPut(b, "n", "b")
	m := len(v.evs)
	d = v.del(b, "n", a1.Obj.Version)
	if d.Event != nil || len(v.evs) != m {
		t.Fatalf("%+v", d)
	}
	// purging an unknown version is a no-op
	if d := v.del(b, "n", "01ZZZZZZZZZZZZZZZZZZZZZZZZ"); d.Existed {
		t.Fatal("phantom purge")
	}
	c = v.counters(b)
	if c.DeleteMarkers != 0 || c.Objects != 2 { // "other" and "n"
		t.Fatalf("%+v", c)
	}
	_ = n
}

func TestNullVersionsAfterEnable(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("b", nil)
	r1 := v.mustPut(b, "k", "legacy")
	if !r1.Obj.NullVersion {
		t.Fatal("rows written while off are null versions")
	}
	// enable versioning
	if err := v.db.Update(v.ctx, func(tx *meta.Tx) error {
		bk, _ := tx.GetBucket(v.ctx, "b")
		bk.Versioning = meta.VersioningEnabled
		return tx.UpdateBucketSettings(v.ctx, bk, bk.Revision)
	}); err != nil {
		t.Fatal(err)
	}
	r2 := v.mustPut(b, "k", "new")
	if r2.Obj.NullVersion {
		t.Fatal("new rows are real versions")
	}
	if body, _, err := v.get(b, "k", "null"); err != nil || body != "legacy" {
		t.Fatalf("%q %v", body, err)
	}
	if o := r1.Obj; o.S3VersionID() != "null" {
		t.Fatal(o.S3VersionID())
	}
	// purge the null version by its S3 id
	d := v.del(b, "k", "null")
	if !d.Existed || d.VersionID != "null" {
		t.Fatalf("%+v", d)
	}
	_, _, err := v.get(b, "k", "null")
	wantCode(t, err, "NoSuchVersion")
}

func TestUnversionedVersionIDHandling(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("b", nil)
	v.mustPut(b, "k", "x")
	// versionId=null addresses the only version
	if body, _, err := v.get(b, "k", "null"); err != nil || body != "x" {
		t.Fatal(body, err)
	}
	// any other id is InvalidArgument
	_, _, err := v.get(b, "k", "01ABC")
	wantCode(t, err, "InvalidArgument")
	_, err = v.e.Delete(v.ctx, &DeleteRequest{Bucket: "b", Key: "k", VersionID: "01ABC"})
	wantCode(t, err, "InvalidArgument")
	// deleting with null counts as a plain delete
	d := v.del(b, "k", "null")
	if !d.Existed || d.Event == nil || d.Event.Operation != "delete" {
		t.Fatalf("%+v", d)
	}
}

func TestPreconditions(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("b", nil)
	v.mustPut(b, "k", "one", func(r *PutRequest) { r.IfNoneMatchStar = true })
	_, err := v.put(b, "k", "two", func(r *PutRequest) { r.IfNoneMatchStar = true })
	wantCode(t, err, "PreconditionFailed")

	r := v.mustPut(b, "k", "three", func(r *PutRequest) { r.IfMatch = `"` + md5hex("one") + `"` })
	_, err = v.put(b, "k", "four", func(r *PutRequest) { r.IfMatch = `"` + md5hex("one") + `"` })
	wantCode(t, err, "PreconditionFailed")
	_, err = v.put(b, "nokey", "x", func(r *PutRequest) { r.IfMatch = `"abc"` })
	wantCode(t, err, "NoSuchKey")
	if body, _, _ := v.get(b, "k", ""); body != "three" {
		t.Fatal(body)
	}
	_ = r

	// the same checks hold atomically at commit even if admission passed
	in := &CommitInput{Bucket: "b", Key: "k", Version: v.e.NewVersionID(), Op: "put", IfNoneMatchStar: true,
		Obj: meta.Object{Size: 1, ETag: "x"}, NewBlob: &meta.Blob{BlobID: store.NewID(), Size: 1, PlainSize: 1}}
	_, err = v.e.Commit(v.ctx, in)
	wantCode(t, err, "PreconditionFailed")
}

func md5hex(s string) string {
	h := md5.Sum([]byte(s))
	return hex.EncodeToString(h[:])
}

func TestWriteOnce(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("b", func(b *meta.Bucket) { b.Versioning = meta.VersioningEnabled })
	wo := func(r *PutRequest) { r.WriteOnce = true }
	v.mustPut(b, "k", "one", wo)
	_, err := v.put(b, "k", "two", wo)
	wantCode(t, err, "AccessDenied")
	// a delete marker counts as no visible object
	v.del(b, "k", "")
	if _, err := v.put(b, "k", "three", wo); err != nil {
		t.Fatal(err)
	}
	// and the commit transaction re-checks it
	in := &CommitInput{Bucket: "b", Key: "k", Version: v.e.NewVersionID(), WriteOnce: true,
		Obj: meta.Object{Size: 1, ETag: "x"}, NewBlob: &meta.Blob{BlobID: store.NewID(), Size: 1, PlainSize: 1}}
	_, err = v.e.Commit(v.ctx, in)
	wantCode(t, err, "AccessDenied")
}

func TestQuotaAndLimits(t *testing.T) {
	v := newEnv(t)
	q := int64(10)
	mo := int64(2)
	b := v.bucket("b", func(b *meta.Bucket) { b.QuotaBytes = &q; b.MaxObjects = &mo })
	v.mustPut(b, "a", "123456")
	_, err := v.put(b, "b", "12345")
	wantCode(t, err, "QuotaExceeded")
	// replacing an object is judged by the net growth
	v.mustPut(b, "a", "1234567890")
	v.del(b, "a", "")
	v.mustPut(b, "x", "12")
	v.mustPut(b, "y", "12")
	_, err = v.put(b, "z", "1")
	wantCode(t, err, "QuotaExceeded") // max_objects
	// overwriting an existing key is not a new object
	if _, err := v.put(b, "x", "99"); err != nil {
		t.Fatal(err)
	}

	mob := int64(3)
	b2 := v.bucket("c", func(b *meta.Bucket) { b.MaxObjectBytes = &mob })
	_, err = v.put(b2, "k", "toolong")
	wantCode(t, err, "EntityTooLarge")
	// a body that exceeds the declared size cap while streaming (unknown length)
	_, err = v.put(b2, "k", "toolong", func(r *PutRequest) { r.Size = -1 })
	wantCode(t, err, "EntityTooLarge")
}

func TestVersionedQuotaCountsEveryVersion(t *testing.T) {
	v := newEnv(t)
	q := int64(10)
	b := v.bucket("b", func(b *meta.Bucket) { b.QuotaBytes = &q; b.Versioning = meta.VersioningEnabled })
	v.mustPut(b, "k", "123456")
	_, err := v.put(b, "k", "12345") // the old version still counts
	wantCode(t, err, "QuotaExceeded")
	// delete markers consume no quota and no max_objects
	v.del(b, "k", "")
	if c := v.counters(b); c.Bytes != 6 || c.DeleteMarkers != 1 {
		t.Fatalf("%+v", c)
	}
}

func TestContentTypeRules(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("img", func(b *meta.Bucket) { b.AllowedContentTypes = []string{"image/*"} })
	png := "\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + strings.Repeat("x", 600)
	if _, err := v.put(b, "ok.png", png, func(r *PutRequest) { r.Headers.ContentType = "text/plain" }); err != nil {
		t.Fatal(err) // the declared type is not trusted; the sniffed one decides
	}
	_, err := v.put(b, "bad.txt", strings.Repeat("hello ", 200), func(r *PutRequest) { r.Headers.ContentType = "image/png" })
	wantCode(t, err, "ContentTypeNotAllowed")
	// short bodies are sniffed at EOF
	_, err = v.put(b, "bad2.txt", "hi")
	wantCode(t, err, "ContentTypeNotAllowed")
	if _, _, err := v.get(b, "bad.txt", ""); !apierr.Is(err, "NoSuchKey") {
		t.Fatal("rejected upload must not be stored")
	}
	// nothing stays in tmp/
	ents, _ := readDir(v.st.Dir() + "/tmp")
	if len(ents) != 0 {
		t.Fatalf("staging files left behind: %v", ents)
	}
}

func TestIncompleteAndOversizeBodies(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("b", nil)
	// declared 10 bytes, 3 arrive
	_, err := v.put(b, "k", "abc", func(r *PutRequest) { r.Size = 10 })
	wantCode(t, err, "IncompleteBody")
	// verify hook failure discards the upload
	_, err = v.put(b, "k", "abc", func(r *PutRequest) {
		r.Verify = func(*Received) error {
			return apierr.New("BadDigest", "The Content-MD5 you specified did not match what we received.")
		}
	})
	wantCode(t, err, "BadDigest")
	if _, _, err := v.get(b, "k", ""); !apierr.Is(err, "NoSuchKey") {
		t.Fatal("unverified upload stored")
	}
	ents, _ := readDir(v.st.Dir() + "/tmp")
	if len(ents) != 0 {
		t.Fatalf("staging files left behind: %v", ents)
	}
}

func TestNoSuchBucket(t *testing.T) {
	v := newEnv(t)
	b := &meta.Bucket{Name: "ghost"}
	_, err := v.e.Put(v.ctx, &PutRequest{Bucket: b, Key: "k", Body: strings.NewReader("x"), Size: 1})
	wantCode(t, err, "NoSuchBucket")
	if _, err := v.e.Bucket(v.ctx, "ghost"); !apierr.Is(err, "NoSuchBucket") {
		t.Fatal(err)
	}
}

func TestSSERoundTrip(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("enc", func(b *meta.Bucket) { b.Encryption = meta.EncryptionSSES3 })
	plain := strings.Repeat("secret data 0123456789", 10000) // spans several 64 KiB chunks
	r := v.mustPut(b, "k", plain)
	if !r.Obj.SSE || r.Obj.Size != int64(len(plain)) || r.Obj.ETag != md5hex(plain) {
		t.Fatalf("%+v", r.Obj)
	}
	body, _, err := v.get(b, "k", "")
	if err != nil || body != plain {
		t.Fatal("round trip failed", err)
	}
	// the blob on disk is ciphertext
	raw, err := readFile(v.st.BlobPath(r.Obj.BlobID))
	if err != nil || bytes.Contains(raw, []byte("secret data")) {
		t.Fatal("blob is not encrypted")
	}
	if int64(len(raw)) <= r.Obj.Size {
		t.Fatal("ciphertext must be larger than the plaintext")
	}
	// ranged read across chunk boundaries
	bk := v.reload("enc")
	o, _ := v.e.Lookup(v.ctx, bk, "k", "")
	rb, _ := v.e.OpenBody(v.ctx, bk, o)
	defer rb.Close()
	var buf bytes.Buffer
	if _, err := rb.WriteRange(&buf, 65530, 20); err != nil || buf.String() != plain[65530:65550] {
		t.Fatalf("range: %q %v", buf.String(), err)
	}
	// per-request SSE in a plain bucket
	b2 := v.bucket("plainb", nil)
	r2 := v.mustPut(b2, "k", "hello", func(r *PutRequest) { r.SSE = true })
	if !r2.Obj.SSE {
		t.Fatal("request-level SSE ignored")
	}
	if body, _, _ := v.get(b2, "k", ""); body != "hello" {
		t.Fatal(body)
	}
	// the bucket data key was created and is stored sealed
	if len(v.reload("plainb").DataKey) == 0 {
		t.Fatal("no data key")
	}
}

func TestChecksumStored(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("b", nil)
	var got *Received
	r := v.mustPut(b, "k", "123456789", func(r *PutRequest) {
		r.ChecksumAlgo = "CRC32"
		r.Verify = func(rc *Received) error { got = rc; return nil }
	})
	if r.Obj.ChecksumAlgo != "CRC32" || r.Obj.Checksum != "y/Q5Jg==" || r.Obj.ChecksumType != "FULL_OBJECT" {
		t.Fatalf("%+v", r.Obj)
	}
	if got == nil || hex.EncodeToString(got.SHA256) != "15e2b0d3c33891ebb0f1ef609ec419420c20e320ce94c65fbc8c3312448eb225" {
		t.Fatalf("%+v", got)
	}
}

func TestListLatestFromEngineWrites(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("b", func(b *meta.Bucket) { b.Versioning = meta.VersioningEnabled })
	for _, k := range []string{"a/1", "a/2", "b", "c/x/1"} {
		v.mustPut(b, k, "x")
	}
	v.del(b, "b", "")
	res, err := v.db.Read().ListLatest(v.ctx, "b", meta.ListOptions{Delimiter: "/", MaxKeys: 100})
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, en := range res.Entries {
		if en.Obj != nil {
			got = append(got, en.Obj.Key)
		} else {
			got = append(got, en.Prefix)
		}
	}
	if strings.Join(got, ",") != "a/,c/" {
		t.Fatalf("%v", got)
	}
}

func TestTagsAreNotVersioned(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("b", nil)
	r := v.mustPut(b, "k", "x")
	if err := v.e.SetTags(v.ctx, "b", r.Obj, map[string]string{"scan": "clean"}); err != nil {
		t.Fatal(err)
	}
	_, o, _ := v.get(b, "k", "")
	if o.Tags["scan"] != "clean" || o.Version != r.Obj.Version || o.ETag != r.Obj.ETag {
		t.Fatalf("%+v", o)
	}
	if len(v.evs) != 1 {
		t.Fatal("tagging must not raise events")
	}
	wantCode(t, v.e.SetTags(v.ctx, "b", r.Obj, map[string]string{strings.Repeat("k", 200): "v"}), "InvalidTag")
}

func TestScrubDetectsCorruption(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("b", nil)
	good := v.mustPut(b, "good", "intact data")
	bad := v.mustPut(b, "bad", "will be damaged")
	enc := v.bucket("enc", func(b *meta.Bucket) { b.Encryption = meta.EncryptionSSES3 })
	encObj := v.mustPut(enc, "secret", strings.Repeat("z", 100000))

	checked, nbad, err := v.e.Scrub(v.ctx, nil)
	if err != nil || checked != 3 || nbad != 0 {
		t.Fatalf("clean scrub: %d checked, %d bad, %v", checked, nbad, err)
	}
	// flip a byte in one plain blob and one encrypted blob
	for _, id := range []string{bad.Obj.BlobID, encObj.Obj.BlobID} {
		p := v.st.BlobPath(id)
		raw, _ := readFile(p)
		raw[len(raw)-1] ^= 0xff
		if err := writeFile(p, raw); err != nil {
			t.Fatal(err)
		}
	}
	var hit []string
	checked, nbad, err = v.e.Scrub(v.ctx, func(o *meta.Object, err error) { hit = append(hit, o.Key) })
	if err != nil || checked != 3 || nbad != 2 {
		t.Fatalf("%d checked, %d bad, %v (%v)", checked, nbad, err, hit)
	}
	_ = good
}
