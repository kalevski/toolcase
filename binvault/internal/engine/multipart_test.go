package engine

import (
	"crypto/md5"
	"encoding/hex"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

func (v *env) upload(b *meta.Bucket, key string, mod ...func(*CreateUploadRequest)) *meta.Upload {
	v.t.Helper()
	req := &CreateUploadRequest{Bucket: v.reload(b.Name), Key: key, Actor: Actor{Kind: "token", ID: "BVKTEST"}}
	for _, m := range mod {
		m(req)
	}
	u, err := v.e.CreateUpload(v.ctx, req)
	if err != nil {
		v.t.Fatal(err)
	}
	return u
}

func (v *env) part(b *meta.Bucket, u *meta.Upload, n int, body string) *meta.Part {
	v.t.Helper()
	p, err := v.e.UploadPart(v.ctx, &PartRequest{Bucket: v.reload(b.Name), Upload: u, Number: n, Body: strings.NewReader(body), Size: int64(len(body))})
	if err != nil {
		v.t.Fatalf("part %d: %v", n, err)
	}
	return p
}

func (v *env) complete(b *meta.Bucket, u *meta.Upload, parts ...*meta.Part) (*CompleteResult, error) {
	v.t.Helper()
	refs := make([]PartRef, len(parts))
	for i, p := range parts {
		refs[i] = PartRef{Number: p.Number, ETag: p.ETag}
	}
	return v.e.Complete(v.ctx, &CompleteRequest{Bucket: v.reload(b.Name), Upload: u, Parts: refs, Actor: Actor{Kind: "token", ID: "BVKTEST"}})
}

const mib5 = 5 << 20

func TestMultipartRoundTrip(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("mp", nil)
	u := v.upload(b, "big.bin", func(r *CreateUploadRequest) {
		r.Headers.ContentType = "application/x-test"
		r.Metadata = map[string]string{"m": "1"}
		r.Tags = map[string]string{"t": "1"}
	})
	p1body := strings.Repeat("a", mib5)
	p2body := "tail"
	p1 := v.part(b, u, 1, p1body)
	p2 := v.part(b, u, 2, p2body)
	if c := v.counters(b); c.UploadBytes != int64(mib5+4) || c.Bytes != 0 {
		t.Fatalf("%+v", c)
	}
	res, err := v.complete(b, u, p1, p2)
	if err != nil {
		t.Fatal(err)
	}
	m1, m2 := md5.Sum([]byte(p1body)), md5.Sum([]byte(p2body))
	cat := append(m1[:], m2[:]...)
	want := md5.Sum(cat)
	if res.ETag != hex.EncodeToString(want[:])+"-2" {
		t.Fatalf("etag %s", res.ETag)
	}
	body, o, err := v.get(b, "big.bin", "")
	if err != nil || body != p1body+p2body || o.ContentType != "application/x-test" || o.Metadata["m"] != "1" || o.Tags["t"] != "1" {
		t.Fatalf("%v %+v", err, o)
	}
	if len(o.Parts) != 2 || o.Parts[0] != mib5 || o.Parts[1] != 4 {
		t.Fatalf("parts %v", o.Parts)
	}
	if c := v.counters(b); c.UploadBytes != 0 || c.Bytes != int64(mib5+4) || c.Objects != 1 {
		t.Fatalf("%+v", c)
	}
	if len(v.evs) != 1 || v.evs[0].Operation != "multipart" || v.evs[0].Type != EventCreated {
		t.Fatalf("events %+v", v.evs)
	}
	// the part files are gone
	if dirs, _ := v.st.UploadDirs(); len(dirs) != 0 {
		t.Fatalf("upload dir left: %v", dirs)
	}
	// a retried Complete with the same list returns the same result
	again, err := v.e.PreviousComplete(v.ctx, "mp", "big.bin", u.UploadID, []PartRef{{1, p1.ETag, ""}, {2, p2.ETag, ""}})
	if err != nil || again == nil || again.ETag != res.ETag || again.Version != res.Version {
		t.Fatalf("%+v %v", again, err)
	}
	// a different list is not served from the record
	if other, _ := v.e.PreviousComplete(v.ctx, "mp", "big.bin", u.UploadID, []PartRef{{1, p1.ETag, ""}}); other != nil {
		t.Fatal("a different part list must not replay")
	}
	// the upload is no longer open
	if _, err := v.e.GetUpload(v.ctx, "mp", "big.bin", u.UploadID); !apierr.Is(err, "NoSuchUpload") {
		t.Fatal(err)
	}
}

func TestMultipartValidation(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("mp", nil)
	u := v.upload(b, "k")
	small := v.part(b, u, 1, "tiny")
	last := v.part(b, u, 2, "tail")
	// non-final part below 5 MiB
	_, err := v.complete(b, u, small, last)
	wantCode(t, err, "EntityTooSmall")
	// out of order
	_, err = v.complete(b, u, last, small)
	wantCode(t, err, "InvalidPartOrder")
	// wrong etag
	_, err = v.e.Complete(v.ctx, &CompleteRequest{Bucket: v.reload("mp"), Upload: u, Parts: []PartRef{{Number: 2, ETag: strings.Repeat("0", 32)}}})
	wantCode(t, err, "InvalidPart")
	// unknown part
	_, err = v.e.Complete(v.ctx, &CompleteRequest{Bucket: v.reload("mp"), Upload: u, Parts: []PartRef{{Number: 9, ETag: "x"}}})
	wantCode(t, err, "InvalidPart")
	// empty list
	_, err = v.e.Complete(v.ctx, &CompleteRequest{Bucket: v.reload("mp"), Upload: u})
	wantCode(t, err, "MalformedXML")
	// part number range
	_, err = v.e.UploadPart(v.ctx, &PartRequest{Bucket: v.reload("mp"), Upload: u, Number: 10001, Body: strings.NewReader("x"), Size: 1})
	wantCode(t, err, "InvalidArgument")
	// a single small part is fine as the last part
	if _, err := v.complete(b, u, last); err != nil {
		t.Fatal(err)
	}
	if body, _, _ := v.get(b, "k", ""); body != "tail" {
		t.Fatal(body)
	}
}

func TestMultipartReuploadAbortAndQuota(t *testing.T) {
	v := newEnv(t)
	q := int64(100)
	b := v.bucket("mp", func(b *meta.Bucket) { b.QuotaBytes = &q })
	u := v.upload(b, "k")
	p := v.part(b, u, 1, strings.Repeat("x", 60))
	if c := v.counters(b); c.UploadBytes != 60 {
		t.Fatalf("%+v", c)
	}
	// re-uploading a part replaces it (new part id, old file removed)
	p2 := v.part(b, u, 1, strings.Repeat("y", 40))
	if p2.PartID == p.PartID {
		t.Fatal("a re-upload must use a new part id")
	}
	if c := v.counters(b); c.UploadBytes != 40 {
		t.Fatalf("%+v", c)
	}
	if _, err := v.st.OpenPart(u.UploadID, p.PartID); err == nil {
		t.Fatal("old part file must be deleted")
	}
	// open uploads count against the quota
	_, err := v.put(b, "other", strings.Repeat("z", 61))
	wantCode(t, err, "QuotaExceeded")
	if _, err := v.put(b, "other", strings.Repeat("z", 60)); err != nil {
		t.Fatal(err)
	}
	_, err = v.e.UploadPart(v.ctx, &PartRequest{Bucket: v.reload("mp"), Upload: u, Number: 2, Body: strings.NewReader(strings.Repeat("w", 10)), Size: 10})
	wantCode(t, err, "QuotaExceeded")

	// abort releases the quota and the files
	if err := v.e.AbortUpload(v.ctx, v.reload("mp"), u); err != nil {
		t.Fatal(err)
	}
	if c := v.counters(b); c.UploadBytes != 0 {
		t.Fatalf("%+v", c)
	}
	if dirs, _ := v.st.UploadDirs(); len(dirs) != 0 {
		t.Fatal("upload dir left")
	}
	if _, err := v.e.GetUpload(v.ctx, "mp", "k", u.UploadID); !apierr.Is(err, "NoSuchUpload") {
		t.Fatal(err)
	}
	// parts of an unknown upload are refused
	wantCode(t, v.e.AbortUpload(v.ctx, v.reload("mp"), u), "NoSuchUpload")
}

func TestMultipartEncrypted(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("enc", func(b *meta.Bucket) { b.Encryption = meta.EncryptionSSES3 })
	u := v.upload(b, "k")
	if !u.Encrypted {
		t.Fatal("upload must inherit the bucket default")
	}
	p1body := strings.Repeat("s", mib5)
	p1 := v.part(b, u, 1, p1body)
	p2 := v.part(b, u, 2, "end")
	if p1.StoredSize == p1.Size {
		t.Fatal("part files must be stored encrypted")
	}
	res, err := v.complete(b, u, p1, p2)
	if err != nil {
		t.Fatal(err)
	}
	body, o, err := v.get(b, "k", "")
	if err != nil || body != p1body+"end" || !o.SSE || !res.SSE {
		t.Fatalf("%v %+v", err, o)
	}
}

func TestMultipartVersionedAndWriteOnce(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("vm", func(b *meta.Bucket) { b.Versioning = meta.VersioningEnabled })
	v.mustPut(b, "k", "old")
	u := v.upload(b, "k")
	p := v.part(b, u, 1, "new")
	res, err := v.complete(b, u, p)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Versioned || res.S3VersionID == "" {
		t.Fatalf("%+v", res)
	}
	if c := v.counters(b); c.Versions != 2 || c.Objects != 1 {
		t.Fatalf("%+v", c)
	}
	if len(v.evs) != 2 || v.evs[1].Type != EventUpdated {
		t.Fatalf("%+v", v.evs)
	}

	// write-once tokens cannot even start an upload over a visible key
	_, err = v.e.CreateUpload(v.ctx, &CreateUploadRequest{Bucket: v.reload("vm"), Key: "k", WriteOnce: true})
	wantCode(t, err, "AccessDenied")
	// but a key whose latest version is a marker is free
	v.del(b, "k", "")
	if _, err := v.e.CreateUpload(v.ctx, &CreateUploadRequest{Bucket: v.reload("vm"), Key: "k", WriteOnce: true}); err != nil {
		t.Fatal(err)
	}
}

func TestMultipartContentTypeRuleAtPartOne(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("img", func(b *meta.Bucket) { b.AllowedContentTypes = []string{"image/*"} })
	u := v.upload(b, "k")
	_, err := v.e.UploadPart(v.ctx, &PartRequest{Bucket: v.reload("img"), Upload: u, Number: 1, Body: strings.NewReader("plain text"), Size: 10})
	wantCode(t, err, "ContentTypeNotAllowed")
}

func TestExpireUploads(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("mp", nil)
	u := v.upload(b, "k")
	v.part(b, u, 1, "data")
	v.e.Now = func() time0 { return time0Now().Add(200 * hour) }
	n, err := v.e.ExpireUploads(v.ctx, 168*hour)
	if err != nil || n != 1 {
		t.Fatalf("%d %v", n, err)
	}
	if c := v.counters(b); c.UploadBytes != 0 {
		t.Fatalf("%+v", c)
	}
	if dirs, _ := v.st.UploadDirs(); len(dirs) != 0 {
		t.Fatal("upload dir left")
	}
}

func TestUploadPartCopy(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("cp", nil)
	src := v.mustPut(b, "src", strings.Repeat("0123456789", mib5/10+10))
	u := v.upload(b, "dst")
	bk := v.reload("cp")
	p1, err := v.e.CopyPart(v.ctx, &CopyPartRequest{Bucket: bk, Upload: u, Number: 1, Src: src.Obj, Off: 0, Len: mib5})
	if err != nil {
		t.Fatal(err)
	}
	p2, err := v.e.CopyPart(v.ctx, &CopyPartRequest{Bucket: bk, Upload: u, Number: 2, Src: src.Obj, Off: 10, Len: 10})
	if err != nil {
		t.Fatal(err)
	}
	if p1.Size != mib5 || p2.Size != 10 {
		t.Fatalf("%d %d", p1.Size, p2.Size)
	}
	if _, err := v.complete(b, u, p1, p2); err != nil {
		t.Fatal(err)
	}
	body, _, _ := v.get(b, "dst", "")
	whole, _, _ := v.get(b, "src", "")
	if body != whole[:mib5]+whole[10:20] {
		t.Fatal("copied parts differ from the source ranges")
	}
}

func TestUploadPartCopyFromEncryptedSourceEncryptsUpload(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("cp", nil)
	src := v.mustPut(b, "src", strings.Repeat("e", 1000), func(r *PutRequest) { r.SSE = true })
	u := v.upload(b, "dst")
	if u.Encrypted {
		t.Fatal("precondition")
	}
	p, err := v.e.CopyPart(v.ctx, &CopyPartRequest{Bucket: v.reload("cp"), Upload: u, Number: 1, Src: src.Obj, Off: 0, Len: 1000})
	if err != nil {
		t.Fatal(err)
	}
	if p.StoredSize == p.Size || !u.Encrypted {
		t.Fatal("a part copied from an encrypted source must be stored encrypted")
	}
	if _, err := v.complete(b, u, p); err != nil {
		t.Fatal(err)
	}
	_, o, _ := v.get(b, "dst", "")
	if !o.SSE {
		t.Fatal("the completed object must be encrypted")
	}
}
