package pipeline_test

import (
	"crypto/sha256"
	"encoding/base64"
	"io"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/lifecycle"
)

// observer is an after pipeline that records every invocation it gets.
func observer(t *testing.T, n *node, svc *fakeSvc, bucket string, extra map[string]any) {
	t.Helper()
	def := map[string]any{
		"events": []string{"object.created", "object.updated", "object.deleted"},
		"token":  map[string]any{"grants": []any{}},
	}
	for k, v := range extra {
		def[k] = v
	}
	n.createPipe(svc, "watch", "after", def)
	n.attach(bucket, "watch")
}

func TestEventsOperationsAndShapes(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", map[string]any{"versioning": "enabled"})
	c := n.token("bkt", allGrants)
	observer(t, n, svc, "bkt", nil)
	wait := func(count int) []*call {
		t.Helper()
		eventually(t, 10*time.Second, "calls", func() bool { return len(svc.callsOf("watch")) >= count })
		return svc.callsOf("watch")
	}

	// put -> created
	v1 := n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("one")).header.Get("x-amz-version-id")
	got := wait(1)
	if got[0].str("event") != "object.created" || got[0].str("operation") != "put" {
		t.Fatalf("put: %s", got[0].Raw)
	}
	// copy -> updated with copy_source
	n.must(c, 200, "PUT", objPath("bkt", "k"), nil, "x-amz-copy-source", "/bkt/k?versionId="+v1, "x-amz-metadata-directive", "REPLACE", "Content-Type", "text/plain")
	got = wait(2)
	if got[1].str("event") != "object.updated" || got[1].str("operation") != "copy" || got[1].Inv["copy_source"].(map[string]any)["key"] != "k" {
		t.Fatalf("copy: %s", got[1].Raw)
	}
	// multipart -> updated, operation multipart
	u := n.startMultipart(c, "bkt", "k", []byte("multi"))
	if r := u.complete(); r.status != 200 {
		t.Fatalf("complete: %d", r.status)
	}
	got = wait(3)
	if got[2].str("event") != "object.updated" || got[2].str("operation") != "multipart" {
		t.Fatalf("multipart: %s", got[2].Raw)
	}
	// versioned delete -> deleted with the marker
	dr := n.must(c, 204, "DELETE", objPath("bkt", "k"), nil)
	marker := dr.header.Get("x-amz-version-id")
	got = wait(4)
	d := got[3]
	if d.str("event") != "object.deleted" || d.str("operation") != "delete" || d.str("object", "version") != marker ||
		d.Inv["object"].(map[string]any)["delete_marker"] != true || d.Inv["object"].(map[string]any)["size"].(float64) != 5 {
		t.Fatalf("versioned delete: %s", d.Raw)
	}
	// purging the marker brings the key back: created, operation delete_version
	n.must(c, 204, "DELETE", objPath("bkt", "k")+"?versionId="+marker, nil)
	got = wait(5)
	if got[4].str("event") != "object.created" || got[4].str("operation") != "delete_version" {
		t.Fatalf("purge of a marker: %s", got[4].Raw)
	}
	// purging the latest version uncovers an older one: updated
	latest := n.must(c, 200, "HEAD", objPath("bkt", "k"), nil).header.Get("x-amz-version-id")
	n.must(c, 204, "DELETE", objPath("bkt", "k")+"?versionId="+latest, nil)
	got = wait(6)
	if got[5].str("event") != "object.updated" || got[5].str("operation") != "delete_version" {
		t.Fatalf("purge of the latest version: %s", got[5].Raw)
	}
	// tagging, a noncurrent purge, and multipart parts raise no event
	n.must(c, 200, "PUT", objPath("bkt", "k")+"?tagging", []byte(`<Tagging><TagSet><Tag><Key>a</Key><Value>b</Value></Tag></TagSet></Tagging>`))
	time.Sleep(200 * time.Millisecond)
	if n := len(svc.callsOf("watch")); n != 6 {
		t.Fatalf("tagging must raise no event: %d calls", n)
	}
}

func TestEventsDeleteObjectsAndLifecycle(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", map[string]any{"lifecycle": []map[string]any{{"id": "old", "expire_days": 1, "filter": map[string]any{"prefix": "tmp/"}}}})
	c := n.token("bkt", allGrants)
	observer(t, n, svc, "bkt", map[string]any{"events": []string{"object.deleted"}})
	for _, k := range []string{"a", "b", "tmp/old"} {
		n.must(c, 200, "PUT", objPath("bkt", k), []byte("x"))
	}
	n.must(c, 200, "POST", "/bkt?delete", []byte(`<Delete><Object><Key>a</Key></Object><Object><Key>b</Key></Object><Object><Key>missing</Key></Object></Delete>`))
	eventually(t, 10*time.Second, "two delete events", func() bool { return len(svc.callsOf("watch")) == 2 })
	keys := map[string]bool{}
	for _, cl := range svc.callsOf("watch") {
		keys[cl.str("key")] = true
		if cl.str("operation") != "delete" {
			t.Errorf("operation: %s", cl.Raw)
		}
	}
	if !keys["a"] || !keys["b"] {
		t.Fatalf("each deleted key fires its own event: %v", keys)
	}
	// lifecycle expiry of a visible object raises object.deleted
	w := lifecycle.New(n.app.Eng, 100, slog.New(slog.NewTextHandler(io.Discard, nil)), nil)
	w.Now = func() time.Time { return time.Now().Add(72 * time.Hour) }
	if cnt, err := w.RunBucket(t.Context(), "bkt", w.Now().Add(time.Hour)); err != nil || cnt != 1 {
		t.Fatalf("lifecycle: %d %v", cnt, err)
	}
	eventually(t, 10*time.Second, "the lifecycle event", func() bool { return len(svc.callsOf("watch")) == 3 })
	var lc *call
	for _, cl := range svc.callsOf("watch") {
		if cl.str("key") == "tmp/old" {
			lc = cl
		}
	}
	if lc == nil || lc.str("operation") != "lifecycle" || lc.str("actor", "kind") != "lifecycle" {
		t.Fatalf("lifecycle event: %v", lc)
	}
	n.waitRunState("key=tmp/old", "succeeded")
}

// Lifecycle expiry is the owner's policy: it runs no before chain and cannot be vetoed.
func TestLifecycleBypassesBeforeChains(t *testing.T) {
	e := newGate(t, map[string]any{"lifecycle": []map[string]any{{"id": "old", "expire_days": 1}}}, map[string]any{"events": []string{"object.deleted"}}, nil)
	e.svc.on("gate", func(*call) reply { return reply{Status: 422} })
	e.n.must(e.c, 200, "PUT", objPath("bkt", "k"), []byte("x"))
	w := lifecycle.New(e.n.app.Eng, 100, slog.New(slog.NewTextHandler(io.Discard, nil)), nil)
	w.Now = func() time.Time { return time.Now().Add(72 * time.Hour) }
	if cnt, err := w.RunBucket(t.Context(), "bkt", w.Now().Add(time.Hour)); err != nil || cnt != 1 {
		t.Fatalf("lifecycle: %d %v", cnt, err)
	}
	e.n.must(e.c, 404, "GET", objPath("bkt", "k"), nil)
	if len(e.svc.callsOf("gate")) != 0 {
		t.Fatal("lifecycle must not call before chains")
	}
}

func TestBeforeReplacementChecksumAlgorithmIsKept(t *testing.T) {
	e := newGate(t, nil, nil, nil)
	var badDigest, ok int
	e.svc.on("gate", func(cl *call) reply {
		tok, path := cl.bearer(), objPath("bkt", cl.str("key"))
		// a wrong checksum on the replacement is a BadDigest for the service
		badDigest = e.n.s3b(tok, "PUT", path, []byte("NEW BYTES"), "x-amz-checksum-sha256", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=").status
		// a right one, of another algorithm than the original's, is verified
		ok = e.n.s3b(tok, "PUT", path, []byte("NEW BYTES"), "x-amz-checksum-sha256", sha256b64([]byte("NEW BYTES"))).status
		return reply{}
	})
	e.n.must(e.c, 200, "PUT", objPath("bkt", "k"), []byte("old bytes"), "x-amz-checksum-crc32", crc32IEEE([]byte("old bytes")))
	if badDigest != 400 || ok != 200 {
		t.Fatalf("bad digest %d, ok %d", badDigest, ok)
	}
	got := e.n.must(e.c, 200, "GET", objPath("bkt", "k"), nil, "x-amz-checksum-mode", "ENABLED")
	// the stored checksum is the original algorithm's, over the new bytes
	if got.header.Get("x-amz-checksum-crc32") != crc32IEEE([]byte("NEW BYTES")) || got.header.Get("x-amz-checksum-sha256") != "" {
		t.Fatalf("checksum headers: %v", got.header)
	}
	// an object uploaded without a checksum has none after a replacement either
	e.n.must(e.c, 200, "PUT", objPath("bkt", "k2"), []byte("old bytes"))
	got = e.n.must(e.c, 200, "GET", objPath("bkt", "k2"), nil, "x-amz-checksum-mode", "ENABLED")
	if got.header.Get("x-amz-checksum-crc32") != "" || got.header.Get("x-amz-checksum-sha256") != "" {
		t.Fatalf("no checksum was requested: %v", got.header)
	}
}

func TestRetryOfABeforeRunIsAConflict(t *testing.T) {
	e := newGate(t, nil, nil, nil)
	e.svc.on("gate", func(*call) reply { return reply{Status: 422} })
	e.n.s3(e.c, "PUT", objPath("bkt", "k"), []byte("x"))
	r := e.n.waitRunState("pipeline=gate", "rejected")
	e.n.mustAdmin(409, "POST", "/runs/"+r["id"].(string)+"/retry", nil)
	e.n.mustAdmin(409, "POST", "/runs/"+r["id"].(string)+"/cancel", nil)
	e.n.mustAdmin(400, "POST", "/runs/retry", map[string]any{"pipeline": "gate", "stage": "before"})
	if got := e.n.mustAdmin(200, "POST", "/runs/retry", map[string]any{"pipeline": "gate"}); got["requeued"].(float64) != 0 {
		t.Fatalf("bulk retry only touches failed after runs: %v", got)
	}
	_ = strings.TrimSpace
}

func sha256b64(b []byte) string {
	return base64.StdEncoding.EncodeToString(sha256sum(b))
}

func sha256sum(b []byte) []byte { s := sha256.Sum256(b); return s[:] }
