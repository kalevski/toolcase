package pipeline_test

import (
	"fmt"
	"net/url"
	"sync/atomic"
	"testing"
	"time"
)

func TestRunsRetryAndSupersededRule(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "p", "after", map[string]any{
		"token": map[string]any{"grants": []any{}},
		"retry": map[string]any{"max_attempts": 1},
	})
	n.attach("bkt", "p")
	var broken atomic.Bool
	broken.Store(true)
	svc.on("p", func(cl *call) reply {
		if broken.Load() {
			return reply{Status: 500}
		}
		return reply{}
	})
	n.must(c, 200, "PUT", objPath("bkt", "k1"), []byte("x"))
	failed := n.waitRunState("pipeline=p&key=k1", "failed")
	id := failed["id"].(string)

	// retrying something that did not fail is a conflict; unknown runs are 404
	n.mustAdmin(404, "POST", "/runs/run_nope/retry", nil)
	n.mustAdmin(404, "GET", "/runs/run_nope", nil)

	broken.Store(false)
	got := n.mustAdmin(200, "POST", "/runs/"+id+"/retry", nil)
	if got["id"] != id {
		t.Fatalf("retry returns the run: %v", got)
	}
	ok := n.waitRunState("pipeline=p&key=k1", "succeeded")
	if ok["attempt"].(float64) != 1 {
		t.Fatalf("a retry starts a fresh series of attempts: %v", ok)
	}
	n.mustAdmin(409, "POST", "/runs/"+id+"/retry", nil) // succeeded runs cannot be retried
	fetched := n.mustAdmin(200, "GET", "/runs/"+id, nil)
	if fetched["state"] != "succeeded" {
		t.Fatalf("GET /runs/{id}: %v", fetched)
	}

	// a retry never undoes newer work: a later event for the key has already run
	broken.Store(true)
	n.must(c, 200, "PUT", objPath("bkt", "k2"), []byte("v1"))
	old := n.waitRunState("pipeline=p&key=k2", "failed")
	broken.Store(false)
	n.must(c, 200, "PUT", objPath("bkt", "k2"), []byte("v2"))
	eventually(t, 10*time.Second, "the newer event to run", func() bool { return len(n.runs("pipeline=p&key=k2&state=succeeded")) == 1 })
	res := n.mustAdmin(200, "POST", "/runs/"+old["id"].(string)+"/retry", nil)
	if res["state"] != "skipped" || res["reason"] != "superseded" {
		t.Fatalf("a stale retry must be skipped: %v", res)
	}
	calls := len(svc.callsOf("p"))
	time.Sleep(200 * time.Millisecond)
	if len(svc.callsOf("p")) != calls {
		t.Fatal("a superseded retry must not call the service")
	}
}

func TestRunsRetryRequeuesSkippedSteps(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	noTok := map[string]any{"grants": []any{}}
	n.createPipe(svc, "s1", "after", map[string]any{"token": noTok, "retry": map[string]any{"max_attempts": 1}})
	n.createPipe(svc, "s2", "after", map[string]any{"token": noTok})
	n.attach("bkt", "s1", "s2")
	var broken atomic.Bool
	broken.Store(true)
	svc.on("s1", func(*call) reply {
		if broken.Load() {
			return reply{Status: 400}
		}
		return reply{}
	})
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x"))
	failed := n.waitRunState("pipeline=s1", "failed")
	n.waitRunState("pipeline=s2", "skipped")
	broken.Store(false)
	n.mustAdmin(200, "POST", "/runs/"+failed["id"].(string)+"/retry", nil)
	n.waitRunState("pipeline=s1", "succeeded")
	r2 := n.waitRunState("pipeline=s2", "succeeded")
	if r2["reason"] != nil {
		t.Fatalf("a requeued step carries no skip reason: %v", r2)
	}
}

func TestRunsBulkRetryAndBulkCancel(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	n.bucket("other", nil)
	c := n.token("bkt", allGrants)
	c2 := n.token("other", allGrants)
	noTok := map[string]any{"grants": []any{}}
	n.createPipe(svc, "p", "after", map[string]any{"token": noTok, "retry": map[string]any{"max_attempts": 1}})
	n.attach("bkt", "p")
	n.attach("other", "p")
	var broken atomic.Bool
	broken.Store(true)
	svc.on("p", func(*call) reply {
		if broken.Load() {
			return reply{Status: 503}
		}
		return reply{}
	})
	for i := 0; i < 4; i++ {
		n.must(c, 200, "PUT", objPath("bkt", fmt.Sprintf("k%d", i)), []byte("x"))
	}
	n.must(c2, 200, "PUT", objPath("other", "o"), []byte("x"))
	eventually(t, 10*time.Second, "five failures", func() bool { return len(n.runs("state=failed")) == 5 })

	n.mustAdmin(400, "POST", "/runs/retry", map[string]any{})                                   // pipeline or bucket required
	n.mustAdmin(400, "POST", "/runs/retry", map[string]any{"pipeline": "p", "state": "queued"}) // only failed
	broken.Store(false)
	// by bucket, with a limit: the oldest first
	out := n.mustAdmin(200, "POST", "/runs/retry", map[string]any{"bucket": "bkt", "limit": 2})
	if out["requeued"].(float64) != 2 {
		t.Fatalf("limited bulk retry: %v", out)
	}
	eventually(t, 10*time.Second, "the two retried runs", func() bool { return len(n.runs("bucket=bkt&state=succeeded")) == 2 })
	if rs := n.runs("bucket=bkt&state=succeeded"); !(rs[0]["key"] == "k1" && rs[1]["key"] == "k0") {
		t.Fatalf("the oldest failures are retried first: %v / %v", rs[0]["key"], rs[1]["key"])
	}
	out = n.mustAdmin(200, "POST", "/runs/retry", map[string]any{"pipeline": "p"})
	if out["requeued"].(float64) != 3 {
		t.Fatalf("bulk retry: %v", out)
	}
	eventually(t, 10*time.Second, "everything to succeed", func() bool { return len(n.runs("state=succeeded")) == 5 })

	// bulk cancel: queued runs of a held pipeline
	n.mustAdmin(200, "PATCH", "/pipelines/p", map[string]any{"paused": true})
	for i := 0; i < 3; i++ {
		n.must(c, 200, "PUT", objPath("bkt", fmt.Sprintf("q%d", i)), []byte("x"))
	}
	n.must(c2, 200, "PUT", objPath("other", "q"), []byte("x"))
	n.mustAdmin(400, "POST", "/runs/cancel", map[string]any{})
	n.mustAdmin(400, "POST", "/runs/cancel", map[string]any{"pipeline": "p", "state": "failed"})
	one := n.runs("key=q0")[0]
	r := n.mustAdmin(200, "POST", "/runs/"+one["id"].(string)+"/cancel", nil)
	if r["state"] != "cancelled" || r["reason"] != "admin" {
		t.Fatalf("cancel: %v", r)
	}
	n.mustAdmin(409, "POST", "/runs/"+one["id"].(string)+"/cancel", nil) // no longer queued
	out = n.mustAdmin(200, "POST", "/runs/cancel", map[string]any{"bucket": "bkt"})
	if out["cancelled"].(float64) != 2 {
		t.Fatalf("bulk cancel: %v", out)
	}
	if len(n.runs("bucket=other&state=queued")) != 1 {
		t.Fatal("bulk cancel by bucket must leave other buckets alone")
	}
	// a released key lets later events through
	n.mustAdmin(200, "PATCH", "/pipelines/p", map[string]any{"paused": false})
	n.waitRunState("bucket=other&key=q", "succeeded")
}

func TestRunsListFiltersAndPaging(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	n.bucket("zzz", nil)
	c := n.token("bkt", allGrants)
	c2 := n.token("zzz", allGrants)
	noTok := map[string]any{"grants": []any{}}
	n.createPipe(svc, "alpha", "after", map[string]any{"token": noTok, "events": []string{"object.created", "object.deleted"}})
	n.createPipe(svc, "beta", "after", map[string]any{"token": noTok})
	n.attach("bkt", "alpha", "beta")
	n.attach("zzz", "alpha")
	before := time.Now().Add(-time.Second)
	for i := 0; i < 5; i++ {
		n.must(c, 200, "PUT", objPath("bkt", fmt.Sprintf("a/%d", i)), []byte("x"))
	}
	n.must(c, 200, "PUT", objPath("bkt", "b/0"), []byte("x"))
	// let b/0's two runs finish before the delete, or they would be superseded
	eventually(t, 10*time.Second, "b/0's runs", func() bool { return len(n.runs("key=b/0&state=succeeded")) == 2 })
	n.must(c, 204, "DELETE", objPath("bkt", "b/0"), nil)
	n.must(c2, 200, "PUT", objPath("zzz", "z"), []byte("x"))
	eventually(t, 10*time.Second, "all runs", func() bool {
		return len(n.runs("state=succeeded&limit=100")) == 14
	})
	count := func(q string) int { return len(n.runs(q + "&limit=100")) }
	for q, want := range map[string]int{
		"bucket=bkt": 13, "bucket=zzz": 1, "pipeline=alpha": 5 + 2 + 1, "pipeline=beta": 5 + 1,
		"stage=after": 14, "stage=before": 0, "state=succeeded": 14, "state=skipped": 0, "state=failed": 0,
		"key=a/3": 2, "key_prefix=a/": 10, "key_prefix=b/": 3, "key=nope": 0,
		"since=" + url.QueryEscape(before.UTC().Format(time.RFC3339Nano)): 14,
		"until=" + url.QueryEscape(before.UTC().Format(time.RFC3339Nano)): 0,
	} {
		if got := count(q); got != want {
			t.Errorf("filter %q: %d runs, want %d", q, got, want)
		}
	}
	evt := n.runs("key=a/0&pipeline=alpha")[0]["event_id"].(string)
	if got := count("event_id=" + evt); got != 2 {
		t.Errorf("event_id filter: %d", got)
	}
	n.mustAdmin(400, "GET", "/runs?state=bogus", nil)
	n.mustAdmin(400, "GET", "/runs?stage=bogus", nil)
	n.mustAdmin(400, "GET", "/runs?since=yesterday", nil)
	n.mustAdmin(400, "GET", "/runs?limit=0", nil)

	// newest first, paged by cursor with no run seen twice
	seen := map[string]bool{}
	prev := "\xff"
	cursor := ""
	pages := 0
	for {
		path := "/runs?limit=4"
		if cursor != "" {
			path += "&cursor=" + url.QueryEscape(cursor)
		}
		page := n.mustAdmin(200, "GET", path, nil)
		items := page["items"].([]any)
		for _, it := range items {
			id := it.(map[string]any)["id"].(string)
			if seen[id] {
				t.Fatalf("run %s listed twice", id)
			}
			if id >= prev {
				t.Fatalf("not newest first: %s after %s", id, prev)
			}
			seen[id], prev = true, id
		}
		pages++
		next, _ := page["next_cursor"].(string)
		if next == "" {
			break
		}
		cursor = next
	}
	if len(seen) != 14 || pages != 4 {
		t.Fatalf("paged %d runs in %d pages", len(seen), pages)
	}
}

func TestBackfill(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	// objects that exist before the pipeline is attached
	for i := 0; i < 7; i++ {
		n.must(c, 200, "PUT", objPath("bkt", fmt.Sprintf("old/%d.txt", i)), []byte("old"))
	}
	n.must(c, 200, "PUT", objPath("bkt", "skip/x.txt"), []byte("old"))
	n.createPipe(svc, "indexer", "after", map[string]any{
		"match":  map[string]any{"keys": []string{"**/*.txt"}},
		"limits": map[string]any{"max_concurrency": 2},
		"token":  map[string]any{"grants": []map[string]any{{"actions": []string{"read"}, "keys": []string{"{key}"}}}},
	})
	n.createPipe(svc, "beforeone", "before", nil)
	n.createPipe(svc, "deleter", "after", map[string]any{"events": []string{"object.deleted"}})

	// the pipeline must be attached, enabled, after and subscribed to created
	bf := map[string]any{"bucket": "bkt", "pipeline": "indexer"}
	n.mustAdmin(409, "POST", "/backfills", bf) // not attached yet
	n.attach("bkt", "indexer", "deleter")
	n.mustAdmin(409, "POST", "/backfills", map[string]any{"bucket": "bkt", "pipeline": "deleter"}) // not subscribed to object.created
	n.mustAdmin(404, "POST", "/backfills", map[string]any{"bucket": "nope", "pipeline": "indexer"})
	n.mustAdmin(404, "POST", "/backfills", map[string]any{"bucket": "bkt", "pipeline": "nope"})
	n.mustAdmin(400, "POST", "/backfills", map[string]any{"bucket": "bkt"})

	var active, maxActive atomic.Int32
	svc.on("indexer", func(cl *call) reply {
		cur := active.Add(1)
		for {
			m := maxActive.Load()
			if cur <= m || maxActive.CompareAndSwap(m, cur) {
				break
			}
		}
		time.Sleep(60 * time.Millisecond)
		active.Add(-1)
		return reply{}
	})
	out := n.mustAdmin(202, "POST", "/backfills", map[string]any{"bucket": "bkt", "pipeline": "indexer", "prefix": "old/"})
	id := out["id"].(string)
	if out["state"] != "running" {
		t.Fatalf("backfill: %v", out)
	}
	var done map[string]any
	eventually(t, 15*time.Second, "the backfill to finish", func() bool {
		done = n.mustAdmin(200, "GET", "/backfills/"+id, nil)
		return done["state"] == "completed"
	})
	if done["scanned"].(float64) != 7 || done["enqueued"].(float64) != 7 || done["finished_at"] == nil || done["cursor"] != "old/6.txt" {
		t.Fatalf("finished backfill: %v", done)
	}
	eventually(t, 15*time.Second, "the runs", func() bool { return len(n.runs("pipeline=indexer&state=succeeded&limit=100")) == 7 })
	for _, r := range n.runs("pipeline=indexer&limit=100") {
		a := r["actor"].(map[string]any)
		if r["event"] != "object.created" || r["operation"] != "backfill" || a["kind"] != "backfill" || a["id"] != id {
			t.Fatalf("a backfill run: %v", r)
		}
	}
	if maxActive.Load() > 2 {
		t.Fatalf("max_concurrency 2 exceeded: %d", maxActive.Load())
	}
	first := svc.callsOf("indexer")[0]
	if first.str("operation") != "backfill" || first.str("actor", "kind") != "backfill" || first.str("event") != "object.created" {
		t.Fatalf("invocation of a backfilled object: %s", first.Raw)
	}
	if got := len(n.mustAdmin(200, "GET", "/backfills", nil)["items"].([]any)); got != 1 {
		t.Fatalf("list: %d", got)
	}
	n.mustAdmin(404, "GET", "/backfills/bf_nope", nil)
	n.mustAdmin(409, "POST", "/backfills/"+id+"/cancel", nil) // finished
	n.mustAdmin(404, "POST", "/backfills/bf_nope/cancel", nil)
}

// A backfill is throttled to 2 x max_concurrency queued runs, its cursor is
// persisted, and it resumes after a restart; cancelling stops it.
func TestBackfillThrottleResumeCancel(t *testing.T) {
	dir := t.TempDir()
	n := startNode(t, dir, nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	for i := 0; i < 9; i++ {
		n.must(c, 200, "PUT", objPath("bkt", fmt.Sprintf("o/%d", i)), []byte("old"))
	}
	n.createPipe(svc, "idx", "after", map[string]any{
		"paused": true, "limits": map[string]any{"max_concurrency": 1}, "token": map[string]any{"grants": []any{}},
	})
	n.attach("bkt", "idx")
	out := n.mustAdmin(202, "POST", "/backfills", map[string]any{"bucket": "bkt", "pipeline": "idx"})
	id := out["id"].(string)
	// paused: the walk stops with 2 x 1 runs queued
	eventually(t, 10*time.Second, "two queued runs", func() bool { return len(n.runs("pipeline=idx&state=queued")) == 2 })
	time.Sleep(500 * time.Millisecond)
	if got := len(n.runs("pipeline=idx&state=queued")); got != 2 {
		t.Fatalf("throttle: %d queued runs, want 2", got)
	}
	bfr := n.mustAdmin(200, "GET", "/backfills/"+id, nil)
	if bfr["state"] != "running" || bfr["enqueued"].(float64) != 2 || bfr["cursor"] != "o/1" {
		t.Fatalf("backfill progress: %v", bfr)
	}

	// restart: the persisted cursor resumes the walk
	n2 := n.restart(nil)
	time.Sleep(300 * time.Millisecond)
	bfr = n2.mustAdmin(200, "GET", "/backfills/"+id, nil)
	if bfr["state"] != "running" || bfr["enqueued"].(float64) != 2 {
		t.Fatalf("after restart: %v", bfr)
	}
	n2.mustAdmin(200, "PATCH", "/pipelines/idx", map[string]any{"paused": false})
	eventually(t, 20*time.Second, "the backfill to complete", func() bool {
		return n2.mustAdmin(200, "GET", "/backfills/"+id, nil)["state"] == "completed"
	})
	done := n2.mustAdmin(200, "GET", "/backfills/"+id, nil)
	if done["scanned"].(float64) != 9 || done["enqueued"].(float64) != 9 {
		t.Fatalf("resumed backfill: %v", done)
	}
	eventually(t, 15*time.Second, "all nine runs", func() bool { return len(n2.runs("pipeline=idx&state=succeeded&limit=100")) == 9 })

	// cancel: a running (stalled) backfill stops, its queued runs stay
	n2.mustAdmin(200, "PATCH", "/pipelines/idx", map[string]any{"paused": true})
	out = n2.mustAdmin(202, "POST", "/backfills", map[string]any{"bucket": "bkt", "pipeline": "idx"})
	id2 := out["id"].(string)
	eventually(t, 10*time.Second, "two queued runs", func() bool { return len(n2.runs("pipeline=idx&state=queued")) == 2 })
	c2 := n2.mustAdmin(200, "POST", "/backfills/"+id2+"/cancel", nil)
	if c2["state"] != "cancelled" || c2["finished_at"] == nil {
		t.Fatalf("cancel: %v", c2)
	}
	n2.mustAdmin(200, "PATCH", "/pipelines/idx", map[string]any{"paused": false})
	eventually(t, 10*time.Second, "the queued runs to run", func() bool { return len(n2.runs("pipeline=idx&state=queued")) == 0 })
	time.Sleep(300 * time.Millisecond)
	if got := len(n2.runs("pipeline=idx&limit=100")); got != 11 {
		t.Fatalf("a cancelled backfill enqueues no more: %d runs", got)
	}
}

func TestPipelineTestEndpoint(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "tp", "after", map[string]any{
		"token": map[string]any{"grants": []map[string]any{{"actions": []string{"read"}, "keys": []string{"{key}"}}}},
	})
	n.must(c, 200, "PUT", objPath("bkt", "scratch/test.bin"), []byte("live"))
	var got atomic.Value
	svc.on("tp", func(cl *call) reply {
		r := n.s3b(cl.bearer(), "GET", objPath("bkt", cl.str("key")), nil)
		got.Store(string(r.body))
		return reply{Status: 204}
	})
	res := n.mustAdmin(200, "POST", "/pipelines/tp/test", map[string]any{"bucket": "bkt", "key": "scratch/test.bin"})
	if res["http_status"].(float64) != 204 || res["error"] != nil || res["message"] != nil || res["latency_ms"] == nil {
		t.Fatalf("test result: %v", res)
	}
	cl := svc.callsOf("tp")[0]
	if cl.Inv["run"].(map[string]any)["test"] != true || cl.str("event") != "object.created" || cl.Inv["object"].(map[string]any)["size"].(float64) != 4 {
		t.Fatalf("invocation: %s", cl.Raw)
	}
	if got.Load() != "live" {
		t.Fatalf("the test token must read the live object: %v", got.Load())
	}
	if len(n.runs("")) != 0 {
		t.Fatal("a test creates no run record")
	}
	// a key that does not exist is described by a synthetic empty object
	n.mustAdmin(200, "POST", "/pipelines/tp/test", map[string]any{"bucket": "bkt", "key": "missing", "event": "object.deleted"})
	cl = svc.callsOf("tp")[1]
	if cl.str("event") != "object.deleted" || cl.Inv["object"].(map[string]any)["size"].(float64) != 0 {
		t.Fatalf("synthetic object: %s", cl.Raw)
	}
	// failures are reported, not raised
	svc.on("tp", func(*call) reply { return reply{Status: 422, Body: `{"message":"bad input"}`} })
	res = n.mustAdmin(200, "POST", "/pipelines/tp/test", map[string]any{"bucket": "bkt", "key": "k"})
	if res["http_status"].(float64) != 422 || res["message"] != "bad input" || res["error"] == nil {
		t.Fatalf("failed test: %v", res)
	}
	n.mustAdmin(404, "POST", "/pipelines/nope/test", map[string]any{"bucket": "bkt", "key": "k"})
	n.mustAdmin(404, "POST", "/pipelines/tp/test", map[string]any{"bucket": "nope", "key": "k"})
	n.mustAdmin(400, "POST", "/pipelines/tp/test", map[string]any{"bucket": "bkt"})
	n.mustAdmin(400, "POST", "/pipelines/tp/test", map[string]any{"bucket": "bkt", "key": "k", "event": "object.exploded"})
}

func TestStatusAndMetrics(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "held", "after", map[string]any{"paused": true, "token": map[string]any{"grants": []any{}}})
	n.attach("bkt", "held")
	n.must(c, 200, "PUT", objPath("bkt", "a"), []byte("x"))
	n.must(c, 200, "PUT", objPath("bkt", "b"), []byte("x"))
	st := n.mustAdmin(200, "GET", "/status", nil)
	per := st["pipelines"].(map[string]any)["held"].(map[string]any)
	if per["queued"].(float64) != 2 || per["running"].(float64) != 0 {
		t.Fatalf("status: %v", st["pipelines"])
	}
	if m := n.metrics(); !contains(m, `binvault_pipeline_queue_depth{pipeline="held"} 2`) {
		t.Fatalf("queue depth metric:\n%s", grep(m, "binvault_pipeline"))
	}
}

func contains(s, sub string) bool {
	return len(sub) == 0 || (len(s) >= len(sub) && indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
