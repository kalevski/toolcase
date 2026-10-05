package pipeline_test

import (
	"github.com/kalevski/toolcase/binvault/internal/config"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestAfterOnError(t *testing.T) {
	for _, mode := range []string{"stop", "continue"} {
		t.Run(mode, func(t *testing.T) {
			n := startNode(t, "", nil)
			svc := newService(t)
			n.bucket("bkt", nil)
			c := n.token("bkt", allGrants)
			noTok := map[string]any{"grants": []any{}}
			n.createPipe(svc, "one", "after", map[string]any{"token": noTok})
			n.createPipe(svc, "two", "after", map[string]any{"token": noTok, "on_error": mode, "retry": map[string]any{"max_attempts": 1}})
			n.createPipe(svc, "three", "after", map[string]any{"token": noTok})
			n.attach("bkt", "one", "two", "three")
			svc.on("two", func(*call) reply { return reply{Status: 422, Body: `{"message":"nope"}`} })
			n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x"))

			failed := n.waitRunState("pipeline=two", "failed")
			if failed["message"] != "nope" || num(failed, "http_status") != 422 {
				t.Fatalf("failed run: %v", failed)
			}
			if mode == "stop" {
				skipped := n.waitRunState("pipeline=three", "skipped")
				if skipped["reason"] != "earlier_step_failed" {
					t.Fatalf("reason = %v", skipped["reason"])
				}
				if len(svc.callsOf("three")) != 0 {
					t.Fatal("the step after a failed one must not run on_error=stop")
				}
			} else {
				n.waitRunState("pipeline=three", "succeeded")
			}
		})
	}
}

func TestAfterPausedDisabledAndHeldKeys(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	noTok := map[string]any{"grants": []any{}}
	n.createPipe(svc, "held", "after", map[string]any{"token": noTok, "paused": true})
	n.createPipe(svc, "free", "after", map[string]any{"token": noTok})
	n.attach("bkt", "held", "free")

	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("1"))
	n.must(c, 200, "PUT", objPath("bkt", "other"), []byte("1"))
	// k's first step is held by the pause, so nothing of key k moves, not even the
	// free pipeline's step of the same event
	time.Sleep(300 * time.Millisecond)
	if len(svc.callsOf("held")) != 0 {
		t.Fatal("a paused pipeline is never dispatched")
	}
	held := n.runs("pipeline=held&key=k")[0]
	if held["state"] != "queued" || held["reason"] != "paused" {
		t.Fatalf("held run: %v", held)
	}
	// events still enqueue while paused
	if len(n.runs("pipeline=held")) != 2 {
		t.Fatal("events must keep enqueueing runs while the pipeline is paused")
	}
	// a second event for k waits behind the first, whatever its pipelines
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("2"))
	time.Sleep(200 * time.Millisecond)
	if len(svc.callsOf("free")) != 0 {
		t.Fatalf("free ran while its key was held: %d calls", len(svc.callsOf("free")))
	}

	// disabling turns the pipeline off: no new runs, queued ones stay held
	n.mustAdmin(200, "PATCH", "/pipelines/held", map[string]any{"paused": false, "enabled": false})
	n.must(c, 200, "PUT", objPath("bkt", "third"), []byte("3"))
	time.Sleep(200 * time.Millisecond)
	if rs := n.runs("pipeline=held&key=third"); len(rs) != 0 {
		t.Fatalf("a disabled pipeline gets no new runs: %v", rs)
	}
	if rs := n.runs("pipeline=held&state=queued"); len(rs) != 3 || rs[0]["reason"] != "disabled" {
		t.Fatalf("queued runs of a disabled pipeline: %v", rs)
	}
	if len(svc.callsOf("held")) != 0 {
		t.Fatal("a disabled pipeline is never dispatched")
	}
	// the free pipeline works on keys that are not held
	n.waitRunState("pipeline=free&key=third", "succeeded")

	// enabling again releases the backlog in order
	n.mustAdmin(200, "PATCH", "/pipelines/held", map[string]any{"enabled": true})
	eventually(t, 10*time.Second, "the backlog to drain", func() bool {
		return len(n.runs("state=queued")) == 0 && len(n.runs("state=running")) == 0
	})
	// k's first event was superseded by its second while it waited
	if got, sk := len(n.runs("pipeline=held&state=succeeded")), len(n.runs("pipeline=held&state=skipped")); got != 2 || sk != 1 {
		t.Fatalf("held succeeded=%d skipped=%d, want 2 and 1", got, sk)
	}
}

func TestAfterAttachmentDisabledAndCancellation(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	noTok := map[string]any{"grants": []any{}}
	n.createPipe(svc, "a", "after", map[string]any{"token": noTok})
	n.createPipe(svc, "b", "after", map[string]any{"token": noTok})
	// a disabled attachment gets no runs at all
	n.mustAdmin(200, "PUT", "/buckets/bkt/pipelines", map[string]any{"items": []map[string]any{
		{"pipeline": "a", "enabled": false}, {"pipeline": "b"},
	}})
	n.must(c, 200, "PUT", objPath("bkt", "k1"), []byte("x"))
	n.waitRunState("pipeline=b", "succeeded")
	if len(n.runs("pipeline=a")) != 0 {
		t.Fatal("a disabled attachment must not create runs")
	}

	// a queued run whose attachment is disabled is held; removing the attachment cancels it
	n.createPipe(svc, "slow", "after", map[string]any{"token": noTok, "paused": true})
	n.attach("bkt", "slow", "b")
	n.must(c, 200, "PUT", objPath("bkt", "k2"), []byte("x"))
	if rs := n.runs("pipeline=slow&state=queued"); len(rs) != 1 {
		t.Fatalf("queued: %v", rs)
	}
	n.attach("bkt", "b") // slow is gone from the bucket
	r := n.runs("pipeline=slow")[0]
	if r["state"] != "cancelled" || r["reason"] != "attachment_removed" {
		t.Fatalf("after detaching: %v", r)
	}

	// deleting a pipeline: 409 while attached, cancels its queued runs with ?detach=true
	n.attach("bkt", "slow", "b")
	n.must(c, 200, "PUT", objPath("bkt", "k3"), []byte("x"))
	code, body := n.admin("DELETE", "/pipelines/slow", nil)
	if code != 409 || body["error"] != "conflict" {
		t.Fatalf("delete while attached: %d %v", code, body)
	}
	n.mustAdmin(404, "DELETE", "/pipelines/nope", nil)
	n.mustAdmin(204, "DELETE", "/pipelines/slow?detach=true", nil)
	cancelled := n.runs("pipeline=slow&state=cancelled&key=k3")
	if len(cancelled) != 1 || cancelled[0]["reason"] != "pipeline_removed" {
		t.Fatalf("cancelled: %v", cancelled)
	}
	if att := n.mustAdmin(200, "GET", "/buckets/bkt/pipelines", nil); len(att["items"].([]any)) != 1 {
		t.Fatalf("attachments after the detach delete: %v", att)
	}

	// a bucket's queued runs end with the bucket
	n.createPipe(svc, "held2", "after", map[string]any{"token": noTok, "paused": true})
	n.attach("bkt", "held2")
	n.must(c, 200, "PUT", objPath("bkt", "k4"), []byte("x"))
	n.mustAdmin(204, "DELETE", "/buckets/bkt?force=true", nil)
	r = n.runs("pipeline=held2")[0]
	if r["state"] != "cancelled" || r["reason"] != "bucket_removed" {
		t.Fatalf("after bucket deletion: %v", r)
	}
}

func TestAfterRunsAreRequeuedAtStartup(t *testing.T) {
	dir := t.TempDir()
	svc := newService(t)
	block := make(chan struct{})
	started := make(chan struct{}, 1)
	svc.on("slow", func(cl *call) reply {
		select {
		case started <- struct{}{}:
		default:
		}
		<-block
		return reply{}
	})
	n := startNode(t, dir, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "slow", "after", map[string]any{"token": map[string]any{"grants": []any{}}})
	n.attach("bkt", "slow")
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x"))
	<-started
	if r := n.runs("pipeline=slow"); r[0]["state"] != "running" {
		t.Fatalf("expected a running run: %v", r)
	}
	// shutdown while the call is in flight: the grace period lapses, the call is
	// abandoned and the run stays queued, not failed
	svc.on("slow", func(*call) reply { return reply{} })
	n2 := n.restart(nil)
	close(block)

	// a fresh node on the same data: the run is still there and gets executed
	r := n2.waitRunState("pipeline=slow", "succeeded")
	if r["attempt"].(float64) != 1 {
		t.Fatalf("the interrupted attempt must not be counted: %v", r)
	}
}

// TestAfterDepthLimit: a chain of pipelines each reacting to the previous one's
// output is cut once its events are deeper than BINVAULT_PIPELINE_MAX_DEPTH, and
// a skipped (depth_limit) record is kept.
func TestAfterDepthLimit(t *testing.T) {
	n := startNode(t, "", func(c *config.Config) { c.PipelineMaxDepth = 2 })
	svc := newService(t)
	n.bucket("bkt", nil)
	cr := n.token("bkt", allGrants)
	stages := []string{"p1", "p2", "p3", "p4"}
	for i, name := range stages {
		in, out := "s"+strconv.Itoa(i+1)+"/", "s"+strconv.Itoa(i+2)+"/"
		n.createPipe(svc, name, "after", map[string]any{
			"match": map[string]any{"keys": []string{in + "**"}},
			"token": map[string]any{"grants": []map[string]any{
				{"actions": []string{"read"}, "keys": []string{"{key}"}},
				{"actions": []string{"write"}, "keys": []string{out + "*"}},
			}},
		})
		svc.on(name, func(cl *call) reply {
			if r := n.s3b(cl.bearer(), "PUT", objPath("bkt", out+"x"), []byte("d")); r.status != 200 {
				t.Errorf("derivative write: %d %s", r.status, r.code())
				return reply{Status: 500}
			}
			return reply{}
		})
	}
	n.attach("bkt", stages...)
	n.must(cr, 200, "PUT", objPath("bkt", "s1/x"), []byte("seed"))

	skipped := func() []map[string]any { return n.runs("state=skipped") }
	eventually(t, 15*time.Second, "the chain to be cut", func() bool { return len(skipped()) > 0 })
	time.Sleep(300 * time.Millisecond)
	sk := skipped()
	if len(sk) != 1 || sk[0]["reason"] != "depth_limit" || sk[0]["pipeline"] != "p4" || sk[0]["key"] != "s4/x" {
		t.Fatalf("expected one depth_limit record for p4, got %v", sk)
	}
	// seed (depth 0) -> p1 writes s2/x (1) -> p2 writes s3/x (2) -> p3 writes s4/x (3, cut)
	lin := sk[0]["lineage"].(map[string]any)
	if lin["depth"].(float64) != 3 {
		t.Fatalf("lineage: %v", lin)
	}
	chain := lin["chain"].([]any)
	if len(chain) != 3 || chain[0] != "p1" || chain[1] != "p2" || chain[2] != "p3" {
		t.Fatalf("chain = %v", chain)
	}
	if got := len(svc.allCalls()); got != 3 {
		t.Fatalf("service calls = %d, want 3 (the fourth event is past the depth limit)", got)
	}
	if a := sk[0]["actor"].(map[string]any); a["kind"] != "pipeline" || a["pipeline"] != "p3" {
		t.Fatalf("actor of a pipeline write: %v", a)
	}
}

// TestAfterCycleBetweenTwoPipelines: a pipeline never runs for an event whose
// chain holds it, so two pipelines feeding each other stop after one round.
func TestAfterCycleBetweenTwoPipelines(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	cr := n.token("bkt", allGrants)
	for _, d := range []struct{ name, in, out string }{{"ping", "a/", "b/"}, {"pong", "b/", "a/"}} {
		out := d.out
		n.createPipe(svc, d.name, "after", map[string]any{
			"match": map[string]any{"keys": []string{d.in + "**"}},
			"token": map[string]any{"grants": []map[string]any{{"actions": []string{"read"}, "keys": []string{"{key}"}}, {"actions": []string{"write"}, "keys": []string{out + "*"}}}},
		})
		svc.on(d.name, func(cl *call) reply {
			if r := n.s3b(cl.bearer(), "PUT", objPath("bkt", out+cl.str("key")[2:]+"x"), []byte("d")); r.status != 200 {
				return reply{Status: 500}
			}
			return reply{}
		})
	}
	n.attach("bkt", "ping", "pong")
	n.must(cr, 200, "PUT", objPath("bkt", "a/1"), []byte("seed"))
	eventually(t, 10*time.Second, "two rounds", func() bool { return len(n.runs("state=succeeded")) == 2 })
	time.Sleep(300 * time.Millisecond)
	if len(n.runs("")) != 2 || len(svc.allCalls()) != 2 {
		t.Fatalf("the cycle must stop at once: %d runs", len(n.runs("")))
	}
}

func TestAfterNoSelfTrigger(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	cr := n.token("bkt", allGrants)
	// the pipeline rewrites its own input: a pipeline never runs for an event whose chain holds it
	n.createPipe(svc, "rewriter", "after", map[string]any{
		"token": map[string]any{"grants": []map[string]any{{"actions": []string{"read"}, "keys": []string{"{key}"}}, {"actions": []string{"write"}, "keys": []string{"other/*"}}}},
	})
	n.attach("bkt", "rewriter")
	var writes atomic.Int32
	svc.on("rewriter", func(cl *call) reply {
		writes.Add(1)
		if r := n.s3b(cl.bearer(), "PUT", objPath("bkt", "other/out"), []byte("out")); r.status != 200 {
			t.Errorf("write: %d", r.status)
		}
		return reply{}
	})
	n.must(cr, 200, "PUT", objPath("bkt", "in"), []byte("x"))
	n.waitRunState("pipeline=rewriter", "succeeded")
	time.Sleep(300 * time.Millisecond)
	if writes.Load() != 1 || len(n.runs("pipeline=rewriter")) != 1 {
		t.Fatalf("the pipeline re-triggered itself: %d calls, %d runs", writes.Load(), len(n.runs("pipeline=rewriter")))
	}
	_ = strings.TrimSpace
}
