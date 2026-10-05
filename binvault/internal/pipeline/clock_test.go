package pipeline_test

import (
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/app"
	"github.com/kalevski/toolcase/binvault/internal/config"
)

// skewedClock is the node's pipeline clock plus an offset the test moves.
type skewedClock struct{ offset atomic.Int64 }

func (c *skewedClock) now() time.Time          { return time.Now().Add(time.Duration(c.offset.Load())) }
func (c *skewedClock) advance(d time.Duration) { c.offset.Add(int64(d)) }

func startWithClock(t *testing.T, clk *skewedClock) *node {
	t.Helper()
	cfg := config.ForTest(func(c *config.Config) {
		c.DataDir = t.TempDir()
		c.Listen, c.AdminListen = "127.0.0.1:0", "127.0.0.1:0"
		c.Fsync = false
		c.MinFreeMB = 1
		c.ShutdownTimeout = 3 * time.Second
	})
	return startNodeCfg(t, cfg, func(a *app.App) { a.Pipes.Now = clk.now })
}

// A run is retried until it has been runnable for 24 hours (spec §7.10).
func TestAfterRetryWindowIs24Hours(t *testing.T) {
	clk := &skewedClock{}
	n := startWithClock(t, clk)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "p", "after", map[string]any{
		"token": map[string]any{"grants": []any{}},
		"retry": map[string]any{"max_attempts": 10, "backoff": []string{"150ms"}},
	})
	n.attach("bkt", "p")
	svc.on("p", func(*call) reply { return reply{Status: 503} })
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x"))
	eventually(t, 10*time.Second, "the first attempt", func() bool { return len(svc.callsOf("p")) >= 1 })
	clk.advance(25 * time.Hour)
	r := n.waitRunState("pipeline=p", "failed")
	if !strings.Contains(str(r, "error"), "24 hours") || num(r, "attempt") >= 10 {
		t.Fatalf("a run that has been failing for a day gives up: %v", r)
	}
}

// Time a pipeline spent paused (or disabled) does not count toward the 24 hours.
func TestAfterHeldTimeDoesNotCount(t *testing.T) {
	for name, hold := range map[string][2]func(n *node){
		"paused":   {func(n *node) { n.mustAdmin(200, "PATCH", "/pipelines/p", map[string]any{"paused": true}) }, func(n *node) { n.mustAdmin(200, "PATCH", "/pipelines/p", map[string]any{"paused": false}) }},
		"disabled": {func(n *node) { n.mustAdmin(200, "PATCH", "/pipelines/p", map[string]any{"enabled": false}) }, func(n *node) { n.mustAdmin(200, "PATCH", "/pipelines/p", map[string]any{"enabled": true}) }},
		"attachment disabled": {
			func(n *node) {
				n.mustAdmin(200, "PUT", "/buckets/bkt/pipelines", map[string]any{"items": []map[string]any{{"pipeline": "p", "enabled": false}}})
			},
			func(n *node) {
				n.mustAdmin(200, "PUT", "/buckets/bkt/pipelines", map[string]any{"items": []map[string]any{{"pipeline": "p", "enabled": true}}})
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			clk := &skewedClock{}
			n := startWithClock(t, clk)
			svc := newService(t)
			n.bucket("bkt", nil)
			c := n.token("bkt", allGrants)
			n.createPipe(svc, "p", "after", map[string]any{
				"token": map[string]any{"grants": []any{}},
				"retry": map[string]any{"max_attempts": 10, "backoff": []string{"150ms"}},
			})
			n.attach("bkt", "p")
			var ok atomic.Bool
			svc.on("p", func(*call) reply {
				if ok.Load() {
					return reply{}
				}
				return reply{Status: 503}
			})
			n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x"))
			eventually(t, 10*time.Second, "the first attempt", func() bool { return len(svc.callsOf("p")) >= 1 })
			hold[0](n)
			time.Sleep(300 * time.Millisecond)
			clk.advance(30 * time.Hour) // a day and more, all of it held
			hold[1](n)
			// the next attempt fails again; had the held day counted, the run would
			// now give up instead of waiting for its retry
			eventually(t, 10*time.Second, "the second attempt", func() bool { return len(svc.callsOf("p")) >= 2 })
			time.Sleep(300 * time.Millisecond)
			if r := n.runs("pipeline=p")[0]; r["state"] == "failed" {
				t.Fatalf("held time must not count toward the 24 hours: %v", r)
			}
			ok.Store(true)
			n.waitRunState("pipeline=p", "succeeded")
		})
	}
}

// The time a pipeline was held is remembered across a restart: pausing it over
// a long maintenance and restarting the node must not make its queued runs give
// up at the next attempt (spec §7.10).
func TestAfterHeldTimeSurvivesARestart(t *testing.T) {
	clk := &skewedClock{}
	n := startWithClock(t, clk)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "p", "after", map[string]any{
		"token": map[string]any{"grants": []any{}},
		"retry": map[string]any{"max_attempts": 10, "backoff": []string{"150ms"}},
	})
	n.attach("bkt", "p")
	var ok atomic.Bool
	svc.on("p", func(*call) reply {
		if ok.Load() {
			return reply{}
		}
		return reply{Status: 503}
	})
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x"))
	eventually(t, 10*time.Second, "the first attempt", func() bool { return len(svc.callsOf("p")) >= 1 })
	n.mustAdmin(200, "PATCH", "/pipelines/p", map[string]any{"paused": true})
	time.Sleep(300 * time.Millisecond)
	clk.advance(30 * time.Hour) // all of it held

	n.stop()
	cfg := *n.cfg
	cfg.Listen, cfg.AdminListen = "127.0.0.1:0", "127.0.0.1:0"
	n2 := startNodeCfg(t, &cfg, func(a *app.App) { a.Pipes.Now = clk.now })
	n2.mustAdmin(200, "PATCH", "/pipelines/p", map[string]any{"paused": false})

	calls := len(svc.callsOf("p"))
	eventually(t, 10*time.Second, "the next attempt", func() bool { return len(svc.callsOf("p")) > calls })
	time.Sleep(300 * time.Millisecond)
	if r := n2.runs("pipeline=p")[0]; r["state"] == "failed" {
		t.Fatalf("held time must not count toward the 24 hours, restart or not: %v", r)
	}
	ok.Store(true)
	n2.waitRunState("pipeline=p", "succeeded")
}
