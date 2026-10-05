package app_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// ---- a fake pipeline service ---------------------------------------------------------

type fcall struct {
	pipeline string
	inv      map[string]any
}

func (c *fcall) s3(field string) string {
	m, _ := c.inv["s3"].(map[string]any)
	s, _ := m[field].(string)
	return s
}

func (c *fcall) str(field string) string { s, _ := c.inv[field].(string); return s }

type fsvc struct {
	srv   *httptest.Server
	mu    sync.Mutex
	calls []*fcall
	on    map[string]func(*fcall) int
}

func newFsvc(t *testing.T) *fsvc {
	t.Helper()
	s := &fsvc{on: map[string]func(*fcall) int{}}
	s.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		c := &fcall{pipeline: strings.TrimPrefix(r.URL.Path, "/hook/")}
		_ = json.Unmarshal(raw, &c.inv)
		s.mu.Lock()
		s.calls = append(s.calls, c)
		h := s.on[c.pipeline]
		s.mu.Unlock()
		status := 204
		if h != nil {
			status = h(c)
		}
		w.WriteHeader(status)
	}))
	t.Cleanup(s.srv.Close)
	return s
}

func (s *fsvc) url(p string) string { return s.srv.URL + "/hook/" + p }

func (s *fsvc) callsOf(p string) []*fcall {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []*fcall
	for _, c := range s.calls {
		if c.pipeline == p {
			out = append(out, c)
		}
	}
	return out
}

// bearerDo makes a request with a pipeline token, as a service without an SDK does.
func bearerDo(endpoint, bearer, method, path string, body []byte) (int, []byte) {
	req, _ := http.NewRequest(method, endpoint+path, bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+bearer)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, nil
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	return res.StatusCode, raw
}

func pipeDef(name, stage, url, s3 string, extra map[string]any) map[string]any {
	def := map[string]any{
		"name": name, "stage": stage,
		"service": map[string]any{"url": url, "s3_endpoint": s3},
	}
	if stage == "after" {
		def["token"] = map[string]any{"grants": []map[string]any{{"actions": []string{"read", "write"}, "keys": []string{"{key}", "thumb/{key}"}}}}
	}
	for k, v := range extra {
		def[k] = v
	}
	return def
}

// Pipeline definitions are catalog data: created on one node, attached on the home,
// run there, and a service that reaches the cluster through another node's endpoint is
// forwarded to the bucket's home, where its token and the staged object live (spec §8.7).
func TestClusterPipelines(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	svc := newFsvc(t)

	// the definition is created on a and exists everywhere once replicated
	gate := pipeDef("gate", "before", svc.url("gate"), a.s3URL, map[string]any{
		"token": map[string]any{"grants": []map[string]any{{"actions": []string{"read"}, "keys": []string{"{key}"}}}},
	})
	thumbs := pipeDef("thumbs", "after", svc.url("thumbs"), c.s3URL, nil) // a service that goes through c
	a.mustAdmin(201, "POST", "/pipelines?wait=replicated", gate)
	out := a.mustAdmin(201, "POST", "/pipelines?wait=replicated", thumbs)
	if out["revision"].(float64) != 1 {
		t.Fatalf("revision: %v", out)
	}
	for _, n := range tc.nodes {
		got := n.mustAdmin(200, "GET", "/pipelines/thumbs", nil)
		if got["name"] != "thumbs" || got["stage"] != "after" || len(got["attached_to"].([]any)) != 0 {
			t.Fatalf("%s: %v", n.name, got)
		}
		l := n.mustAdmin(200, "GET", "/pipelines", nil)
		if len(items(t, l)) != 2 {
			t.Fatalf("%s lists %d pipelines", n.name, len(items(t, l)))
		}
	}
	// a duplicate is 409 from any node, an edit on another node is a new revision everywhere
	if code, _ := c.admin("POST", "/pipelines", gate); code != 409 {
		t.Fatalf("duplicate pipeline: %d", code)
	}
	ed := c.mustAdmin(200, "PATCH", "/pipelines/thumbs?wait=replicated", map[string]any{"description": "made on c"})
	if ed["revision"].(float64) != 2 || ed["description"] != "made on c" {
		t.Fatalf("PATCH on c: %v", ed)
	}
	if code, out := b.admin("PATCH", "/pipelines/thumbs", map[string]any{"description": "stale"}, "If-Match", `"1"`); code != 412 {
		t.Fatalf("a stale If-Match: %d %v", code, out)
	}
	if got := a.mustAdmin(200, "GET", "/pipelines/thumbs", nil); got["description"] != "made on c" || got["revision"].(float64) != 2 {
		t.Fatalf("a after the edit on c: %v", got)
	}

	// attach on the home, through another node
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "pbkt", "home": "b"})
	att := c.mustAdmin(200, "PUT", "/buckets/pbkt/pipelines", map[string]any{"items": []map[string]any{
		{"pipeline": "gate", "enabled": true}, {"pipeline": "thumbs", "enabled": true},
	}})
	if len(att["items"].([]any)) != 2 {
		t.Fatalf("attachments: %v", att)
	}
	// the bucket's catalog entry names its pipelines: every node sees attached_to
	for _, n := range tc.nodes {
		n := n
		eventually(t, 5*time.Second, n.name+" to see the attachment names", func() bool {
			rec, ok := n.app.Cluster().Bucket("pbkt")
			return ok && fmt.Sprint(rec.Pipelines) == "[gate thumbs]"
		})
		if got := n.mustAdmin(200, "GET", "/pipelines/thumbs", nil); fmt.Sprint(got["attached_to"]) != "[pbkt]" {
			t.Fatalf("%s: attached_to %v", n.name, got["attached_to"])
		}
	}
	// the delete guard works from any node, off the catalog
	if code, out := a.admin("DELETE", "/pipelines/thumbs", nil); code != 409 || !strings.Contains(fmt.Sprint(out["detail"]), "pbkt") {
		t.Fatalf("delete of an attached pipeline: %d %v", code, out)
	}
	if code, _ := a.admin("DELETE", "/pipelines/nosuch", nil); code != 404 {
		t.Fatalf("delete of an unknown pipeline: %d", code)
	}

	cr := a.token("pbkt", all, nil)
	// the before gate runs on b, reads the staged object through a (forwarded to b: the
	// token and the staged object live there) and rejects what contains "bad"
	svc.on["gate"] = func(call *fcall) int {
		code, body := bearerDo(call.s3("endpoint"), call.s3("bearer"), "GET", "/"+call.str("bucket")+"/"+call.str("key"), nil)
		if code != 200 {
			return 500
		}
		if bytes.Contains(body, []byte("bad")) {
			return 422
		}
		return 204
	}
	if r := c.s3(cr, "PUT", "/pbkt/doc.txt", []byte("a bad file")); r.status != 422 || r.code() != "PipelineRejected" {
		t.Fatalf("a rejected upload through c: %d %s %s", r.status, r.code(), r.body)
	}
	if r := a.s3(cr, "GET", "/pbkt/doc.txt", nil); r.status != 404 {
		t.Fatalf("a rejected object is visible: %d", r.status)
	}
	// the after pipeline reads the object and writes a derivative, both through c
	svc.on["thumbs"] = func(call *fcall) int {
		code, body := bearerDo(call.s3("endpoint"), call.s3("bearer"), "GET", "/"+call.str("bucket")+"/"+call.str("key"), nil)
		if code != 200 {
			return 500
		}
		code, _ = bearerDo(call.s3("endpoint"), call.s3("bearer"), "PUT", "/"+call.str("bucket")+"/thumb/"+call.str("key"), bytes.ToUpper(body))
		if code != 200 {
			return 500
		}
		return 204
	}
	if r := c.s3(cr, "PUT", "/pbkt/pic.txt", []byte("a good file")); r.status != 200 {
		t.Fatalf("an accepted upload through c: %d %s", r.status, r.code())
	}
	eventually(t, 10*time.Second, "the derivative written by the after pipeline", func() bool {
		r := a.s3(cr, "GET", "/pbkt/thumb/pic.txt", nil)
		return r.status == 200 && string(r.body) == "A GOOD FILE"
	})
	// the gate saw the rejected upload, the accepted one and the derivative the after pipeline wrote
	if n := len(svc.callsOf("gate")); n != 3 {
		t.Fatalf("the gate was called %d times", n)
	}

	// the runs are the home's: listed through any node, naming b
	for _, n := range []*cnode{a, c} {
		runs := items(t, n.mustAdmin(200, "GET", "/runs?bucket=pbkt&stage=after", nil))
		if len(runs) == 0 || runs[0]["node"] != "b" || runs[0]["pipeline"] != "thumbs" {
			t.Fatalf("runs through %s: %v", n.name, runs)
		}
	}
	// nothing was executed on a or c
	for _, n := range []*cnode{a, c} {
		if q, err := n.app.DB.Read().CountRuns(n.ctx, meta.RunFilter{}); err != nil || q != 0 {
			t.Fatalf("%s holds %d runs of a bucket it does not home (%v)", n.name, q, err)
		}
	}
}

// A pipeline deleted with ?detach=true: every home drops its attachments and cancels the
// queued runs (pipeline_removed); one created again under the same name is a new
// pipeline whose generation the old attachments do not match (spec §8.5, §8.7).
func TestClusterPipelineGenerations(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	svc := newFsvc(t)

	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "gbkt", "home": "b"})
	a.mustAdmin(201, "POST", "/pipelines?wait=replicated", pipeDef("slow", "after", svc.url("slow"), a.s3URL, map[string]any{"paused": true}))
	c.mustAdmin(200, "PUT", "/buckets/gbkt/pipelines", map[string]any{"items": []map[string]any{{"pipeline": "slow", "enabled": true}}})
	cr := a.token("gbkt", all, nil)
	for i := 0; i < 3; i++ {
		a.must(cr, 200, "PUT", fmt.Sprintf("/gbkt/k%d", i), []byte("v"))
	}
	eventually(t, 5*time.Second, "three queued runs on b", func() bool {
		return len(items(t, b.mustAdmin(200, "GET", "/runs?pipeline=slow&state=queued", nil))) == 3
	})

	// the delete through c: attached, so 409 unless detach; with detach every home reacts
	if code, _ := c.admin("DELETE", "/pipelines/slow", nil); code != 409 {
		t.Fatalf("attached: %d", code)
	}
	c.mustAdmin(204, "DELETE", "/pipelines/slow?detach=true&wait=replicated", nil)
	for _, n := range tc.nodes {
		if code, _ := n.admin("GET", "/pipelines/slow", nil); code != 404 {
			t.Fatalf("%s still has the pipeline: %d", n.name, code)
		}
	}
	eventually(t, 5*time.Second, "b to cancel the queued runs and drop the attachment", func() bool {
		cancelled := items(t, b.mustAdmin(200, "GET", "/runs?pipeline=slow&state=cancelled", nil))
		atts := b.mustAdmin(200, "GET", "/buckets/gbkt/pipelines", nil)
		if len(cancelled) != 3 || len(atts["items"].([]any)) != 0 {
			return false
		}
		for _, r := range cancelled {
			if r["reason"] != "pipeline_removed" {
				return false
			}
		}
		return true
	})
	eventually(t, 5*time.Second, "the bucket's catalog entry to drop the name", func() bool {
		rec, ok := a.app.Cluster().Bucket("gbkt")
		return ok && len(rec.Pipelines) == 0
	})

	// created again under the same name: a new pipeline, not attached anywhere
	a.mustAdmin(201, "POST", "/pipelines?wait=replicated", pipeDef("slow", "after", svc.url("slow"), a.s3URL, nil))
	if got := c.mustAdmin(200, "GET", "/pipelines/slow", nil); len(got["attached_to"].([]any)) != 0 || got["revision"].(float64) != 1 {
		t.Fatalf("the re-created pipeline: %v", got)
	}
	if atts := c.mustAdmin(200, "GET", "/buckets/gbkt/pipelines", nil); len(atts["items"].([]any)) != 0 {
		t.Fatalf("the old attachment came back: %v", atts)
	}
	a.must(cr, 200, "PUT", "/gbkt/after", []byte("v"))
	time.Sleep(200 * time.Millisecond)
	if n := len(svc.callsOf("slow")); n != 0 {
		t.Fatalf("a detached pipeline was called %d times", n)
	}
}

// A node that was down while a pipeline changed catches up from the catalog when it
// starts again (replay of what arrived while the application was away).
func TestClusterPipelineCatchUpAfterDowntime(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a := tc.nodes[0]
	svc := newFsvc(t)
	a.mustAdmin(201, "POST", "/pipelines?wait=replicated", pipeDef("p1", "after", svc.url("p1"), a.s3URL, nil))
	tc.nodes[2].stop()
	a.mustAdmin(201, "POST", "/pipelines", pipeDef("p2", "after", svc.url("p2"), a.s3URL, nil))
	a.mustAdmin(200, "PATCH", "/pipelines/p1", map[string]any{"description": "changed while c was down"})
	a.mustAdmin(204, "DELETE", "/pipelines/p1", nil)
	a.mustAdmin(201, "POST", "/pipelines", pipeDef("p3", "after", svc.url("p3"), a.s3URL, nil))

	nc := tc.restart(2, nil)
	tc.waitReady(15 * time.Second)
	eventually(t, 10*time.Second, "c to hold the catalog's pipelines", func() bool {
		l := nc.mustAdmin(200, "GET", "/pipelines", nil)
		return fmt.Sprint(itemNames(t, l, "name")) == "[p2 p3]"
	})
}

// Fan-out calls go to every reachable node and are merged; a call by id finds the node that
// owns the object; unreachable nodes are named in `partial`; calls that name a bucket in
// their body (backfill, pipeline test) go to its home (spec §8.6).
func TestClusterFanOutAdminCalls(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	svc := newFsvc(t)
	svc.on["fp"] = func(*fcall) int { return 500 }

	a.mustAdmin(201, "POST", "/pipelines?wait=replicated", pipeDef("fp", "after", svc.url("fp"), a.s3URL, map[string]any{
		"retry": map[string]any{"max_attempts": 1},
	}))
	var creds = map[string]cred{}
	for name, home := range map[string]string{"fb1": "b", "fb2": "c", "fb3": "a"} {
		a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": name, "home": home})
		a.mustAdmin(200, "PUT", "/buckets/"+name+"/pipelines", map[string]any{"items": []map[string]any{{"pipeline": "fp", "enabled": true}}})
		creds[name] = a.token(name, all, nil)
	}
	for name, cr := range creds {
		for i := 0; i < 3; i++ {
			b.must(cr, 200, "PUT", fmt.Sprintf("/%s/k%d", name, i), []byte("v"))
		}
	}
	eventually(t, 15*time.Second, "nine failed runs across three nodes", func() bool {
		return len(items(t, c.mustAdmin(200, "GET", "/runs?state=failed&limit=100", nil))) == 9
	})

	// merged, newest first, with the node of each run
	all := items(t, a.mustAdmin(200, "GET", "/runs?limit=100", nil))
	nodes := map[string]int{}
	for i, r := range all {
		nodes[fmt.Sprint(r["node"])]++
		if i > 0 && fmt.Sprint(all[i-1]["id"]) < fmt.Sprint(r["id"]) {
			t.Fatalf("not newest first at %d: %v < %v", i, all[i-1]["id"], r["id"])
		}
	}
	if len(all) != 9 || nodes["a"] != 3 || nodes["b"] != 3 || nodes["c"] != 3 {
		t.Fatalf("merged runs: %d %v", len(all), nodes)
	}
	// paging with the cursor visits every run once
	seen := map[string]bool{}
	cursor := ""
	for pages := 0; pages < 20; pages++ {
		out := c.mustAdmin(200, "GET", "/runs?limit=2"+cursor, nil)
		for _, r := range items(t, out) {
			id := fmt.Sprint(r["id"])
			if seen[id] {
				t.Fatalf("run %s listed twice", id)
			}
			seen[id] = true
		}
		if out["next_cursor"] == nil {
			break
		}
		cursor = "&cursor=" + fmt.Sprint(out["next_cursor"])
	}
	if len(seen) != 9 {
		t.Fatalf("paging visited %d runs", len(seen))
	}
	// filters reach every node; a bad filter is refused once
	if got := items(t, a.mustAdmin(200, "GET", "/runs?bucket=fb2", nil)); len(got) != 3 || got[0]["node"] != "c" {
		t.Fatalf("filter by bucket: %v", got)
	}
	if code, out := a.admin("GET", "/runs?state=bogus", nil); code != 400 {
		t.Fatalf("bad filter: %d %v", code, out)
	}

	// a call by id succeeds on the node that owns the run
	var cRun, bRun string
	for _, r := range all {
		switch r["node"] {
		case "c":
			cRun = fmt.Sprint(r["id"])
		case "b":
			bRun = fmt.Sprint(r["id"])
		}
	}
	if got := a.mustAdmin(200, "GET", "/runs/"+cRun, nil); got["node"] != "c" || got["state"] != "failed" {
		t.Fatalf("GET /runs/{id} through a: %v", got)
	}
	if code, _ := a.admin("GET", "/runs/run_nosuchrun", nil); code != 404 {
		t.Fatalf("unknown run: %d", code)
	}
	got := a.mustAdmin(200, "POST", "/runs/"+cRun+"/retry", nil)
	if got["node"] != "c" {
		t.Fatalf("retry through a of a run on c: %v", got)
	}
	// bulk: every node retries its failed runs, the counts add up
	if out := a.mustAdmin(200, "POST", "/runs/retry", map[string]any{"pipeline": "fp"}); out["requeued"].(float64) < 8 {
		t.Fatalf("bulk retry: %v", out)
	}
	eventually(t, 15*time.Second, "the retried runs to fail again", func() bool {
		return len(items(t, a.mustAdmin(200, "GET", "/runs?state=failed&limit=100", nil))) == 9
	})

	// backfills and the pipeline test are bucket-scoped by their body
	bf := a.mustAdmin(202, "POST", "/backfills", map[string]any{"bucket": "fb2", "pipeline": "fp"})
	if bf["bucket"] != "fb2" {
		t.Fatalf("backfill: %v", bf)
	}
	bfID := fmt.Sprint(bf["id"])
	if _, err := c.app.DB.Read().GetBackfill(c.ctx, bfID); err != nil {
		t.Fatalf("the backfill must live on c, the home of fb2: %v", err)
	}
	if _, err := a.app.DB.Read().GetBackfill(a.ctx, bfID); err == nil {
		t.Fatal("the backfill was created on a")
	}
	a.mustAdmin(202, "POST", "/backfills", map[string]any{"bucket": "fb1", "pipeline": "fp"})
	if l := items(t, a.mustAdmin(200, "GET", "/backfills", nil)); len(l) != 2 {
		t.Fatalf("merged backfills: %v", l)
	}
	if got := b.mustAdmin(200, "GET", "/backfills/"+bfID, nil); got["bucket"] != "fb2" {
		t.Fatalf("a backfill by id through b: %v", got)
	}
	if code, _ := a.admin("POST", "/backfills", map[string]any{"bucket": "nosuch", "pipeline": "fp"}); code != 404 {
		t.Fatalf("backfill of an unknown bucket: %d", code)
	}
	if code, _ := a.admin("POST", "/backfills", map[string]any{"pipeline": "fp"}); code != 400 {
		t.Fatalf("backfill without a bucket: %d", code)
	}
	svc.on["fp"] = func(c *fcall) int { return 204 }
	res := a.mustAdmin(200, "POST", "/pipelines/fp/test", map[string]any{"bucket": "fb2", "key": "scratch/t"})
	if res["http_status"].(float64) != 204 {
		t.Fatalf("pipeline test: %v", res)
	}
	foundTest := false
	for _, call := range svc.callsOf("fp") {
		if run, _ := call.inv["run"].(map[string]any); run["test"] == true && call.str("bucket") == "fb2" {
			foundTest = true
		}
	}
	if !foundTest {
		t.Fatal("the service never received the test invocation for fb2")
	}

	// stats come from the home nodes
	l := a.mustAdmin(200, "GET", "/buckets?stats=true", nil)
	for _, it := range items(t, l) {
		st, _ := it["stats"].(map[string]any)
		if st == nil || st["objects"].(float64) != 3 || it["quota_bytes"] != nil && false {
			t.Fatalf("stats of %v: %v", it["name"], it)
		}
	}
	if l := a.mustAdmin(200, "GET", "/buckets", nil); items(t, l)[0]["stats"] != nil {
		t.Fatalf("stats without ?stats=true")
	}

	// with c down: calls by id for its runs are 503 (it may own them), the list names c in
	// `partial`, bucket stats of c's buckets are missing
	c.crash()
	eventually(t, 5*time.Second, "a to see c down", func() bool {
		for _, p := range a.app.Cluster().Peers() {
			if p.Name == "c" && !p.Reachable {
				return true
			}
		}
		return false
	})
	if code, out := a.admin("GET", "/runs/"+cRun, nil); code != 503 || out["error"] != "unavailable" {
		t.Fatalf("a run of the node that is down: %d %v", code, out)
	}
	if got := a.mustAdmin(200, "GET", "/runs/"+bRun, nil); got["node"] != "b" {
		t.Fatalf("a run of a node that is up: %v", got)
	}
	out := a.mustAdmin(200, "GET", "/runs?limit=100", nil)
	// a's three runs and b's six (its three uploads and the three of the backfill), none of c's
	cnt := map[string]int{}
	for _, r := range items(t, out) {
		cnt[fmt.Sprint(r["node"])]++
	}
	if fmt.Sprint(out["partial"]) != "[c]" || cnt["a"] != 3 || cnt["b"] != 6 || cnt["c"] != 0 {
		t.Fatalf("runs with c down: partial=%v %v", out["partial"], cnt)
	}
	out = a.mustAdmin(200, "GET", "/backfills", nil)
	if fmt.Sprint(out["partial"]) != "[c]" {
		t.Fatalf("backfills with c down: %v", out["partial"])
	}
	out = a.mustAdmin(200, "GET", "/buckets?stats=true", nil)
	if fmt.Sprint(out["partial"]) != "[c]" {
		t.Fatalf("bucket stats with c down: %v", out["partial"])
	}
	for _, it := range items(t, out) {
		hasStats := it["stats"] != nil
		if hasStats != (it["home"] != "c") {
			t.Fatalf("bucket %v (home %v) stats present: %v", it["name"], it["home"], hasStats)
		}
	}
	out = a.mustAdmin(200, "POST", "/runs/cancel", map[string]any{"pipeline": "fp"})
	if fmt.Sprint(out["partial"]) != "[c]" {
		t.Fatalf("bulk cancel with c down: %v", out)
	}
}

// A bucket entry is last-writer-wins, so another node's write (a bucket move's hand-off, a
// concurrent update) can leave it without the names of the attached pipelines. The home
// owns the truth about its bucket: it republishes what differs (spec §8.5; the integration
// note of package cluster).
func TestClusterHomeRepublishesItsAttachmentNames(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b := tc.nodes[0], tc.nodes[1]
	svc := newFsvc(t)
	a.mustAdmin(201, "POST", "/pipelines?wait=replicated", pipeDef("keep", "after", svc.url("keep"), a.s3URL, nil))
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "rep", "home": "b"})
	a.mustAdmin(200, "PUT", "/buckets/rep/pipelines", map[string]any{"items": []map[string]any{{"pipeline": "keep", "enabled": true}}})
	for _, n := range tc.nodes {
		n := n
		eventually(t, 5*time.Second, n.name+" to list the attachment", func() bool {
			rec, ok := n.app.Cluster().Bucket("rep")
			return ok && fmt.Sprint(rec.Pipelines) == "[keep]"
		})
	}
	// a node that is not the home writes the entry with no pipelines, as a stale hand-off would
	if _, err := a.app.Cluster().UpdateBucket(a.ctx, "rep", func(c cluster.BucketEntry) (cluster.BucketEntry, error) {
		c.Pipelines = nil
		return c, nil
	}); err != nil {
		t.Fatal(err)
	}
	// the home notices that the entry differs from what it holds and writes the truth back
	eventually(t, 10*time.Second, "the home to republish its attachment names", func() bool {
		for _, n := range tc.nodes {
			rec, ok := n.app.Cluster().Bucket("rep")
			if !ok || fmt.Sprint(rec.Pipelines) != "[keep]" || rec.Home != b.nodeID() {
				return false
			}
		}
		return true
	})
	if got := a.mustAdmin(200, "GET", "/pipelines/keep", nil); fmt.Sprint(got["attached_to"]) != "[rep]" {
		t.Fatalf("attached_to after the repair: %v", got["attached_to"])
	}
}

// The time a pipeline spends paused or disabled is kept in each node's kv table and settled
// in the transaction that stores the definition, also when the definition arrives from the
// catalog: a pipeline released on another node has its hold ended on every node, the home
// that holds the queued runs included (spec §7.10, §8.7).
func TestClusterPipelineHoldIsSettledOnEveryNode(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	svc := newFsvc(t)
	holdKey := "hold/p/hp"
	hasHold := func(n *cnode) bool {
		_, err := n.app.DB.Read().KVGet(n.ctx, holdKey)
		return err == nil
	}
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "hbk", "home": "b"})
	a.mustAdmin(201, "POST", "/pipelines?wait=replicated", pipeDef("hp", "after", svc.url("hp"), a.s3URL, map[string]any{"paused": true}))
	a.mustAdmin(200, "PUT", "/buckets/hbk/pipelines", map[string]any{"items": []map[string]any{{"pipeline": "hp", "enabled": true}}})
	cr := a.token("hbk", all, nil)
	a.must(cr, 200, "PUT", "/hbk/k", []byte("v"))
	eventually(t, 5*time.Second, "the run to be held in the queue on b", func() bool {
		return len(items(t, b.mustAdmin(200, "GET", "/runs?pipeline=hp&state=queued", nil))) == 1
	})
	for _, n := range tc.nodes {
		if !hasHold(n) {
			t.Fatalf("%s did not record the start of the hold of a paused pipeline", n.name)
		}
	}
	// released through c: every node ends the hold, and b runs what was queued
	c.mustAdmin(200, "PATCH", "/pipelines/hp?wait=replicated", map[string]any{"paused": false})
	for _, n := range tc.nodes {
		if hasHold(n) {
			t.Fatalf("%s kept the hold of a pipeline that was released", n.name)
		}
	}
	eventually(t, 10*time.Second, "the held run to execute on b", func() bool { return len(svc.callsOf("hp")) == 1 })
	// paused again on a: the hold starts again everywhere
	a.mustAdmin(200, "PATCH", "/pipelines/hp?wait=replicated", map[string]any{"paused": true})
	for _, n := range tc.nodes {
		if !hasHold(n) {
			t.Fatalf("%s did not record the new hold", n.name)
		}
	}
	// deleting the pipeline clears it
	a.mustAdmin(204, "DELETE", "/pipelines/hp?detach=true&wait=replicated", nil)
	for _, n := range tc.nodes {
		if hasHold(n) {
			t.Fatalf("%s kept the hold of a deleted pipeline", n.name)
		}
	}
}
