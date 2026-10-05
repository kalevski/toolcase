package lifecycle

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/seal"
	"github.com/kalevski/toolcase/binvault/internal/store"
)

type env struct {
	t   *testing.T
	ctx context.Context
	e   *engine.Engine
	w   *Worker
	evs []*engine.Event
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
	ring, _ := seal.New(bytes.Repeat([]byte{9}, 32))
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	e := engine.New(db, st, ring, engine.Config{MaxObjectBytes: 1 << 30}, log)
	v := &env{t: t, ctx: ctx, e: e}
	e.Hooks.Outbox = func(ctx context.Context, tx *meta.Tx, ev *engine.Event) error { v.evs = append(v.evs, ev); return nil }
	v.w = New(e, 2, log, nil) // tiny batches exercise the paging
	return v
}

func (v *env) bucket(name string, mod func(*meta.Bucket)) {
	v.t.Helper()
	b := &meta.Bucket{Name: name}
	mod(b)
	if err := v.e.DB.Update(v.ctx, func(tx *meta.Tx) error { return tx.CreateBucket(v.ctx, b) }); err != nil {
		v.t.Fatal(err)
	}
}

func (v *env) put(bucket, key, body string, tags map[string]string) *meta.Object {
	v.t.Helper()
	b, _ := v.e.Bucket(v.ctx, bucket)
	r, err := v.e.Put(v.ctx, &engine.PutRequest{Bucket: b, Key: key, Body: strings.NewReader(body), Size: int64(len(body)), Tags: tags})
	if err != nil {
		v.t.Fatal(err)
	}
	return r.Obj
}

func (v *env) run(days int) int {
	v.t.Helper()
	v.w.Now = func() time.Time { return time.Now().Add(time.Duration(days) * 24 * time.Hour) }
	n, err := v.w.Run(v.ctx, v.w.Now().Add(time.Hour))
	if err != nil {
		v.t.Fatal(err)
	}
	return n
}

func (v *env) keys(bucket string) []string {
	res, err := v.e.DB.Read().ListLatest(v.ctx, bucket, meta.ListOptions{MaxKeys: 1000})
	if err != nil {
		v.t.Fatal(err)
	}
	var out []string
	for _, en := range res.Entries {
		out = append(out, en.Obj.Key)
	}
	return out
}

func rules(rs ...meta.LifecycleRule) func(*meta.Bucket) {
	return func(b *meta.Bucket) { b.Lifecycle = rs }
}

func TestExpireUnversioned(t *testing.T) {
	v := newEnv(t)
	v.bucket("b", rules(meta.LifecycleRule{ID: "scratch", ExpireDays: 2, Filter: meta.LifecycleFilter{Prefix: "tmp/"}}))
	for _, k := range []string{"tmp/a", "tmp/b", "tmp/c", "keep/x"} {
		v.put("b", k, "data", nil)
	}
	if n := v.run(1); n != 0 {
		t.Fatalf("nothing is old enough yet, applied %d", n)
	}
	v.evs = nil
	if n := v.run(3); n != 3 {
		t.Fatalf("applied %d, want 3", n)
	}
	if got := v.keys("b"); len(got) != 1 || got[0] != "keep/x" {
		t.Fatalf("left %v", got)
	}
	// each expiry of a visible object raises object.deleted with operation=lifecycle
	if len(v.evs) != 3 || v.evs[0].Type != engine.EventDeleted || v.evs[0].Operation != "lifecycle" || v.evs[0].Actor.Kind != "lifecycle" {
		t.Fatalf("events %+v", v.evs)
	}
	b, _ := v.e.Bucket(v.ctx, "b")
	if b.Objects != 1 || b.Versions != 1 {
		t.Fatalf("counters %+v", b.Counters)
	}
}

func TestExpireFilters(t *testing.T) {
	v := newEnv(t)
	v.bucket("b", rules(meta.LifecycleRule{ID: "r", ExpireDays: 1, Filter: meta.LifecycleFilter{
		Tags: map[string]string{"temp": "yes"}, MinSize: 3, MaxSize: 10}}))
	v.put("b", "match", "12345", map[string]string{"temp": "yes"})
	v.put("b", "no-tag", "12345", nil)
	v.put("b", "too-small", "1", map[string]string{"temp": "yes"})
	v.put("b", "too-big", strings.Repeat("x", 11), map[string]string{"temp": "yes"})
	if n := v.run(2); n != 1 {
		t.Fatalf("applied %d", n)
	}
	if got := strings.Join(v.keys("b"), ","); got != "no-tag,too-big,too-small" {
		t.Fatal(got)
	}
}

func TestVersionedExpiryAddsMarkerAndNoncurrentCleanup(t *testing.T) {
	v := newEnv(t)
	v.bucket("b", func(b *meta.Bucket) {
		b.Versioning = meta.VersioningEnabled
		b.Lifecycle = []meta.LifecycleRule{
			{ID: "expire", ExpireDays: 5},
			{ID: "history", NoncurrentDays: 10, NoncurrentKeep: 1, ExpireDeleteMarkers: true},
		}
	})
	for i := 0; i < 4; i++ {
		v.put("b", "k", strings.Repeat("v", i+1), nil)
	}
	// day 6: the current version expires -> a delete marker; nothing noncurrent is old enough
	if n := v.run(6); n != 1 {
		t.Fatalf("applied %d", n)
	}
	b, _ := v.e.Bucket(v.ctx, "b")
	if b.Versions != 5 || b.DeleteMarkers != 1 || b.Objects != 0 {
		t.Fatalf("%+v", b.Counters)
	}
	// day 11 (+): noncurrent versions older than 10 days go, keeping the 1 newest
	// noncurrent one; the marker stays because older versions remain
	v.run(11)
	b, _ = v.e.Bucket(v.ctx, "b")
	vs, _ := v.e.DB.Read().VersionsOf(v.ctx, "b", "k")
	if len(vs) != 2 { // the marker + one kept noncurrent version
		t.Fatalf("versions left: %d (%+v)", len(vs), b.Counters)
	}
	if !vs[0].DeleteMarker || vs[1].Size != 4 {
		t.Fatalf("expected the marker and the newest old version, got %+v / %+v", vs[0], vs[1])
	}
	// noncurrent_keep protects only while the version is newer than the rest;
	// once the kept version is itself removed manually, the lone marker expires
	eng := v.e
	if _, err := eng.Delete(v.ctx, &engine.DeleteRequest{Bucket: "b", Key: "k", VersionID: vs[1].Version}); err != nil {
		t.Fatal(err)
	}
	if n := v.run(12); n != 1 {
		t.Fatalf("lone marker not removed: %d", n)
	}
	b, _ = v.e.Bucket(v.ctx, "b")
	if b.Versions != 0 || b.DeleteMarkers != 0 || b.Bytes != 0 {
		t.Fatalf("%+v", b.Counters)
	}
}

func TestOverwriteBetweenSelectionAndActionIsNotExpired(t *testing.T) {
	v := newEnv(t)
	v.bucket("b", rules(meta.LifecycleRule{ID: "r", ExpireDays: 1}))
	old := v.put("b", "k", "old", nil)
	// the worker selected `old` (seq), then the key was overwritten
	v.put("b", "k", "fresh", nil)
	n, err := v.e.ExpireBatch(v.ctx, "b", []engine.ExpireItem{{Key: "k", Seq: old.Seq}})
	if err != nil || n != 0 {
		t.Fatalf("a changed row must be skipped: %d %v", n, err)
	}
	if got := v.keys("b"); len(got) != 1 {
		t.Fatalf("the fresh object was expired: %v", got)
	}
}

func TestAbortMultipart(t *testing.T) {
	v := newEnv(t)
	v.bucket("b", rules(meta.LifecycleRule{ID: "mp", AbortMultipartDays: 1}))
	b, _ := v.e.Bucket(v.ctx, "b")
	u, err := v.e.CreateUpload(v.ctx, &engine.CreateUploadRequest{Bucket: b, Key: "big"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := v.e.UploadPart(v.ctx, &engine.PartRequest{Bucket: b, Upload: u, Number: 1, Body: strings.NewReader("part"), Size: 4}); err != nil {
		t.Fatal(err)
	}
	if n := v.run(0); n != 0 {
		t.Fatal("too early")
	}
	if n := v.run(2); n != 1 {
		t.Fatalf("applied %d", n)
	}
	if c, _ := v.e.DB.Read().CountOpenUploads(v.ctx, "b"); c != 0 {
		t.Fatal("upload still open")
	}
	b, _ = v.e.Bucket(v.ctx, "b")
	if b.UploadBytes != 0 {
		t.Fatalf("%+v", b.Counters)
	}
}

func TestBacklogLargerThanOneBatch(t *testing.T) {
	v := newEnv(t)
	v.bucket("b", rules(meta.LifecycleRule{ID: "r", ExpireDays: 1}))
	for i := 0; i < 25; i++ {
		v.put("b", "k"+string(rune('a'+i)), "x", nil)
	}
	if n := v.run(2); n != 25 { // batch size 2: thirteen transactions
		t.Fatalf("applied %d", n)
	}
	if got := v.keys("b"); len(got) != 0 {
		t.Fatal(got)
	}
}
