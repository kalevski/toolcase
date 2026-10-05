package pipeline_test

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/app"
	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/sigv4"
)

// A pipeline token can presign; the URL dies with the token (spec §7.8).
func TestPipelineTokenPresignedURLsDieWithTheToken(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "p", "after", nil) // read on {key}
	n.attach("bkt", "p")
	var url string
	var during int
	svc.on("p", func(cl *call) reply {
		req, _ := http.NewRequest("GET", n.s3URL+objPath("bkt", cl.str("key")), nil)
		signed, err := sigv4.Presign(req, cl.str("s3", "access_key_id"), cl.str("s3", "secret_access_key"), "us-east-1", time.Now(), time.Hour)
		if err != nil {
			t.Error(err)
			return reply{Status: 500}
		}
		url = signed
		r, err := http.Get(signed)
		if err == nil {
			during = r.StatusCode
			r.Body.Close()
		}
		return reply{}
	})
	n.must(c, 200, "PUT", objPath("bkt", "doc"), []byte("body"))
	n.waitRunState("pipeline=p", "succeeded")
	if during != 200 {
		t.Fatalf("presigned URL while the call runs: %d", during)
	}
	r, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	r.Body.Close()
	if r.StatusCode != 403 {
		t.Fatalf("a presigned URL of an ended token: %d", r.StatusCode)
	}
}

// The first request after a rewrite of {key} sees a new version: it should be last.
func TestStaleWriteGuardAfterRewritingTheKey(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", map[string]any{"versioning": "enabled"})
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "p", "after", map[string]any{"token": map[string]any{"grants": []map[string]any{
		{"actions": []string{"read", "write"}, "keys": []string{"{key}"}},
	}}, "match": map[string]any{"keys": []string{"in/**"}}})
	n.attach("bkt", "p")
	var first, second atomic.Int32
	svc.on("p", func(cl *call) reply {
		path := objPath("bkt", cl.str("key"))
		first.Store(int32(n.s3b(cl.bearer(), "PUT", path, []byte("rewritten")).status))
		second.Store(int32(n.s3b(cl.bearer(), "GET", path, nil).status))
		return reply{}
	})
	n.must(c, 200, "PUT", objPath("bkt", "in/x"), []byte("orig"))
	n.waitRunState("pipeline=p&key=in/x&state=succeeded", "succeeded")
	if first.Load() != 200 || second.Load() != 412 {
		t.Fatalf("rewrite %d, then read %d", first.Load(), second.Load())
	}
	// the rewrite is its own event, but the pipeline is in its chain: no loop
	time.Sleep(200 * time.Millisecond)
	if len(n.runs("pipeline=p")) != 1 {
		t.Fatal("the rewrite re-triggered the pipeline")
	}
}

func TestRunPruning(t *testing.T) {
	clk := &skewedClock{}
	cfg := config.ForTest(func(c *config.Config) {
		c.DataDir = t.TempDir()
		c.Listen, c.AdminListen = "127.0.0.1:0", "127.0.0.1:0"
		c.Fsync = false
		c.MinFreeMB = 1
		c.PipelineRunRetention = time.Hour
	})
	n := startNodeCfg(t, cfg, func(a *app.App) { a.Pipes.Now = clk.now })
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "p", "after", map[string]any{"token": map[string]any{"grants": []any{}}})
	n.createPipe(svc, "held", "after", map[string]any{"token": map[string]any{"grants": []any{}}, "paused": true})
	n.attach("bkt", "p", "held")
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x"))
	eventually(t, 10*time.Second, "the run", func() bool { return len(n.runs("pipeline=p&state=succeeded")) == 1 })
	// a queued run is never pruned, a finished one only after the retention
	if cnt, err := n.app.Pipes.Prune(context.Background()); err != nil || cnt != 0 {
		t.Fatalf("nothing is old enough yet: %d %v", cnt, err)
	}
	clk.advance(2 * time.Hour)
	cnt, err := n.app.Pipes.Prune(context.Background())
	if err != nil || cnt != 0 && cnt != 1 {
		t.Fatalf("prune: %d %v", cnt, err)
	}
	if got := len(n.runs("pipeline=p")); got != 0 {
		t.Fatalf("finished runs older than BINVAULT_PIPELINE_RUN_RETENTION are deleted: %d left", got)
	}
	if got := len(n.runs("pipeline=held&state=queued")); got != 1 {
		t.Fatalf("a queued run must survive pruning: %d", got)
	}
}

func TestWorkersAndMaxConcurrencyBoundAfterCalls(t *testing.T) {
	for name, tc := range map[string]struct {
		workers, maxConc, want int
	}{
		"max_concurrency binds": {workers: 8, maxConc: 2, want: 2},
		"workers bind":          {workers: 3, maxConc: 16, want: 3},
	} {
		t.Run(name, func(t *testing.T) {
			n := startNode(t, "", func(c *config.Config) { c.PipelineWorkers = tc.workers })
			svc := newService(t)
			n.bucket("bkt", nil)
			c := n.token("bkt", allGrants)
			n.createPipe(svc, "p", "after", map[string]any{
				"token": map[string]any{"grants": []any{}}, "limits": map[string]any{"max_concurrency": tc.maxConc},
			})
			n.attach("bkt", "p")
			var active, peak atomic.Int32
			svc.on("p", func(cl *call) reply {
				cur := active.Add(1)
				for {
					p := peak.Load()
					if cur <= p || peak.CompareAndSwap(p, cur) {
						break
					}
				}
				time.Sleep(150 * time.Millisecond)
				active.Add(-1)
				return reply{}
			})
			for i := 0; i < 12; i++ {
				n.must(c, 200, "PUT", objPath("bkt", fmt.Sprintf("k%d", i)), []byte("x"))
			}
			eventually(t, 20*time.Second, "all runs", func() bool { return len(n.runs("state=succeeded&limit=100")) == 12 })
			if int(peak.Load()) > tc.want || int(peak.Load()) < tc.want {
				t.Fatalf("peak concurrency %d, want %d", peak.Load(), tc.want)
			}
		})
	}
}

func TestOutboundSafetyIsConfigurable(t *testing.T) {
	n := startNode(t, "", func(c *config.Config) { c.PipelineAllowPrivate = false })
	svc := newService(t) // on loopback
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "after1", "after", map[string]any{"token": map[string]any{"grants": []any{}}})
	n.createPipe(svc, "gate", "before", map[string]any{"token": map[string]any{"grants": []any{}}})
	n.createPipe(svc, "meta", "after", map[string]any{"token": map[string]any{"grants": []any{}}, "service": map[string]any{"url": "http://169.254.169.254/latest/meta-data/"}})
	n.attach("bkt", "after1", "meta")
	n.mustAdmin(200, "PUT", "/buckets/bkt/pipelines", map[string]any{"items": []map[string]any{{"pipeline": "gate"}, {"pipeline": "after1"}}})
	r := n.s3(c, "PUT", objPath("bkt", "k"), []byte("x"))
	if r.status != 502 || r.code() != "PipelineFailed" || contains(r.message(), "ALLOW_PRIVATE") {
		t.Fatalf("a gate whose service is on a private address: %d %s %s", r.status, r.code(), r.message())
	}
	if run := n.waitRunState("pipeline=gate", "failed"); !contains(str(run, "error"), "ALLOW_PRIVATE") {
		t.Fatalf("the cause belongs in the run record: %v", run)
	}
	if len(svc.allCalls()) != 0 {
		t.Fatal("the service must not have been contacted")
	}
	n.mustAdmin(200, "PUT", "/buckets/bkt/pipelines", map[string]any{"items": []map[string]any{{"pipeline": "after1"}, {"pipeline": "meta"}}})
	n.must(c, 200, "PUT", objPath("bkt", "k2"), []byte("x"))
	r1 := n.waitRunState("pipeline=after1", "failed")
	if r1["attempt"].(float64) != 1 || !contains(str(r1, "error"), "ALLOW_PRIVATE") {
		t.Fatalf("a refused address is a permanent failure: %v", r1)
	}
}

// Link-local and cloud-metadata addresses are refused whatever the setting.
func TestMetadataEndpointIsAlwaysRefused(t *testing.T) {
	n := startNode(t, "", nil) // private addresses allowed (the default)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "meta", "after", map[string]any{
		"token":   map[string]any{"grants": []any{}},
		"service": map[string]any{"url": "http://169.254.169.254/latest/meta-data/"},
	})
	n.createPipe(svc, "metagate", "before", map[string]any{
		"token":   map[string]any{"grants": []any{}},
		"service": map[string]any{"url": "http://[fe80::1]:8080/"},
		"match":   map[string]any{"keys": []string{"gated/**"}},
	})
	n.mustAdmin(200, "PUT", "/buckets/bkt/pipelines", map[string]any{"items": []map[string]any{{"pipeline": "metagate"}, {"pipeline": "meta"}}})
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x"))
	r := n.waitRunState("pipeline=meta", "failed")
	if r["attempt"].(float64) != 1 || !contains(str(r, "error"), "not allowed") {
		t.Fatalf("metadata address: %v", r)
	}
	if g := n.s3(c, "PUT", objPath("bkt", "gated/x"), []byte("x")); g.status != 502 || g.code() != "PipelineFailed" {
		t.Fatalf("gate on a link-local address fails closed: %d %s", g.status, g.code())
	}
}

func TestBucketDeletionWithAttachments(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	n.createPipe(svc, "p", "after", nil)
	n.attach("bkt", "p")
	if d := n.mustAdmin(200, "GET", "/pipelines/p", nil); len(d["attached_to"].([]any)) != 1 {
		t.Fatalf("attached_to: %v", d["attached_to"])
	}
	n.mustAdmin(204, "DELETE", "/buckets/bkt", nil) // empty: no force needed
	if d := n.mustAdmin(200, "GET", "/pipelines/p", nil); len(d["attached_to"].([]any)) != 0 {
		t.Fatalf("a deleted bucket leaves its pipelines: %v", d["attached_to"])
	}
	n.mustAdmin(204, "DELETE", "/pipelines/p", nil) // no longer attached: no detach needed
	// and a recreated bucket starts without attachments
	n.bucket("bkt", nil)
	if got := n.mustAdmin(200, "GET", "/buckets/bkt/pipelines", nil); len(got["items"].([]any)) != 0 {
		t.Fatalf("recreated bucket: %v", got)
	}
}

// Pipeline admin calls that race with traffic neither deadlock nor corrupt state.
func TestAdminChurnUnderTraffic(t *testing.T) {
	if testing.Short() {
		t.Skip("churn")
	}
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	noTok := map[string]any{"grants": []any{}}
	n.createPipe(svc, "a", "after", map[string]any{"token": noTok})
	n.createPipe(svc, "g", "before", map[string]any{"token": noTok})
	n.attach("bkt", "g", "a")
	var wg sync.WaitGroup
	stop := make(chan struct{})
	var puts atomic.Int32
	for w := 0; w < 4; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			for i := 0; ; i++ {
				select {
				case <-stop:
					return
				default:
				}
				r := n.s3(c, "PUT", objPath("bkt", fmt.Sprintf("w%d/%d", w, i)), []byte("x"))
				if r.status == 200 {
					puts.Add(1)
				}
			}
		}(w)
	}
	for i := 0; i < 25; i++ {
		n.mustAdmin(200, "PATCH", "/pipelines/a", map[string]any{"paused": i%2 == 0})
		n.mustAdmin(200, "PATCH", "/pipelines/g", map[string]any{"enabled": i%3 != 0})
		n.attach("bkt", "g", "a")
		time.Sleep(10 * time.Millisecond)
	}
	close(stop)
	wg.Wait()
	n.mustAdmin(200, "PATCH", "/pipelines/a", map[string]any{"paused": false})
	n.mustAdmin(200, "PATCH", "/pipelines/g", map[string]any{"enabled": true})
	eventually(t, 60*time.Second, "the backlog to drain", func() bool {
		return len(n.runs("state=queued&limit=1")) == 0 && len(n.runs("state=running&limit=1")) == 0
	})
	n.assertNoStaged()
	if puts.Load() == 0 {
		t.Fatal("no write succeeded")
	}
}
