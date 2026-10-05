package pipeline_test

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/pipeline"
)

// Regression tests for the findings of the pipelines correctness review.

// stallWriter holds the single writer so that the next requests share one batch;
// the returned function lets it go.
func (n *node) stallWriter() (release func()) {
	n.t.Helper()
	hold := make(chan struct{})
	stalled := make(chan struct{})
	go func() {
		_ = n.app.DB.Update(context.Background(), func(tx *meta.Tx) error {
			close(stalled)
			<-hold
			return nil
		})
	}()
	<-stalled
	return func() { close(hold) }
}

// An attachments change and a write that land in one group commit, the change
// first: the write's outbox must see the new list, not the cached one. Otherwise
// it queues a run for the pipeline that was just detached, and nothing ever
// cancels it.
func TestOutboxSeesAnAttachmentChangeMadeInTheSameBatch(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "a", "after", map[string]any{"token": map[string]any{"grants": []any{}}, "paused": true})
	n.attach("bkt", "a")

	release := n.stallWriter()
	doneA := make(chan struct{})
	go func() {
		n.mustAdmin(200, "PUT", "/buckets/bkt/pipelines", map[string]any{"items": []map[string]any{}}) // detach a
		close(doneA)
	}()
	time.Sleep(300 * time.Millisecond) // queued behind the stalled request
	doneB := make(chan struct{})
	go func() {
		n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x"))
		close(doneB)
	}()
	time.Sleep(300 * time.Millisecond) // queued behind the detach
	release()
	<-doneA
	<-doneB

	if rs := n.runs("pipeline=a&limit=100"); len(rs) != 0 {
		t.Fatalf("a write committed after the detach queued runs for the detached pipeline: %v", rs)
	}
}

func (n *node) backfillRuns(id string) int {
	n.t.Helper()
	var c int
	if err := n.app.DB.Raw().QueryRow(`SELECT COUNT(*) FROM runs WHERE backfill_id=?`, id).Scan(&c); err != nil {
		n.t.Fatal(err)
	}
	return c
}

// Once the cancel of a backfill has been answered, the walk queues no more runs:
// a batch it examined before the cancel must not be inserted after it (the runs
// already queued continue, spec §6.8). Several walks at once widen the window.
func TestCancelledBackfillQueuesNoMoreRuns(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	for i := 0; i < 400; i++ {
		n.must(c, 200, "PUT", objPath("bkt", fmt.Sprintf("o/%05d", i)), []byte("x"))
	}
	n.createPipe(svc, "idx", "after", map[string]any{
		"limits": map[string]any{"max_concurrency": 256}, "token": map[string]any{"grants": []any{}},
	})
	svc.on("idx", func(*call) reply { return reply{} })
	n.attach("bkt", "idx")

	const walkers = 8
	for round := 0; round < 10; round++ {
		ids := make([]string, walkers)
		for i := range ids {
			ids[i] = n.mustAdmin(202, "POST", "/backfills", map[string]any{"bucket": "bkt", "pipeline": "idx"})["id"].(string)
		}
		time.Sleep(time.Duration(2+rand.Intn(15)) * time.Millisecond)
		answered := make([]int, walkers) // runs when the cancel was answered, -1: it found the walk over
		var wg sync.WaitGroup
		for i, id := range ids {
			wg.Add(1)
			go func() {
				defer wg.Done()
				answered[i] = -1
				if code, _ := n.admin("POST", "/backfills/"+id+"/cancel", nil); code == 200 {
					answered[i] = n.backfillRuns(id)
				}
			}()
		}
		wg.Wait()
		time.Sleep(150 * time.Millisecond)
		for i, id := range ids {
			if answered[i] >= 0 {
				if got := n.backfillRuns(id); got != answered[i] {
					t.Fatalf("round %d: backfill %s queued %d runs after its cancel was answered", round, id, got-answered[i])
				}
			}
		}
	}
}

// A failed object.deleted run is retried after the key was uploaded again, by a
// pipeline that listens to deletes only (so no later group exists for it): the
// retry is skipped, or it would remove what the new object's runs derived (spec
// §7.10 step 6).
func TestRetryOfAStaleDeletedRunIsSuperseded(t *testing.T) {
	for _, bulk := range []bool{false, true} {
		name := "single"
		if bulk {
			name = "bulk"
		}
		t.Run(name, func(t *testing.T) {
			n := startNode(t, "", nil)
			svc := newService(t)
			n.bucket("bkt", nil)
			c := n.token("bkt", allGrants)
			n.createPipe(svc, "cleanup", "after", map[string]any{
				"events": []string{"object.deleted"},
				"token":  map[string]any{"grants": []any{}},
				"retry":  map[string]any{"max_attempts": 1},
			})
			n.attach("bkt", "cleanup")
			var broken atomic.Bool
			broken.Store(true)
			svc.on("cleanup", func(*call) reply {
				if broken.Load() {
					return reply{Status: 500}
				}
				return reply{}
			})
			n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("v1"))
			n.must(c, 204, "DELETE", objPath("bkt", "k"), nil)
			failed := n.waitRunState("pipeline=cleanup", "failed")
			n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("v2")) // raises no run for cleanup
			broken.Store(false)
			calls := len(svc.callsOf("cleanup"))
			if bulk {
				n.mustAdmin(200, "POST", "/runs/retry", map[string]any{"pipeline": "cleanup"})
			} else if got := n.mustAdmin(200, "POST", "/runs/"+failed["id"].(string)+"/retry", nil); got["state"] != "skipped" || got["reason"] != "superseded" {
				t.Fatalf("the retry of a stale delete: %v", got)
			}
			time.Sleep(300 * time.Millisecond)
			if got := len(svc.callsOf("cleanup")); got != calls {
				t.Fatalf("a stale object.deleted run reached the service after its key was uploaded again")
			}
			if got := n.mustAdmin(200, "GET", "/runs/"+failed["id"].(string), nil); got["state"] != "skipped" || got["reason"] != "superseded" {
				t.Fatalf("the stale run: %v", got)
			}
		})
	}
}

// A delete that is still the last word on its key is retried as before.
func TestRetryOfALiveDeletedRunStillRuns(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "cleanup", "after", map[string]any{
		"events": []string{"object.deleted"},
		"token":  map[string]any{"grants": []any{}},
		"retry":  map[string]any{"max_attempts": 1},
	})
	n.attach("bkt", "cleanup")
	var broken atomic.Bool
	broken.Store(true)
	svc.on("cleanup", func(*call) reply {
		if broken.Load() {
			return reply{Status: 500}
		}
		return reply{}
	})
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("v1"))
	n.must(c, 204, "DELETE", objPath("bkt", "k"), nil)
	failed := n.waitRunState("pipeline=cleanup", "failed")
	broken.Store(false)
	n.mustAdmin(200, "POST", "/runs/"+failed["id"].(string)+"/retry", nil)
	n.waitRunState("pipeline=cleanup", "succeeded")
}

// Retrying a step requeues the steps that were skipped because of it, not those
// skipped because of a later step that failed with on_error: stop. Group
// [a (continue), b (stop), c]: a and b fail, c is skipped because of b.
func TestRetryRequeuesOnlyTheStepsSkippedByTheRetriedStep(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	noToken := map[string]any{"grants": []any{}}
	once := map[string]any{"max_attempts": 1}
	n.createPipe(svc, "a", "after", map[string]any{"token": noToken, "retry": once, "on_error": "continue"})
	n.createPipe(svc, "b", "after", map[string]any{"token": noToken, "retry": once, "on_error": "stop"})
	n.createPipe(svc, "c", "after", map[string]any{"token": noToken, "retry": once})
	n.attach("bkt", "a", "b", "c")
	var aOK atomic.Bool
	svc.on("a", func(*call) reply {
		if aOK.Load() {
			return reply{}
		}
		return reply{Status: 400}
	})
	svc.on("b", func(*call) reply { return reply{Status: 400} })
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x"))
	failedA := n.waitRunState("pipeline=a", "failed")
	failedB := n.waitRunState("pipeline=b", "failed")
	if skipped := n.waitRunState("pipeline=c", "skipped"); skipped["reason"] != "earlier_step_failed" {
		t.Fatalf("c: %v", skipped)
	}

	aOK.Store(true)
	n.mustAdmin(200, "POST", "/runs/"+failedA["id"].(string)+"/retry", nil)
	n.waitRunState("pipeline=a", "succeeded")
	time.Sleep(300 * time.Millisecond)
	if got := len(svc.callsOf("c")); got != 0 {
		t.Fatalf("step c ran although step b, which failed with on_error: stop, is still failed (%d calls)", got)
	}
	if rs := n.runs("pipeline=c"); len(rs) != 1 || rs[0]["state"] != "skipped" {
		t.Fatalf("c after the retry of a: %v", rs)
	}

	// the retry of b does bring c back
	svc.on("b", func(*call) reply { return reply{} })
	n.mustAdmin(200, "POST", "/runs/"+failedB["id"].(string)+"/retry", nil)
	n.waitRunState("pipeline=c", "succeeded")
}

// The write that records how a run ended is tried again when it fails: after a
// stall of the database writer longer than its timeout the run must not stay
// running (it would hold its key until the next start).
func TestRunOutcomeIsRecordedAfterAWriterStall(t *testing.T) {
	defer pipeline.SetPersistTiming(300*time.Millisecond, 100*time.Millisecond)()
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "p", "after", map[string]any{"token": map[string]any{"grants": []any{}}})
	n.attach("bkt", "p")
	inCall := make(chan struct{}, 1)
	finish := make(chan struct{})
	svc.on("p", func(*call) reply {
		select {
		case inCall <- struct{}{}:
			<-finish
		default:
		}
		return reply{}
	})
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("one"))
	<-inCall // the run is in its call
	release := n.stallWriter()
	close(finish) // the service answers; the outcome cannot be written yet
	time.Sleep(900 * time.Millisecond)
	release()
	n.waitRunState("pipeline=p&key=k", "succeeded")
	// and the key is free for the next event
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("two"))
	eventually(t, 10*time.Second, "the next event's run", func() bool { return len(n.runs("pipeline=p&state=succeeded&key=k")) == 2 })
}

// A copy keeps the source's ETag, whatever the source's part layout (spec
// §5.4.5): also when the bytes pass a before chain unchanged.
func TestCopyThroughABeforeChainKeepsTheSourceETag(t *testing.T) {
	e := newGate(t, nil, map[string]any{"match": map[string]any{"keys": []string{"through/**"}}}, nil)
	u := e.n.startMultipart(e.c, "bkt", "src", []byte("multipart source bytes"))
	if r := u.complete(); r.status != 200 {
		t.Fatalf("complete: %d", r.status)
	}
	srcETag := e.n.must(e.c, 200, "HEAD", objPath("bkt", "src"), nil).header.Get("ETag")
	e.n.must(e.c, 200, "PUT", objPath("bkt", "plain/copy"), nil, "x-amz-copy-source", "/bkt/src") // no chain matches: shared blob
	e.n.must(e.c, 200, "PUT", objPath("bkt", "through/copy"), nil, "x-amz-copy-source", "/bkt/src")
	if got := e.n.must(e.c, 200, "HEAD", objPath("bkt", "plain/copy"), nil).header.Get("ETag"); got != srcETag {
		t.Fatalf("control: a copy without a chain keeps the source's ETag %s, got %s", srcETag, got)
	}
	if got := e.n.must(e.c, 200, "HEAD", objPath("bkt", "through/copy"), nil).header.Get("ETag"); got != srcETag {
		t.Fatalf("a copy that passes a before chain unchanged has ETag %s, the source's is %s", got, srcETag)
	}
}
