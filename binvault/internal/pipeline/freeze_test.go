package pipeline_test

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"
	"time"
)

// A bucket that is being moved: its calls in flight are cancelled and their runs
// go back to queued, nothing of it is dispatched while it is frozen, other
// buckets carry on, and thawing resumes it (spec §8.8 step 3).
func TestFreezeBucketRequeuesCallsInFlight(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	n.bucket("other", nil)
	c := n.token("bkt", allGrants)
	oc := n.token("other", allGrants)
	n.createPipe(svc, "p", "after", map[string]any{"token": map[string]any{"grants": []any{}}})
	n.attach("bkt", "p")
	n.attach("other", "p")
	var hold atomic.Bool
	hold.Store(true)
	inCall := make(chan struct{}, 4)
	release := make(chan struct{})
	t.Cleanup(func() { close(release) })
	svc.on("p", func(cl *call) reply {
		if cl.str("bucket") == "bkt" && hold.Load() {
			inCall <- struct{}{}
			<-release // the call is cancelled long before it would end
		}
		return reply{}
	})
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x"))
	<-inCall

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	start := time.Now()
	if err := n.app.Pipes.FreezeBucket(ctx, "bkt"); err != nil {
		t.Fatal(err)
	}
	if time.Since(start) > 5*time.Second {
		t.Fatalf("the freeze waited for the call to end on its own")
	}
	run := n.runs("pipeline=p&bucket=bkt")[0]
	if run["state"] != "queued" || num(run, "attempt") != 0 {
		t.Fatalf("the run of the cancelled call goes back to the queue without a counted attempt: %v", run)
	}

	// nothing of the frozen bucket is dispatched, however often the scheduler looks
	hold.Store(false)
	calls := len(svc.callsOf("p"))
	n.must(c, 200, "PUT", objPath("bkt", "k2"), []byte("y")) // (refused or not, no new run may start)
	n.must(oc, 200, "PUT", objPath("other", "o"), []byte("z"))
	n.waitRunState("pipeline=p&bucket=other", "succeeded") // another bucket carries on
	time.Sleep(700 * time.Millisecond)
	for _, r := range n.runs("pipeline=p&bucket=bkt") {
		if r["state"] != "queued" {
			t.Fatalf("a run of a frozen bucket moved: %v", r)
		}
	}
	for _, cl := range svc.callsOf("p")[calls:] {
		if cl.str("bucket") == "bkt" {
			t.Fatal("the service was called for a frozen bucket")
		}
	}

	n.app.Pipes.ThawBucket("bkt")
	eventually(t, 10*time.Second, "the runs after the thaw", func() bool {
		return len(n.runs("pipeline=p&bucket=bkt&state=succeeded&limit=10")) == 2
	})
}

// The walk of a backfill does nothing while its bucket is frozen, and goes on
// where it stopped after the thaw.
func TestFreezeBucketPausesBackfillWalks(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	for i := 0; i < 50; i++ {
		n.must(c, 200, "PUT", objPath("bkt", fmt.Sprintf("o/%03d", i)), []byte("x"))
	}
	n.createPipe(svc, "idx", "after", map[string]any{
		"limits": map[string]any{"max_concurrency": 1}, "token": map[string]any{"grants": []any{}},
	})
	n.attach("bkt", "idx")
	svc.on("idx", func(*call) reply { return reply{Delay: 40 * time.Millisecond} })
	out := n.mustAdmin(202, "POST", "/backfills", map[string]any{"bucket": "bkt", "pipeline": "idx"})
	id := out["id"].(string)
	eventually(t, 10*time.Second, "the walk to start", func() bool {
		return n.mustAdmin(200, "GET", "/backfills/"+id, nil)["scanned"].(float64) > 0
	})
	if err := n.app.Pipes.FreezeBucket(context.Background(), "bkt"); err != nil {
		t.Fatal(err)
	}
	scanned := n.mustAdmin(200, "GET", "/backfills/"+id, nil)["scanned"]
	time.Sleep(700 * time.Millisecond)
	got := n.mustAdmin(200, "GET", "/backfills/"+id, nil)
	if got["scanned"] != scanned || got["state"] != "running" {
		t.Fatalf("a frozen bucket's backfill moved on: %v -> %v", scanned, got)
	}
	n.app.Pipes.ThawBucket("bkt")
	eventually(t, 30*time.Second, "the walk to finish", func() bool {
		return n.mustAdmin(200, "GET", "/backfills/"+id, nil)["state"] == "completed"
	})
}
