package pipeline_test

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/config"
)

var stagedGrants = map[string]any{"grants": []map[string]any{
	{"actions": []string{"read", "write", "delete", "tag"}, "keys": []string{"{key}"}},
}}

func md5hex(b []byte) string { s := md5.Sum(b); return hex.EncodeToString(s[:]) }

// gateEnv is a node with a bucket, a client token and a before pipeline "gate".
type gateEnv struct {
	n   *node
	svc *fakeSvc
	c   cred
}

func newGate(t *testing.T, bucketSettings map[string]any, def map[string]any, mod func(*config.Config)) *gateEnv {
	t.Helper()
	n := startNode(t, "", mod)
	svc := newService(t)
	n.bucket("bkt", bucketSettings)
	c := n.token("bkt", allGrants)
	if def == nil {
		def = map[string]any{}
	}
	if _, ok := def["token"]; !ok {
		def["token"] = stagedGrants
	}
	n.createPipe(svc, "gate", "before", def)
	n.attach("bkt", "gate")
	return &gateEnv{n: n, svc: svc, c: c}
}

func TestBeforePassLeavesTheObjectAlone(t *testing.T) {
	e := newGate(t, nil, nil, nil)
	var staged atomic.Value
	e.svc.on("gate", func(cl *call) reply {
		r := e.n.s3b(cl.bearer(), "GET", objPath("bkt", cl.str("key")), nil)
		staged.Store(string(r.body))
		return reply{Status: 204}
	})
	put := e.n.must(e.c, 200, "PUT", objPath("bkt", "uploads/a.txt"), []byte("hello"), "Content-Type", "text/plain", "x-amz-meta-owner", "me")
	if staged.Load() != "hello" {
		t.Fatalf("the service reads the staged bytes: %v", staged.Load())
	}
	if put.header.Get("x-binvault-modified") != "" || put.header.Get("ETag") != `"`+md5hex([]byte("hello"))+`"` {
		t.Fatalf("headers: %v", put.header)
	}
	got := e.n.must(e.c, 200, "GET", objPath("bkt", "uploads/a.txt"), nil)
	if string(got.body) != "hello" || got.header.Get("Content-Type") != "text/plain" || got.header.Get("x-amz-meta-owner") != "me" {
		t.Fatalf("object: %q %v", got.body, got.header)
	}
	r := e.n.waitRunState("pipeline=gate", "succeeded")
	if r["stage"] != "before" || r["event"] != "object.created" || r["operation"] != "put" || r["step"].(float64) != 1 || r["attempt"].(float64) != 1 {
		t.Fatalf("before run record: %v", r)
	}
	cl := e.svc.callsOf("gate")[0]
	if cl.str("stage") != "before" || cl.Header.Get("X-Binvault-Stage") != "before" || cl.str("object", "version") != put.header.Get("x-binvault-version") {
		t.Fatalf("invocation: %s", cl.Raw)
	}
	if cl.str("object", "content_type") != "text/plain" || cl.Inv["object"].(map[string]any)["metadata"].(map[string]any)["owner"] != "me" {
		t.Fatalf("object block: %s", cl.Raw)
	}
	if cl.Inv["previous"] != nil {
		t.Fatalf("a create has no previous: %s", cl.Raw)
	}
	grants := cl.Inv["s3"].(map[string]any)["grants"].([]any)
	if k := grants[0].(map[string]any)["keys"].([]any)[0]; k != "uploads/a.txt" {
		t.Fatalf("expanded grants: %v", grants)
	}
	// an update shows the object being replaced
	e.n.must(e.c, 200, "PUT", objPath("bkt", "uploads/a.txt"), []byte("second"))
	cl = e.svc.callsOf("gate")[1]
	if cl.str("event") != "object.updated" {
		t.Fatalf("event: %s", cl.Raw)
	}
	if pv := cl.Inv["previous"].(map[string]any); pv["etag"] != md5hex([]byte("hello")) || pv["size"].(float64) != 5 {
		t.Fatalf("previous: %v", pv)
	}
}

func TestBeforeRejectByDeletingTheStagedObject(t *testing.T) {
	e := newGate(t, nil, nil, nil)
	e.svc.on("gate", func(cl *call) reply {
		if r := e.n.s3b(cl.bearer(), "DELETE", objPath("bkt", cl.str("key")), nil); r.status != 204 {
			t.Errorf("staged delete: %d %s", r.status, r.code())
		}
		return reply{Status: 204}
	})
	r := e.n.s3(e.c, "PUT", objPath("bkt", "k"), []byte("bad"))
	if r.status != 422 || r.code() != "PipelineRejected" || !strings.Contains(r.message(), `rejected by pipeline "gate"`) {
		t.Fatalf("response: %d %s %s", r.status, r.code(), r.message())
	}
	e.n.must(e.c, 404, "GET", objPath("bkt", "k"), nil)
	run := e.n.waitRunState("pipeline=gate", "rejected")
	if run["stage"] != "before" {
		t.Fatalf("run: %v", run)
	}
	if !strings.Contains(e.n.metrics(), `binvault_pipeline_rejections_total{pipeline="gate"} 1`) {
		t.Fatalf("rejections metric:\n%s", grep(e.n.metrics(), "binvault_pipeline"))
	}
}

func TestBeforeRejectWith422AndMessage(t *testing.T) {
	e := newGate(t, nil, nil, nil)
	e.svc.on("gate", func(cl *call) reply { return reply{Status: 422, Body: `{"message":"not a valid image"}`} })
	r := e.n.s3(e.c, "PUT", objPath("bkt", "k"), []byte("x"))
	if r.status != 422 || r.code() != "PipelineRejected" || r.message() != `rejected by pipeline "gate": not a valid image` {
		t.Fatalf("response: %d %s %q", r.status, r.code(), r.message())
	}
	e.n.must(e.c, 404, "GET", objPath("bkt", "k"), nil)
	if run := e.n.waitRunState("pipeline=gate", "rejected"); run["message"] != "not a valid image" || run["http_status"].(float64) != 422 {
		t.Fatalf("run: %v", run)
	}
	// 422 is final: on_error is not consulted and nothing is retried
	if len(e.svc.callsOf("gate")) != 1 {
		t.Fatal("a rejection is not retried")
	}
}

func TestBeforeReplace(t *testing.T) {
	e := newGate(t, nil, nil, nil)
	e.svc.on("gate", func(cl *call) reply {
		tok := cl.bearer()
		got := e.n.s3b(tok, "GET", objPath("bkt", cl.str("key")), nil)
		// no Content-Type, no metadata, no tags in the PUT: all inherited
		put := e.n.s3b(tok, "PUT", objPath("bkt", cl.str("key")), []byte(strings.ToUpper(string(got.body))))
		if put.status != 200 {
			t.Errorf("replace: %d %s %s", put.status, put.code(), put.message())
		}
		// the token's own reads see the pending replacement
		again := e.n.s3b(tok, "GET", objPath("bkt", cl.str("key")), nil)
		if string(again.body) != strings.ToUpper(string(got.body)) {
			t.Errorf("read-your-writes: %q", again.body)
		}
		return reply{Status: 200}
	})
	put := e.n.must(e.c, 200, "PUT", objPath("bkt", "doc.txt"), []byte("hello world"),
		"Content-Type", "text/plain", "x-amz-meta-a", "1", "x-amz-tagging", "kind=doc", "Cache-Control", "max-age=60",
		"x-amz-checksum-crc32", crc32IEEE([]byte("hello world")))
	if put.header.Get("x-binvault-modified") != "true" || put.header.Get("ETag") != `"`+md5hex([]byte("HELLO WORLD"))+`"` {
		t.Fatalf("response headers: %v", put.header)
	}
	got := e.n.must(e.c, 200, "GET", objPath("bkt", "doc.txt"), nil, "x-amz-checksum-mode", "ENABLED")
	if string(got.body) != "HELLO WORLD" {
		t.Fatalf("committed bytes = %q", got.body)
	}
	h := got.header
	if h.Get("Content-Type") != "text/plain" || h.Get("x-amz-meta-a") != "1" || h.Get("Cache-Control") != "max-age=60" || h.Get("x-amz-tagging-count") != "1" {
		t.Fatalf("inherited headers: %v", h)
	}
	if h.Get("ETag") != `"`+md5hex([]byte("HELLO WORLD"))+`"` {
		t.Fatalf("ETag = %s", h.Get("ETag"))
	}
	// the checksum is recomputed over the new bytes with the same algorithm
	if h.Get("x-amz-checksum-crc32") != crc32IEEE([]byte("HELLO WORLD")) {
		t.Fatalf("checksum = %s, want %s", h.Get("x-amz-checksum-crc32"), crc32IEEE([]byte("HELLO WORLD")))
	}
	if put.header.Get("x-amz-checksum-crc32") != crc32IEEE([]byte("HELLO WORLD")) {
		t.Fatalf("the PUT response carries the new checksum: %v", put.header)
	}
	// a replacement adds no event: the one event of the write
	e.n.createPipe(e.svc, "after1", "after", map[string]any{"token": map[string]any{"grants": []any{}}})
	e.n.attach("bkt", "gate", "after1")
	e.n.must(e.c, 200, "PUT", objPath("bkt", "doc2.txt"), []byte("again"))
	e.n.waitRunState("pipeline=after1", "succeeded")
	time.Sleep(200 * time.Millisecond)
	if n := len(e.n.runs("pipeline=after1")); n != 1 {
		t.Fatalf("exactly one after run for the write, got %d", n)
	}
}

func TestBeforeReplaceMetadataSemantics(t *testing.T) {
	e := newGate(t, nil, nil, nil)
	var full atomic.Bool
	e.svc.on("gate", func(cl *call) reply {
		hdr := []string{"Content-Type", "image/webp", "x-amz-meta-b", "2"}
		if full.Load() {
			hdr = append(hdr, "x-binvault-replace-metadata", "true")
		}
		if r := e.n.s3b(cl.bearer(), "PUT", objPath("bkt", cl.str("key")), []byte("new"), hdr...); r.status != 200 {
			t.Errorf("replace: %d %s", r.status, r.code())
		}
		return reply{}
	})
	orig := []string{"Content-Type", "image/jpeg", "x-amz-meta-a", "1", "Content-Language", "en", "x-amz-tagging", "k=v"}
	e.n.must(e.c, 200, "PUT", objPath("bkt", "merged"), []byte("old"), orig...)
	got := e.n.must(e.c, 200, "GET", objPath("bkt", "merged"), nil)
	if got.header.Get("Content-Type") != "image/webp" || got.header.Get("x-amz-meta-a") != "1" || got.header.Get("x-amz-meta-b") != "2" ||
		got.header.Get("Content-Language") != "en" || got.header.Get("x-amz-tagging-count") != "1" {
		t.Fatalf("merge semantics (named keys override, the rest inherited): %v", got.header)
	}
	full.Store(true)
	e.n.must(e.c, 200, "PUT", objPath("bkt", "replaced"), []byte("old"), orig...)
	got = e.n.must(e.c, 200, "GET", objPath("bkt", "replaced"), nil)
	if got.header.Get("Content-Type") != "image/webp" || got.header.Get("x-amz-meta-a") != "" || got.header.Get("x-amz-meta-b") != "2" ||
		got.header.Get("Content-Language") != "" || got.header.Get("x-amz-tagging-count") != "" {
		t.Fatalf("x-binvault-replace-metadata: true is a full S3 replace: %v", got.header)
	}
}

func TestBeforeTagsOfTheStagedObject(t *testing.T) {
	e := newGate(t, nil, nil, nil)
	e.svc.on("gate", func(cl *call) reply {
		tok := cl.bearer()
		path := objPath("bkt", cl.str("key")) + "?tagging"
		if tg := e.n.s3b(tok, "GET", path, nil); !strings.Contains(string(tg.body), "<Key>from</Key>") {
			t.Errorf("staged tags are readable: %s", tg.body)
		}
		put := e.n.s3b(tok, "PUT", path, []byte(`<Tagging><TagSet><Tag><Key>scan</Key><Value>clean</Value></Tag></TagSet></Tagging>`))
		if put.status != 200 {
			t.Errorf("staged tagging: %d %s", put.status, put.code())
		}
		return reply{}
	})
	r := e.n.must(e.c, 200, "PUT", objPath("bkt", "k"), []byte("x"), "x-amz-tagging", "from=client")
	if r.header.Get("x-binvault-modified") != "" {
		t.Fatalf("a tag change is not a content replacement: %v", r.header)
	}
	tg := e.n.must(e.c, 200, "GET", objPath("bkt", "k")+"?tagging", nil)
	if !strings.Contains(string(tg.body), "<Key>scan</Key>") || strings.Contains(string(tg.body), "<Key>from</Key>") {
		t.Fatalf("committed tags: %s", tg.body)
	}
}

func TestBeforeFailureReplaceThenFail(t *testing.T) {
	// the first pipeline replaces the bytes and then fails; on_error continue
	// means the second pipeline and the commit see the object as it was
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "first", "before", map[string]any{"token": stagedGrants, "on_error": "continue"})
	n.createPipe(svc, "second", "before", map[string]any{"token": stagedGrants})
	n.attach("bkt", "first", "second")
	svc.on("first", func(cl *call) reply {
		if r := n.s3b(cl.bearer(), "PUT", objPath("bkt", cl.str("key")), []byte("REPLACED")); r.status != 200 {
			t.Errorf("replace: %d", r.status)
		}
		return reply{Status: 500}
	})
	var secondSaw atomic.Value
	svc.on("second", func(cl *call) reply {
		secondSaw.Store(string(n.s3b(cl.bearer(), "GET", objPath("bkt", cl.str("key")), nil).body))
		return reply{}
	})
	put := n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("original"))
	if secondSaw.Load() != "original" {
		t.Fatalf("the failed attempt's replacement must be discarded; the next pipeline saw %v", secondSaw.Load())
	}
	if put.header.Get("x-binvault-modified") != "" {
		t.Fatal("nothing was replaced")
	}
	if got := n.must(c, 200, "GET", objPath("bkt", "k"), nil); string(got.body) != "original" {
		t.Fatalf("committed %q", got.body)
	}
	if r := n.waitRunState("pipeline=first", "failed"); num(r, "http_status") != 500 {
		t.Fatalf("first: %v", r)
	}
	n.waitRunState("pipeline=second", "succeeded")
}

func TestBeforeOnErrorRejectAndContinue(t *testing.T) {
	for _, mode := range []string{"reject", "continue"} {
		t.Run(mode, func(t *testing.T) {
			e := newGate(t, nil, map[string]any{"on_error": mode}, nil)
			e.svc.on("gate", func(*call) reply { return reply{Status: 500} })
			r := e.n.s3(e.c, "PUT", objPath("bkt", "k"), []byte("x"))
			if mode == "reject" {
				if r.status != 502 || r.code() != "PipelineFailed" {
					t.Fatalf("response: %d %s", r.status, r.code())
				}
				e.n.must(e.c, 404, "GET", objPath("bkt", "k"), nil)
				e.n.waitRunState("pipeline=gate", "failed")
			} else {
				if r.status != 200 {
					t.Fatalf("response: %d %s", r.status, r.code())
				}
				e.n.must(e.c, 200, "GET", objPath("bkt", "k"), nil)
				e.n.waitRunState("pipeline=gate", "failed")
			}
		})
	}
	// other statuses (202, 3xx, other 4xx) are failures too, never retried
	for _, st := range []int{202, 302, 400, 404} {
		e := newGate(t, nil, map[string]any{"retry": map[string]any{"max_attempts": 3, "backoff": []string{"10ms"}}}, nil)
		e.svc.on("gate", func(*call) reply { return reply{Status: st} })
		if r := e.n.s3(e.c, "PUT", objPath("bkt", "k"), []byte("x")); r.status != 502 || r.code() != "PipelineFailed" {
			t.Errorf("status %d: %d %s", st, r.status, r.code())
		}
		if len(e.svc.callsOf("gate")) != 1 {
			t.Errorf("status %d must not be retried", st)
		}
	}
}

func TestBeforeTimeout(t *testing.T) {
	for _, mode := range []string{"reject", "continue"} {
		t.Run(mode, func(t *testing.T) {
			e := newGate(t, nil, map[string]any{"on_error": mode, "service": map[string]any{"timeout": "1s"}}, nil)
			e.svc.on("gate", func(*call) reply { return reply{Delay: 5 * time.Second} })
			start := time.Now()
			r := e.n.s3(e.c, "PUT", objPath("bkt", "k"), []byte("x"))
			if time.Since(start) > 8*time.Second {
				t.Fatalf("took %v", time.Since(start))
			}
			if mode == "reject" {
				if r.status != 504 || r.code() != "PipelineTimeout" {
					t.Fatalf("response: %d %s", r.status, r.code())
				}
			} else if r.status != 200 {
				t.Fatalf("on_error continue: %d %s", r.status, r.code())
			}
			e.n.waitRunState("pipeline=gate", "failed")
		})
	}
}

func TestBeforeRetriesGiveEachAttemptItsOwnToken(t *testing.T) {
	e := newGate(t, nil, map[string]any{"retry": map[string]any{"max_attempts": 3, "backoff": []string{"20ms"}}}, nil)
	var firstTok atomic.Value
	var attempts atomic.Int32
	e.svc.on("gate", func(cl *call) reply {
		n := attempts.Add(1)
		if n == 1 {
			firstTok.Store(cl.bearer())
			// replace, then fail the attempt: the replacement must be discarded
			e.n.s3b(cl.bearer(), "PUT", objPath("bkt", cl.str("key")), []byte("FROM-ATTEMPT-1"))
			return reply{Status: 503}
		}
		if cl.bearer() == firstTok.Load() {
			t.Error("a retry must get a new token")
		}
		if r := e.n.s3b(firstTok.Load().(string), "GET", objPath("bkt", cl.str("key")), nil); r.status != 403 {
			t.Errorf("the failed attempt's token must be revoked: %d", r.status)
		}
		got := e.n.s3b(cl.bearer(), "GET", objPath("bkt", cl.str("key")), nil)
		if string(got.body) != "orig" {
			t.Errorf("a retried attempt starts from the slot as it was: %q", got.body)
		}
		if cl.Header.Get("X-Binvault-Attempt") != "2" || cl.Inv["run"].(map[string]any)["attempt"].(float64) != 2 {
			t.Errorf("attempt number: %v", cl.Header)
		}
		return reply{Status: 204}
	})
	e.n.must(e.c, 200, "PUT", objPath("bkt", "k"), []byte("orig"))
	if attempts.Load() != 2 {
		t.Fatalf("attempts = %d", attempts.Load())
	}
	r := e.n.waitRunState("pipeline=gate", "succeeded")
	if r["attempt"].(float64) != 2 || r["max_attempts"].(float64) != 3 {
		t.Fatalf("run: %v", r)
	}
	if got := e.n.must(e.c, 200, "GET", objPath("bkt", "k"), nil); string(got.body) != "orig" {
		t.Fatalf("committed %q", got.body)
	}
}

func TestBeforeNoCapacity(t *testing.T) {
	e := newGate(t, nil, map[string]any{"limits": map[string]any{"max_concurrency": 1, "queue_timeout": "150ms"}}, nil)
	hold := make(chan struct{})
	in := make(chan struct{}, 1)
	e.svc.on("gate", func(cl *call) reply {
		if cl.str("key") == "slow" {
			in <- struct{}{}
			<-hold
		}
		return reply{}
	})
	done := make(chan *resp, 1)
	go func() { done <- e.n.s3(e.c, "PUT", objPath("bkt", "slow"), []byte("x")) }()
	<-in
	r := e.n.s3(e.c, "PUT", objPath("bkt", "quick"), []byte("x"))
	if r.status != 502 || r.code() != "PipelineFailed" || strings.Contains(r.message(), "capacity") {
		t.Fatalf("second write: %d %s %s", r.status, r.code(), r.message())
	}
	if run := e.n.waitRunState("pipeline=gate", "failed"); !strings.Contains(str(run, "error"), "no capacity") {
		t.Fatalf("the cause belongs in the run record: %v", run)
	}
	close(hold)
	if r := <-done; r.status != 200 {
		t.Fatalf("first write: %d", r.status)
	}
	e.n.must(e.c, 200, "PUT", objPath("bkt", "after"), []byte("x")) // the slot is free again
}

func TestBeforeSlotWaitSucceedsWithinQueueTimeout(t *testing.T) {
	e := newGate(t, nil, map[string]any{"limits": map[string]any{"max_concurrency": 1, "queue_timeout": "5s"}}, nil)
	e.svc.on("gate", func(cl *call) reply { return reply{Delay: 300 * time.Millisecond} })
	done := make(chan int, 2)
	for i := 0; i < 2; i++ {
		go func(i int) { done <- e.n.s3(e.c, "PUT", objPath("bkt", fmt.Sprintf("k%d", i)), []byte("x")).status }(i)
	}
	if a, b := <-done, <-done; a != 200 || b != 200 {
		t.Fatalf("both writes should get through one after the other: %d %d", a, b)
	}
}

func TestBeforeChainBudget(t *testing.T) {
	// a 2s budget; every pipeline takes 1.2s
	tight := func(c *config.Config) { c.PipelineBeforeTotalTimeout = 2 * time.Second }
	build := func(t *testing.T, secondOnError string) (*node, *fakeSvc, cred) {
		n := startNode(t, "", tight)
		svc := newService(t)
		n.bucket("bkt", nil)
		c := n.token("bkt", allGrants)
		n.createPipe(svc, "one", "before", map[string]any{"token": stagedGrants, "on_error": "continue", "service": map[string]any{"timeout": "2s"}})
		n.createPipe(svc, "two", "before", map[string]any{"token": stagedGrants, "on_error": secondOnError, "service": map[string]any{"timeout": "2s"}})
		n.createPipe(svc, "three", "before", map[string]any{"token": stagedGrants, "on_error": secondOnError})
		n.attach("bkt", "one", "two", "three")
		slow := func(*call) reply { return reply{Delay: 1200 * time.Millisecond} }
		svc.on("one", slow)
		svc.on("two", slow)
		svc.on("three", slow)
		return n, svc, c
	}

	t.Run("exhausted with a rejecting pipeline unfinished", func(t *testing.T) {
		n, svc, c := build(t, "reject")
		start := time.Now()
		r := n.s3(c, "PUT", objPath("bkt", "k"), []byte("x"))
		if r.status != 504 || r.code() != "PipelineTimeout" {
			t.Fatalf("response: %d %s %s", r.status, r.code(), r.message())
		}
		if d := time.Since(start); d > 6*time.Second {
			t.Fatalf("the chain must stop at its budget, took %v", d)
		}
		n.must(c, 404, "GET", objPath("bkt", "k"), nil)
		n.waitRunState("pipeline=one", "succeeded")
		n.waitRunState("pipeline=two", "failed")
		n.waitRunState("pipeline=three", "skipped")
		if r := n.runs("pipeline=three")[0]; r["reason"] != "chain_aborted" {
			t.Fatalf("three: %v", r)
		}
		if len(svc.callsOf("three")) != 0 {
			t.Fatal("the pipeline after the budget must not be called")
		}
	})
	t.Run("exhausted with only continuing pipelines unfinished", func(t *testing.T) {
		n, svc, c := build(t, "continue")
		r := n.s3(c, "PUT", objPath("bkt", "k"), []byte("x"))
		if r.status != 200 {
			t.Fatalf("every unfinished pipeline is on_error=continue: the write commits: %d %s", r.status, r.code())
		}
		n.must(c, 200, "GET", objPath("bkt", "k"), nil)
		three := n.waitRunState("pipeline=three", "skipped")
		if three["reason"] != "budget_exhausted" || len(svc.callsOf("three")) != 0 {
			t.Fatalf("three: %v", three)
		}
	})
}

func TestBeforeClientDisconnectAbortsTheChain(t *testing.T) {
	e := newGate(t, nil, nil, nil)
	arrived := make(chan *call, 1)
	released := make(chan struct{})
	e.svc.on("gate", func(cl *call) reply {
		arrived <- cl
		select {
		case <-released:
		case <-time.After(10 * time.Second):
		}
		return reply{}
	})
	ctx, cancel := context.WithCancel(context.Background())
	errc := make(chan error, 1)
	go func() {
		req := e.n.signedReq(e.c, "PUT", objPath("bkt", "k"), []byte("payload"))
		_, err := http.DefaultClient.Do(req.WithContext(ctx))
		errc <- err
	}()
	cl := <-arrived
	tok := cl.bearer()
	if r := e.n.s3b(tok, "GET", objPath("bkt", "k"), nil); r.status != 200 {
		t.Fatalf("the token works while the chain runs: %d", r.status)
	}
	cancel() // the client gives up
	<-errc
	eventually(t, 5*time.Second, "the token to be revoked", func() bool {
		return e.n.s3b(tok, "GET", objPath("bkt", "k"), nil).status == 403
	})
	close(released)
	time.Sleep(100 * time.Millisecond)
	e.n.must(e.c, 404, "GET", objPath("bkt", "k"), nil) // nothing was committed
	if r := e.n.waitRunState("pipeline=gate", "failed"); r == nil {
		t.Fatal("the interrupted run is recorded")
	}
}

// A request of an ended attempt can never land: neither a request that starts
// after the call returned, nor one still in flight when it returned.
func TestBeforeLatePutAfterTheAttemptEnded(t *testing.T) {
	e := newGate(t, nil, nil, nil)
	lateStatus := make(chan int, 1)
	inflight := make(chan int, 1)
	e.svc.on("gate", func(cl *call) reply {
		tok, path := cl.bearer(), objPath("bkt", cl.str("key"))
		// a PUT whose body is still arriving when the call returns
		go func() {
			pr := newSlowBody("LATE-INFLIGHT", 100*time.Millisecond)
			r := e.n.s3bStream(tok, "PUT", path, pr)
			inflight <- r
		}()
		time.Sleep(50 * time.Millisecond) // let it start
		// and one that comes after
		go func() {
			time.Sleep(300 * time.Millisecond)
			lateStatus <- e.n.s3b(tok, "PUT", path, []byte("LATE-AFTER")).status
		}()
		return reply{Status: 204}
	})
	e.n.must(e.c, 200, "PUT", objPath("bkt", "k"), []byte("original"))
	select {
	case st := <-lateStatus:
		if st != 403 {
			t.Fatalf("a late PUT with an ended token must be refused, got %d", st)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("no late status")
	}
	select {
	case st := <-inflight:
		if st == 200 {
			t.Fatalf("an in-flight PUT must be aborted when the attempt ends, got %d", st)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("no in-flight status")
	}
	time.Sleep(300 * time.Millisecond)
	if got := e.n.must(e.c, 200, "GET", objPath("bkt", "k"), nil); string(got.body) != "original" {
		t.Fatalf("committed %q: a late write landed", got.body)
	}
}
