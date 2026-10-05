package app_test

import (
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/app"
	"github.com/kalevski/toolcase/binvault/internal/cluster"
)

// ?wait=replicated returns once every peer has put the change into effect, not merely
// once it holds the op: a read through any node right after the 201 sees the change
// (spec §6.1, §8.5). A peer's acknowledgement is the version vector it pulls with, and
// that vector covers whatever the peer has applied, whichever of its pull loops applied
// it. Node c is made to learn the op from b (a relay) while the delivery of the op's
// change to its subscribers is held back, so it holds the op in the catalog but has not
// materialised the pipeline; when c can talk to the writer again, the writer must still
// wait for it. (Without the fix c's next exchange with a acknowledged the op at once, and
// a pipeline GET through c answered 404 right after a 201.)
func TestClusterReplicatedWaitCoversTheEffectOnEveryPeer(t *testing.T) {
	var cutOff atomic.Bool // a refuses c's pulls while set
	var cID atomic.Value   // c's node id, known once the cluster runs
	entered := make(chan struct{})
	gate := make(chan struct{})
	var hold, open sync.Once

	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		switch i {
		case 0:
			o.PeerWrap = func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if id, _ := cID.Load().(string); id != "" && cutOff.Load() && r.Header.Get(cluster.HeaderNode) == id && strings.HasSuffix(r.URL.Path, "/ops") {
						http.Error(w, "cut off by the test", http.StatusServiceUnavailable)
						return
					}
					next.ServeHTTP(w, r)
				})
			}
		case 2:
			o.ClusterTuning.BeforeDeliver = func(changes []cluster.Change) {
				for _, ch := range changes {
					if ch.Key == "pipeline/late" {
						hold.Do(func() { close(entered); <-gate })
					}
				}
			}
		}
	})
	// registered after the cluster's own cleanup, so it runs before the nodes are stopped
	t.Cleanup(func() { open.Do(func() { close(gate) }) })
	a, c := tc.nodes[0], tc.nodes[2]
	cID.Store(c.nodeID())
	svc := newFsvc(t)

	// the write: a cannot be reached by c, so c can only learn the op through b
	cutOff.Store(true)
	type result struct {
		code int
		out  map[string]any
	}
	done := make(chan result, 1)
	go func() {
		code, out := a.admin("POST", "/pipelines?wait=replicated", pipeDef("late", "after", svc.url("late"), a.s3URL, nil))
		done <- result{code, out}
	}()
	select {
	case <-entered:
	case <-time.After(10 * time.Second):
		t.Fatal("the change of the new pipeline did not reach c's dispatcher")
	}
	if _, ok := c.app.Cluster().Pipeline("late"); !ok {
		t.Fatal("c should hold the op in its catalog by now")
	}
	if code, _ := c.admin("GET", "/pipelines/late", nil); code != 404 {
		t.Fatalf("the setup did not hold: c has materialised the pipeline already (%d)", code)
	}

	// c talks to a again: its vector covers the op, but the change has not been delivered
	cutOff.Store(false)
	select {
	case r := <-done:
		t.Fatalf("a's ?wait=replicated returned %d while c had not put the pipeline into effect: %v", r.code, r.out)
	case <-time.After(1500 * time.Millisecond):
	}
	open.Do(func() { close(gate) })
	select {
	case r := <-done:
		if r.code != 201 {
			t.Fatalf("?wait=replicated after c caught up: %d %v", r.code, r.out)
		}
	case <-time.After(15 * time.Second):
		t.Fatal("?wait=replicated did not return after c's subscribers caught up")
	}
	for _, n := range tc.nodes {
		if got := n.mustAdmin(200, "GET", "/pipelines/late", nil); got["name"] != "late" {
			t.Fatalf("%s: %v", n.name, got)
		}
	}
}
