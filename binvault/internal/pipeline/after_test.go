package pipeline_test

import (
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// TestAfterBasicFlow drives an after pipeline end to end: the PUT commits, a run
// is enqueued in the commit transaction, the service is called with a token
// that can read the object and write a derivative, and the run is recorded.
func TestAfterBasicFlow(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("photos", nil)
	c := n.token("photos", allGrants)
	n.createPipe(svc, "thumbs", "after", map[string]any{
		"match": map[string]any{"keys": []string{"uploads/**"}, "exclude_keys": []string{"derived/**"}},
		"token": map[string]any{"grants": []map[string]any{
			{"actions": []string{"read", "tag"}, "keys": []string{"{key}"}},
			{"actions": []string{"write"}, "keys": []string{"derived/{key}/*"}},
		}},
	})
	n.attach("photos", "thumbs")

	var sawBody atomic.Value
	svc.on("thumbs", func(cl *call) reply {
		key := cl.str("key")
		tok := cl.bearer()
		got := n.s3b(tok, "GET", objPath("photos", key), nil)
		if got.status != 200 {
			t.Errorf("service GET: %d %s", got.status, got.code())
			return reply{Status: 500}
		}
		sawBody.Store(string(got.body))
		put := n.s3b(tok, "PUT", objPath("photos", "derived/"+key+"/small.txt"), []byte("small:"+string(got.body)))
		if put.status != 200 {
			t.Errorf("service PUT derivative: %d %s %s", put.status, put.code(), put.message())
			return reply{Status: 500}
		}
		return reply{Status: 204}
	})

	n.must(c, 200, "PUT", objPath("photos", "uploads/a.txt"), []byte("hello"))
	n.must(c, 200, "PUT", objPath("photos", "elsewhere/b.txt"), []byte("not matched"))

	r := n.waitRunState("pipeline=thumbs", "succeeded")
	if r["key"] != "uploads/a.txt" || r["event"] != "object.created" || r["operation"] != "put" || r["stage"] != "after" {
		t.Fatalf("run record: %v", r)
	}
	if r["step"].(float64) != 1 || r["steps"].(float64) != 1 || r["attempt"].(float64) != 1 || r["http_status"].(float64) != 204 {
		t.Fatalf("run counters: %v", r)
	}
	if !strings.HasPrefix(r["id"].(string), "run_") || !strings.HasPrefix(r["event_id"].(string), "evt_") {
		t.Fatalf("ids: %v", r)
	}
	if a := r["actor"].(map[string]any); a["kind"] != "token" || a["id"] != c.ak {
		t.Fatalf("actor: %v", a)
	}
	if l := r["lineage"].(map[string]any); l["depth"].(float64) != 0 {
		t.Fatalf("lineage: %v", l)
	}
	if got := sawBody.Load(); got != "hello" {
		t.Fatalf("service read %v", got)
	}
	if rs := n.runs("pipeline=thumbs"); len(rs) != 1 {
		t.Fatalf("only the matching key makes a run: %d", len(rs))
	}
	// the derivative the service wrote
	d := n.must(c, 200, "GET", objPath("photos", "derived/uploads/a.txt/small.txt"), nil)
	if string(d.body) != "small:hello" {
		t.Fatalf("derivative = %q", d.body)
	}
	// the derivative write is an event of depth 1 whose chain holds the pipeline;
	// thumbs excludes derived/**, so nothing re-triggers
	time.Sleep(100 * time.Millisecond)
	if rs := n.runs("pipeline=thumbs"); len(rs) != 1 {
		t.Fatalf("the derivative must not re-trigger the pipeline: %d runs", len(rs))
	}

	cl := svc.callsOf("thumbs")[0]
	for h, want := range map[string]string{
		"X-Binvault-Pipeline": "thumbs", "X-Binvault-Stage": "after", "X-Binvault-Event": "object.created",
		"X-Binvault-Attempt": "1", "X-Binvault-Run": r["id"].(string),
	} {
		if got := cl.Header.Get(h); got != want {
			t.Errorf("header %s = %q, want %q", h, got, want)
		}
	}
	if cl.Header.Get("X-Binvault-Timestamp") == "" || cl.Header.Get("X-Binvault-Signature") != "" {
		t.Errorf("timestamp/signature headers: %v", cl.Header)
	}
	if cl.str("operation") != "put" || cl.str("bucket") != "photos" || cl.str("object", "etag") != "5d41402abc4b2a76b9719d911017c592" {
		t.Errorf("invocation: %s", cl.Raw)
	}
	if !strings.HasPrefix(cl.str("s3", "access_key_id"), "BVP") || len(cl.str("s3", "access_key_id")) != 20 || len(cl.str("s3", "secret_access_key")) != 40 {
		t.Errorf("token shape: %v", cl.Inv["s3"])
	}
}

func TestAfterTagsAndGuard(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", map[string]any{"versioning": "enabled"})
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "tagger", "after", map[string]any{
		"token": map[string]any{"grants": []map[string]any{{"actions": []string{"read", "tag"}, "keys": []string{"{key}"}}}},
	})
	n.attach("bkt", "tagger")
	svc.on("tagger", func(cl *call) reply {
		ver := cl.str("object", "version")
		body := `<Tagging><TagSet><Tag><Key>scan</Key><Value>clean</Value></Tag></TagSet></Tagging>`
		put := n.s3b(cl.bearer(), "PUT", objPath("bkt", cl.str("key"))+"?tagging&versionId="+ver, []byte(body))
		if put.status != 200 {
			t.Errorf("tagging: %d %s", put.status, put.code())
			return reply{Status: 500}
		}
		return reply{Status: 200}
	})
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("v1"))
	n.waitRunState("pipeline=tagger", "succeeded")
	tg := n.must(c, 200, "GET", objPath("bkt", "k")+"?tagging", nil)
	if !strings.Contains(string(tg.body), "<Key>scan</Key>") {
		t.Fatalf("tags = %s", tg.body)
	}
}

// ---- ordering and serialisation ----------------------------------------------------------

func TestAfterStepsRunInAttachmentOrder(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	for _, name := range []string{"first", "second", "third"} {
		n.createPipe(svc, name, "after", map[string]any{"token": map[string]any{"grants": []any{}}})
	}
	n.attach("bkt", "first", "second", "third")
	var firstDone atomic.Int64
	svc.on("first", func(cl *call) reply {
		time.Sleep(200 * time.Millisecond)
		firstDone.Store(time.Now().UnixNano())
		return reply{}
	})
	svc.on("second", func(cl *call) reply {
		if firstDone.Load() == 0 {
			t.Error("second started before first finished")
		}
		return reply{}
	})
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x"))
	eventually(t, 10*time.Second, "all three steps", func() bool {
		return len(n.runs("state=succeeded")) == 3
	})
	var order []string
	for _, cl := range svc.allCalls() {
		order = append(order, cl.Pipeline)
	}
	if strings.Join(order, ",") != "first,second,third" {
		t.Fatalf("order = %v", order)
	}
	runs := n.runs("event_id=" + n.runs("pipeline=first")[0]["event_id"].(string))
	if len(runs) != 3 {
		t.Fatalf("one event group of three runs, got %d", len(runs))
	}
	for _, r := range runs {
		if r["steps"].(float64) != 3 {
			t.Fatalf("steps: %v", r)
		}
	}
	// no grants: no token is minted and the invocation has no s3 block
	if svc.callsOf("first")[0].Inv["s3"] != nil {
		t.Fatalf("grants [] must mean no token: %s", svc.callsOf("first")[0].Raw)
	}
}

func TestAfterPerKeySerialisation(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	// deleted events are never superseded, so every one of them runs
	n.createPipe(svc, "p", "after", map[string]any{
		"events": []string{"object.deleted"},
		"token":  map[string]any{"grants": []any{}}, "limits": map[string]any{"max_concurrency": 8},
	})
	n.attach("bkt", "p")
	var active atomic.Int32
	var overlap atomic.Bool
	release := make(chan struct{})
	svc.on("p", func(cl *call) reply {
		if active.Add(1) > 1 && cl.str("key") == "same" {
			overlap.Store(true)
		}
		defer active.Add(-1)
		if cl.str("key") == "same" {
			<-release
		}
		return reply{}
	})
	for i := 0; i < 3; i++ {
		n.must(c, 200, "PUT", objPath("bkt", "same"), []byte{byte('a' + i)})
		n.must(c, 204, "DELETE", objPath("bkt", "same"), nil)
	}
	for _, k := range []string{"other1", "other2"} {
		n.must(c, 200, "PUT", objPath("bkt", k), []byte("1"))
		n.must(c, 204, "DELETE", objPath("bkt", k), nil)
	}
	// the other keys are independent of the blocked key
	eventually(t, 10*time.Second, "the other keys to finish", func() bool {
		return len(n.runs("key_prefix=other&state=succeeded")) == 2
	})
	if got := len(svc.callsOf("p")); got != 3 {
		t.Fatalf("calls so far = %d, want 1 for 'same' + 2 others", got)
	}
	if st := n.runs("key=same"); len(st) != 3 {
		t.Fatalf("three runs for the key, got %d", len(st))
	}
	close(release)
	eventually(t, 10*time.Second, "the key's three runs", func() bool { return len(n.runs("key=same&state=succeeded")) == 3 })
	if overlap.Load() {
		t.Fatal("two runs of one key were in flight together")
	}
}

// TestAfterSupersession: a created or updated run whose object has been replaced
// before it starts is skipped, with the rest of its group.
func TestAfterSupersession(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", map[string]any{"versioning": "enabled"})
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "first", "after", map[string]any{"token": map[string]any{"grants": []any{}}, "paused": true})
	n.createPipe(svc, "second", "after", map[string]any{"token": map[string]any{"grants": []any{}}})
	n.createPipe(svc, "createdonly", "after", map[string]any{"token": map[string]any{"grants": []any{}}, "events": []string{"object.created"}})
	n.attach("bkt", "first", "second", "createdonly")

	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("v1")) // created: three runs, held by the paused first step
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("v2")) // updated: first and second only
	if got := len(n.runs("key=k&state=queued")); got != 5 {
		t.Fatalf("queued runs = %d, want 5", got)
	}
	n.mustAdmin(200, "PATCH", "/pipelines/first", map[string]any{"paused": false})

	eventually(t, 10*time.Second, "everything to settle", func() bool { return len(n.runs("key=k&state=queued")) == 0 && len(n.runs("key=k&state=running")) == 0 })
	byPipe := func(p, state string) int { return len(n.runs("key=k&pipeline=" + p + "&state=" + state)) }
	// v1's group is superseded in full; v2's group runs
	if byPipe("first", "skipped") != 1 || byPipe("first", "succeeded") != 1 {
		t.Fatalf("first: skipped=%d succeeded=%d", byPipe("first", "skipped"), byPipe("first", "succeeded"))
	}
	if byPipe("second", "skipped") != 1 || byPipe("second", "succeeded") != 1 {
		t.Fatalf("second: skipped=%d succeeded=%d", byPipe("second", "skipped"), byPipe("second", "succeeded"))
	}
	// a created-only pipeline does not see an object that was updated before it started
	if byPipe("createdonly", "skipped") != 1 || byPipe("createdonly", "succeeded") != 0 {
		t.Fatalf("createdonly: skipped=%d succeeded=%d", byPipe("createdonly", "skipped"), byPipe("createdonly", "succeeded"))
	}
	for _, r := range n.runs("key=k&state=skipped") {
		if r["reason"] != "superseded" {
			t.Fatalf("reason = %v", r["reason"])
		}
	}
	for _, cl := range svc.allCalls() {
		if cl.str("object", "version") != "" && cl.str("event") == "object.created" {
			t.Fatalf("a superseded run must not call the service: %s", cl.Raw)
		}
	}
}

func TestAfterRetriesWithBackoff(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "flaky", "after", map[string]any{
		"token": map[string]any{"grants": []any{}},
		"retry": map[string]any{"max_attempts": 4, "backoff": []string{"80ms"}},
	})
	n.attach("bkt", "flaky")
	var attempts atomic.Int32
	svc.on("flaky", func(cl *call) reply {
		if attempts.Add(1) < 3 {
			return reply{Status: 503}
		}
		return reply{Status: 200}
	})
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x"))
	r := n.waitRunState("pipeline=flaky", "succeeded")
	if r["attempt"].(float64) != 3 || r["max_attempts"].(float64) != 4 {
		t.Fatalf("attempts: %v", r)
	}
	calls := svc.callsOf("flaky")
	if len(calls) != 3 {
		t.Fatalf("calls = %d", len(calls))
	}
	for i, cl := range calls {
		if got := cl.Header.Get("X-Binvault-Attempt"); got != string(rune('1'+i)) {
			t.Errorf("call %d attempt header = %q", i, got)
		}
		if cl.str("run", "id") != r["id"] || cl.Header.Get("X-Binvault-Run") != r["id"] {
			t.Errorf("the run id must be stable across attempts")
		}
		if i > 0 {
			if d := cl.At.Sub(calls[i-1].At); d < 60*time.Millisecond {
				t.Errorf("attempt %d came after only %v: backoff not applied", i+1, d)
			}
		}
	}
	if m := n.metrics(); !strings.Contains(m, `binvault_pipeline_retries_total{pipeline="flaky"} 2`) ||
		!strings.Contains(m, `binvault_pipeline_runs_total{pipeline="flaky",stage="after",state="succeeded"} 1`) {
		t.Errorf("metrics:\n%s", grep(m, "binvault_pipeline"))
	}
}

func grep(s, sub string) string {
	var out []string
	for _, l := range strings.Split(s, "\n") {
		if strings.Contains(l, sub) {
			out = append(out, l)
		}
	}
	return strings.Join(out, "\n")
}

func TestAfterRetryAfterHonoured(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "busy", "after", map[string]any{
		"token": map[string]any{"grants": []any{}},
		"retry": map[string]any{"max_attempts": 3, "backoff": []string{"1h"}}, // would never come back in time
	})
	n.attach("bkt", "busy")
	var n429 atomic.Int32
	svc.on("busy", func(cl *call) reply {
		if n429.Add(1) == 1 {
			return reply{Status: 429, RetryAfter: "1"}
		}
		return reply{}
	})
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x"))
	r := n.waitRunState("pipeline=busy", "succeeded")
	calls := svc.callsOf("busy")
	if len(calls) != 2 || r["attempt"].(float64) != 2 {
		t.Fatalf("calls=%d run=%v", len(calls), r)
	}
	if d := calls[1].At.Sub(calls[0].At); d < 900*time.Millisecond || d > 10*time.Second {
		t.Fatalf("Retry-After: 1 should delay the retry by about a second, got %v", d)
	}
}

func TestAfterStatusMapping(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	for _, tc := range []struct {
		status   int
		wantRuns int // attempts made
		state    string
	}{
		{200, 1, "succeeded"}, {201, 1, "succeeded"}, {204, 1, "succeeded"},
		{422, 1, "failed"}, // permanent, no retry
		{202, 1, "failed"}, // "accepted" is a failure
		{302, 1, "failed"}, // redirects are failures and never followed
		{400, 1, "failed"}, {404, 1, "failed"}, {401, 1, "failed"},
		{408, 3, "failed"}, {425, 3, "failed"}, {429, 3, "failed"}, {500, 3, "failed"}, {503, 3, "failed"},
	} {
		name := "s" + strconv.Itoa(tc.status)
		n.createPipe(svc, name, "after", map[string]any{
			"token": map[string]any{"grants": []any{}},
			"retry": map[string]any{"max_attempts": 3, "backoff": []string{"20ms"}},
			"match": map[string]any{"keys": []string{name}},
		})
		svc.on(name, func(*call) reply { return reply{Status: tc.status} })
	}
	var names []string
	for _, tc := range []int{200, 201, 204, 422, 202, 302, 400, 404, 401, 408, 425, 429, 500, 503} {
		names = append(names, "s"+strconv.Itoa(tc))
	}
	n.attach("bkt", names...)
	for _, nm := range names {
		n.must(c, 200, "PUT", objPath("bkt", nm), []byte("x"))
	}
	want := map[string]struct {
		attempts int
		state    string
	}{
		"s200": {1, "succeeded"}, "s201": {1, "succeeded"}, "s204": {1, "succeeded"}, "s422": {1, "failed"}, "s202": {1, "failed"},
		"s302": {1, "failed"}, "s400": {1, "failed"}, "s404": {1, "failed"}, "s401": {1, "failed"},
		"s408": {3, "failed"}, "s425": {3, "failed"}, "s429": {3, "failed"}, "s500": {3, "failed"}, "s503": {3, "failed"},
	}
	for nm, w := range want {
		r := n.waitRunState("pipeline="+nm, w.state)
		if int(r["attempt"].(float64)) != w.attempts {
			t.Errorf("%s: attempts = %v, want %d (%v)", nm, r["attempt"], w.attempts, r)
		}
		if w.state == "failed" && (str(r, "error") == "" || num(r, "http_status") == 0) {
			t.Errorf("%s: a failure carries error and http_status: %v", nm, r)
		}
		if got := len(svc.callsOf(nm)); got != w.attempts {
			t.Errorf("%s: service saw %d calls, want %d", nm, got, w.attempts)
		}
	}
}
