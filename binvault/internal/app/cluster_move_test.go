package app_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/app"
	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// ---- helpers ---------------------------------------------------------------------------------

// startMove asks the cluster, through node n, to move a bucket; it returns the move id.
func startMove(t *testing.T, n *cnode, bucket, to string, extra map[string]any) string {
	t.Helper()
	body := map[string]any{"to": to}
	for k, v := range extra {
		body[k] = v
	}
	out := n.mustAdmin(202, "POST", "/buckets/"+bucket+"/move", body)
	id, _ := out["id"].(string)
	if id == "" || out["bucket"] != bucket || out["role"] != "source" {
		t.Fatalf("the move object: %v", out)
	}
	return id
}

// moveState reads a move as the cluster shows it.
func moveState(n *cnode, id string) (string, map[string]any) {
	code, out := n.admin("GET", "/moves/"+id, nil)
	if code != 200 {
		return fmt.Sprintf("HTTP %d", code), out
	}
	s, _ := out["state"].(string)
	return s, out
}

// waitMove waits until the move is in one of the states.
func waitMove(t *testing.T, n *cnode, id string, d time.Duration, states ...string) map[string]any {
	t.Helper()
	var last map[string]any
	var st string
	deadline := time.Now().Add(d)
	for time.Now().Before(deadline) {
		st, last = moveState(n, id)
		for _, w := range states {
			if st == w {
				return last
			}
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("move %s: state %q after %s, wanted one of %v: %v", id, st, d, states, last)
	return nil
}

// bucketHome reads the home and epoch of a bucket in the catalog of node n.
func bucketHome(t *testing.T, n *cnode, bucket string) (string, int) {
	t.Helper()
	rec, ok := n.app.Cluster().Bucket(bucket)
	if !ok {
		t.Fatalf("%s does not know bucket %s", n.name, bucket)
	}
	return n.app.Cluster().NodeName(rec.Home), int(rec.Epoch)
}

// putKey writes a key through node n and returns its ETag and version id.
func putKey(t *testing.T, n *cnode, cr cred, path string, body []byte, hdr ...string) (etag, version string) {
	t.Helper()
	r := n.must(cr, 200, "PUT", path, body, hdr...)
	return r.header.Get("ETag"), r.header.Get("x-amz-version-id")
}

// A bucket with everything in it moves online: versions and delete markers, encrypted blobs, an
// open multipart upload, tokens, an attachment with queued runs and a running backfill. Writes made
// while the blobs are copied land on the new home; during the freeze writes see 503 SlowDown and
// reads go on; at the cutover everything is paused; afterwards the old home forwards, holds no rows
// and its blobs wait for the collector (spec §8.8).
func TestClusterMoveWithEverything(t *testing.T) {
	f := newFaults()
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i == 2 {
			o.PeerWrap = f.wrap
		}
	})
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	svc := newFsvc(t)
	ctx := context.Background()

	// the bucket: versioned and encrypted, with a paused after pipeline (so runs queue up)
	a.mustAdmin(201, "POST", "/pipelines?wait=replicated", pipeDef("thumbs", "after", svc.url("thumbs"), a.s3URL,
		map[string]any{"paused": true, "limits": map[string]any{"max_concurrency": 1}}))
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{
		"name": "photos", "home": "b", "versioning": "enabled", "encryption": "sse-s3", "quota_bytes": 1 << 30,
		"cors": []map[string]any{{"allowed_origins": []string{"https://app.example.com"}, "allowed_methods": []string{"GET"}}},
	})
	a.mustAdmin(200, "PUT", "/buckets/photos/pipelines", map[string]any{"items": []map[string]any{{"pipeline": "thumbs", "enabled": true}}})
	cr := a.token("photos", all, nil)
	ro := a.token("photos", []map[string]any{{"actions": []string{"read", "list"}}}, nil)

	// data: 40 keys with two versions each, tags, metadata, five bigger bodies, delete markers
	bodies := map[string][]byte{}
	for i := 0; i < 40; i++ {
		key := fmt.Sprintf("/photos/obj/%02d", i)
		size := 100 + i*13
		if i%8 == 0 {
			size = 200 << 10
		}
		v1 := make([]byte, size)
		_, _ = rand.Read(v1)
		putKey(t, a, cr, key, v1, "Content-Type", "image/png", "x-amz-meta-n", fmt.Sprint(i))
		v2 := append([]byte("v2-"), v1[:size/2]...)
		putKey(t, b, cr, key, v2, "Content-Type", "image/png", "x-amz-meta-n", fmt.Sprint(i), "x-amz-tagging", "kind=photo&n="+fmt.Sprint(i))
		bodies[key] = v2
	}
	for _, i := range []int{3, 11, 25} {
		a.must(cr, 204, "DELETE", fmt.Sprintf("/photos/obj/%02d", i), nil)
		delete(bodies, fmt.Sprintf("/photos/obj/%02d", i))
	}

	// an open multipart upload: one part of 5 MiB and a short last one, not completed
	idRe := regexp.MustCompile(`<UploadId>([^<]+)</UploadId>`)
	init := a.must(cr, 200, "POST", "/photos/mp/big?uploads", nil)
	uploadID := idRe.FindStringSubmatch(string(init.body))[1]
	part1 := make([]byte, 5<<20)
	_, _ = rand.Read(part1)
	part2 := []byte("the short last part")
	p1 := a.must(cr, 200, "PUT", "/photos/mp/big?partNumber=1&uploadId="+uploadID, part1).header.Get("ETag")
	p2 := a.must(cr, 200, "PUT", "/photos/mp/big?partNumber=2&uploadId="+uploadID, part2).header.Get("ETag")

	// queued runs (the pipeline is paused) and a backfill that cannot finish
	eventually(t, 10*time.Second, "runs to queue up", func() bool {
		return len(items(t, b.mustAdmin(200, "GET", "/runs?bucket=photos&state=queued&limit=500", nil))) >= 40
	})
	bf := a.mustAdmin(202, "POST", "/backfills", map[string]any{"bucket": "photos", "pipeline": "thumbs"})
	bfID := bf["id"].(string)

	before := listVersions(t, a, cr, "photos")
	keysBefore := listKeys(t, a, cr, "photos")
	queuedBefore := len(items(t, b.mustAdmin(200, "GET", "/runs?bucket=photos&state=queued&limit=500", nil)))
	if len(before) < 80 {
		t.Fatalf("only %d versions", len(before))
	}

	// the stages of the move are held where the test wants to look at them: the rows are slow
	// (the freeze lasts), the activation gets no answer until released
	release := make(chan struct{})
	f.set("rows", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
		time.Sleep(1200 * time.Millisecond)
		next.ServeHTTP(w, r)
	})
	f.set("activate", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
		select {
		case <-release:
			next.ServeHTTP(w, r)
		default:
			faultGarbage(w)
		}
	})

	id := startMove(t, a, "photos", "c", map[string]any{"max_bytes_per_second": 2 << 20})

	// writes during the blob passes succeed, and survive the move: new keys, an overwrite, a delete
	// marker, a tag change and the purge of one old version
	waitMove(t, a, id, 10*time.Second, "copying")
	during := map[string]string{}
	for i := 0; i < 5; i++ {
		key := fmt.Sprintf("/photos/during/%d", i)
		_, v := putKey(t, a, cr, key, []byte(fmt.Sprintf("written during the passes %d", i)))
		during[key] = v
		bodies[key] = []byte(fmt.Sprintf("written during the passes %d", i))
	}
	var purged vrec
	for _, v := range before {
		if v.Key == "obj/14" && !v.Latest {
			purged = v
		}
	}
	a.must(cr, 204, "DELETE", "/photos/obj/10", nil)
	delete(bodies, "/photos/obj/10")
	overwritten := []byte("overwritten during the passes")
	putKey(t, b, cr, "/photos/obj/20", overwritten)
	bodies["/photos/obj/20"] = overwritten
	a.must(cr, 200, "PUT", "/photos/obj/12?tagging", []byte(`<Tagging><TagSet><Tag><Key>stage</Key><Value>during</Value></Tag></TagSet></Tagging>`))
	a.must(cr, 204, "DELETE", "/photos/obj/14?versionId="+purged.Version, nil)

	// the freeze: writes meet 503 SlowDown with Retry-After, reads continue, admin changes are refused
	waitMove(t, a, id, 30*time.Second, "frozen")
	for _, n := range []*cnode{a, b} {
		r := n.s3(cr, "PUT", "/photos/during/frozen", []byte("x"))
		if r.status != 503 || r.code() != "SlowDown" || r.header.Get("Retry-After") != "1" {
			t.Fatalf("a write to a frozen bucket through %s: %d %s Retry-After=%q", n.name, r.status, r.code(), r.header.Get("Retry-After"))
		}
		if r := n.must(cr, 200, "GET", "/photos/obj/07", nil); !bytes.Equal(r.body, bodies["/photos/obj/07"]) {
			t.Fatalf("a read of a frozen bucket through %s differs", n.name)
		}
	}
	for _, call := range [][3]any{{"PATCH", "/buckets/photos", map[string]any{"max_objects": 100000}}, {"POST", "/buckets/photos/tokens", map[string]any{"name": "late", "grants": all}},
		{"DELETE", "/buckets/photos?force=true", nil}, {"PUT", "/buckets/photos/pipelines", map[string]any{"items": []map[string]any{}}},
		{"POST", "/backfills", map[string]any{"bucket": "photos", "pipeline": "thumbs"}}} {
		code, out, hdr := a.adminHdr(call[0].(string), call[1].(string), call[2])
		if code != 503 || out["error"] != "unavailable" || hdr.Get("Retry-After") != "1" {
			t.Fatalf("%v %v on a frozen bucket: %d %v %v", call[0], call[1], code, out, hdr)
		}
	}
	// a bulk call over the bucket's runs is refused by its home, which the fan-out names in `partial`
	if code, out := a.admin("POST", "/runs/cancel", map[string]any{"bucket": "photos"}); code != 200 || out["cancelled"].(float64) != 0 || fmt.Sprint(out["partial"]) != "[b]" {
		t.Fatalf("a bulk cancel of a frozen bucket's runs: %d %v", code, out)
	}
	// no second move of a bucket that is moving
	if code, out := a.admin("POST", "/buckets/photos/move", map[string]any{"to": "c"}); code != 409 {
		t.Fatalf("a second move: %d %v", code, out)
	}

	// the cutover: nothing is served, reads included
	waitMove(t, a, id, 30*time.Second, "cutover")
	for _, n := range []*cnode{a, b} {
		r := n.s3(cr, "GET", "/photos/obj/07", nil)
		if r.status != 503 || r.code() != "SlowDown" {
			t.Fatalf("a read of a paused bucket through %s: %d %s", n.name, r.status, r.code())
		}
	}
	if st, _ := moveState(c, id); st != "cutover" { // the target's own view of the move, fanned out: the source's record wins
		t.Fatalf("the move through c: %s", st)
	}
	close(release)
	mv := waitMove(t, a, id, 30*time.Second, "done", "failed", "cancelled")
	if mv["state"] != "done" || mv["role"] != "source" || mv["from"] != "b" || mv["to"] != "c" || mv["error"] != nil || mv["finished_at"] == nil || mv["epoch"].(float64) != 1 {
		t.Logf("b logs:\n%s", b.logs.String())
		t.Fatalf("the move ended: %v", mv)
	}
	if mv["bytes_copied"].(float64) < 5<<20 || mv["objects_copied"].(float64) < 80 {
		t.Fatalf("progress: %v", mv)
	}

	// everything is on c, whichever node is asked
	for _, n := range tc.nodes {
		n := n
		eventually(t, 5*time.Second, n.name+" to see the new home", func() bool {
			h, e := bucketHome(t, n, "photos")
			return h == "c" && e == 1
		})
		after := listVersions(t, n, cr, "photos")
		// the versions of before, but the purged one, plus the five new keys, a delete marker and a
		// new version of obj/20 (whose old latest version is not latest any more, as is obj/10's)
		if want := len(before) + len(during) + 2 - 1; len(after) != want {
			t.Fatalf("through %s: %d versions, want %d", n.name, len(after), want)
		}
		byVersion := map[string]vrec{}
		for _, v := range after {
			byVersion[v.Key+"@"+v.Version] = v
		}
		for _, v := range before {
			got, ok := byVersion[v.Key+"@"+v.Version]
			if v == purged {
				if ok {
					t.Fatalf("through %s: the purged version %s is back", n.name, v)
				}
				continue
			}
			if v.Key == "obj/10" || v.Key == "obj/20" {
				v.Latest = false
			}
			if !ok || got != v {
				t.Fatalf("through %s: version %s became %v", n.name, v, got)
			}
		}
		for key, v := range during {
			if got, ok := byVersion[strings.TrimPrefix(key, "/photos/")+"@"+v]; !ok || !got.Latest {
				t.Fatalf("through %s: the write %s made during the passes: %v", n.name, key, got)
			}
		}
		if keys := listKeys(t, n, cr, "photos"); len(keys) != len(keysBefore)+len(during)-1 { // obj/10 is hidden by its delete marker
			t.Fatalf("through %s: %d keys", n.name, len(keys))
		}
		if r := n.s3(cr, "GET", "/photos/obj/10", nil); r.status != 404 {
			t.Fatalf("through %s: a key deleted during the passes: %d", n.name, r.status)
		}
		for key, want := range bodies {
			r := n.must(cr, 200, "GET", key, nil)
			if !bytes.Equal(r.body, want) || r.header.Get("x-amz-server-side-encryption") != "AES256" || r.header.Get("x-binvault-node") != "c" {
				t.Fatalf("through %s: %s differs (encryption %q, served by %q)", n.name, key, r.header.Get("x-amz-server-side-encryption"), r.header.Get("x-binvault-node"))
			}
		}
		if r := n.must(cr, 200, "HEAD", "/photos/obj/05", nil); r.header.Get("x-amz-meta-n") != "5" || r.header.Get("Content-Type") != "image/png" {
			t.Fatalf("metadata through %s: %v", n.name, r.header)
		}
		// tokens made before the move work through every entry node, with the same grants
		n.must(ro, 200, "GET", "/photos/obj/07", nil)
		if r := n.s3(ro, "PUT", "/photos/denied", []byte("x")); r.status != 403 {
			t.Fatalf("the read-only token wrote through %s: %d", n.name, r.status)
		}
	}
	if r := a.must(cr, 200, "GET", "/photos/obj/05?tagging", nil); !strings.Contains(string(r.body), "<Key>kind</Key>") {
		t.Fatalf("tags: %s", r.body)
	}
	if r := a.must(cr, 200, "GET", "/photos/obj/12?tagging", nil); !strings.Contains(string(r.body), "<Value>during</Value>") || strings.Contains(string(r.body), "<Key>kind</Key>") {
		t.Fatalf("a tag change made during the passes: %s", r.body)
	}

	// the settings travelled; the catalog says c, epoch 1
	got := a.mustAdmin(200, "GET", "/buckets/photos", nil)
	if got["home"] != "c" || got["versioning"] != "enabled" || got["encryption"] != "sse-s3" || got["quota_bytes"].(float64) != 1<<30 || len(got["cors"].([]any)) != 1 {
		t.Fatalf("the bucket after the move: %v", got)
	}
	list := a.mustAdmin(200, "GET", "/buckets", nil)
	if e := items(t, list)[0]; e["home"] != "c" || e["epoch"].(float64) != 1 {
		t.Fatalf("catalog entry: %v", e)
	}

	// the open multipart upload completes on the new home, from the part files that moved
	r := a.must(cr, 200, "GET", "/photos?uploads", nil)
	if !strings.Contains(string(r.body), uploadID) {
		t.Fatalf("the open upload is not listed after the move: %s", r.body)
	}
	if r := a.must(cr, 200, "GET", "/photos/mp/big?uploadId="+uploadID, nil); !strings.Contains(string(r.body), strings.Trim(p1, `"`)) || !strings.Contains(string(r.body), strings.Trim(p2, `"`)) {
		t.Fatalf("ListParts after the move: %s", r.body)
	}
	complete := fmt.Sprintf(`<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>%s</ETag></Part><Part><PartNumber>2</PartNumber><ETag>%s</ETag></Part></CompleteMultipartUpload>`, p1, p2)
	a.must(cr, 200, "POST", "/photos/mp/big?uploadId="+uploadID, []byte(complete))
	if r := b.must(cr, 200, "GET", "/photos/mp/big", nil); !bytes.Equal(r.body, append(append([]byte(nil), part1...), part2...)) {
		t.Fatalf("the object assembled on the new home differs (%d bytes)", len(r.body))
	}

	// nothing is reported: no orphan on the old home, no missing bucket, no conflicting catalog write
	tc.noAlarms()

	// a request that an entry node forwarded to the old home with the epoch it knew gets 421 and the
	// name of the new home (spec §8.4); the entry node then asks again there
	req, _ := http.NewRequest("GET", b.peerURL+"/photos/obj/07", nil)
	req.Header.Set(cluster.HeaderPeerKey, tc.key)
	req.Header.Set(cluster.HeaderOrigin, a.nodeID())
	req.Header.Set("X-Binvault-Epoch", "0")
	if res := httpDo(t, req); res.status != 421 || res.header.Get("X-Binvault-Home") != "c" {
		t.Fatalf("a request for the old epoch at the old home: %d %v", res.status, res.header)
	}

	// the old home holds no rows, no part files, and its blobs wait for the collector
	if _, err := b.app.DB.Read().GetBucket(ctx, "photos"); err == nil {
		t.Fatal("the old home still has the bucket row")
	}
	if n, _ := b.app.DB.Read().GCPending(ctx); n < 80 {
		t.Fatalf("the old home's blobs waiting for the collector: %d", n)
	}
	if ents, _ := os.ReadDir(filepath.Join(b.dir, "uploads")); len(ents) != 0 {
		t.Fatalf("the old home keeps %d upload directories", len(ents))
	}
	if q, err := b.app.DB.Read().CountRuns(ctx, meta.RunFilter{Bucket: "photos"}); err != nil || q != 0 {
		t.Fatalf("the old home keeps %d runs (%v)", q, err)
	}
	var tokens int64
	if tokens, _ = b.app.DB.Read().CountTokens(ctx, "photos"); tokens != 0 {
		t.Fatalf("the old home keeps %d tokens", tokens)
	}
	// ... but the move is recorded on both nodes
	if recs := moveRecords(t, b, "source"); len(recs) != 1 || recs[0]["state"] != "done" {
		t.Fatalf("the source's records: %v", recs)
	}
	if recs := moveRecords(t, c, "target"); len(recs) != 1 || recs[0]["state"] != "activated" || recs[0]["role"] != "target" {
		t.Fatalf("the target's records: %v", recs)
	}
	// the queued runs and the backfill continue on the new home
	if q := len(items(t, c.mustAdmin(200, "GET", "/runs?bucket=photos&state=queued&limit=500", nil))); q < queuedBefore {
		t.Fatalf("%d queued runs on c, %d before the move", q, queuedBefore)
	}
	runs := items(t, a.mustAdmin(200, "GET", "/runs?bucket=photos&limit=1", nil))
	if len(runs) != 1 || runs[0]["node"] != "c" {
		t.Fatalf("runs after the move: %v", runs)
	}
	a.mustAdmin(200, "PATCH", "/pipelines/thumbs?wait=replicated", map[string]any{"paused": false})
	eventually(t, 30*time.Second, "the queued runs to be done on c", func() bool {
		return len(items(t, c.mustAdmin(200, "GET", "/runs?bucket=photos&state=queued&limit=500", nil))) == 0 &&
			len(items(t, c.mustAdmin(200, "GET", "/runs?bucket=photos&state=running&limit=500", nil))) == 0
	})
	// (a run whose key was overwritten meanwhile is skipped: the service saw the others)
	if n := len(svc.callsOf("thumbs")); n < 40 {
		t.Fatalf("the service was called %d times", n)
	}
	done := len(items(t, c.mustAdmin(200, "GET", "/runs?bucket=photos&state=succeeded&limit=500", nil))) +
		len(items(t, c.mustAdmin(200, "GET", "/runs?bucket=photos&state=skipped&limit=500", nil)))
	if done < queuedBefore {
		t.Fatalf("%d runs finished on c, %d were queued before the move", done, queuedBefore)
	}
	eventually(t, 30*time.Second, "the backfill to complete on c", func() bool {
		return b.mustAdmin(200, "GET", "/backfills/"+bfID, nil)["state"] == "completed"
	})
	// (the backfill's own runs, queued as it walked, drain too)
	eventually(t, 30*time.Second, "the backfill's runs to be done", func() bool {
		return len(items(t, a.mustAdmin(200, "GET", "/runs?bucket=photos&state=queued&limit=500", nil))) == 0 &&
			len(items(t, a.mustAdmin(200, "GET", "/runs?bucket=photos&state=running&limit=500", nil))) == 0
	})
	// and the node's counters: the metrics of the move
	if m := b.metric(t, "binvault_moves_total"); !strings.Contains(m, `outcome="done"`) {
		t.Fatalf("binvault_moves_total: %q", m)
	}
	if m := b.metric(t, "binvault_move_freeze_seconds_count"); !strings.Contains(m, "1") {
		t.Fatalf("binvault_move_freeze_seconds: %q", m)
	}
}
