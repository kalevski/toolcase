package app_test

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/app"
	"github.com/kalevski/toolcase/binvault/internal/cluster"
)

// The pipelines are the catalog's; what a bucket is attached to travels with its rows, and the new
// home puts it right against the catalog when it imports it (spec §8.8 step 4).

// A pipeline deleted and created again while a bucket is frozen for its move is a new pipeline: the
// attachment that travels with the rows was made for the old one, and so were the queued runs. The
// old home drops them from the rows it keeps (which the move has exported already) and the new home,
// which has applied the change before the import, must drop them from the rows it imports — as it
// does for a bucket that does not move. Without that the attachment of the old generation stayed for
// ever, listed, named in the catalog entry and skipped by the before chain, with runs of a pipeline
// that no longer exists in the queue.
func TestClusterMoveDropsWhatWasAttachedToAPipelineRecreatedMeanwhile(t *testing.T) {
	f := newFaults()
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i == 1 {
			o.PeerWrap = f.wrap
		}
	})
	a, b := tc.nodes[0], tc.nodes[1]
	svc := newFsvc(t)
	// paused: the runs of its attachments queue up
	audit := pipeDef("audit", "after", svc.url("audit"), a.s3URL, map[string]any{"paused": true})
	a.mustAdmin(201, "POST", "/pipelines?wait=replicated", audit)
	creds := map[string]cred{}
	for _, name := range []string{"xbkt", "ctl"} {
		a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": name, "home": "a"})
		a.mustAdmin(200, "PUT", "/buckets/"+name+"/pipelines", map[string]any{"items": []map[string]any{{"pipeline": "audit", "enabled": true}}})
		creds[name] = a.token(name, all, nil)
		for i := 0; i < 4; i++ {
			a.must(creds[name], 200, "PUT", fmt.Sprintf("/%s/k%d", name, i), []byte("x"))
		}
	}
	for _, name := range []string{"xbkt", "ctl"} {
		name := name
		waitFor(t, 10*time.Second, "the runs of "+name+" to queue up", func() bool {
			return len(items(t, a.mustAdmin(200, "GET", "/runs?bucket="+name+"&state=queued&limit=100", nil))) == 4
		})
	}

	// the rows are slow: the snapshot is taken first, and the change comes after it
	f.set("rows", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
		time.Sleep(2500 * time.Millisecond)
		next.ServeHTTP(w, r)
	})
	id := startMove(t, a, "xbkt", "b", nil)
	waitMove(t, a, id, 10*time.Second, "frozen")
	time.Sleep(300 * time.Millisecond)
	// the pipeline is deleted and created again, through the target
	b.mustAdmin(204, "DELETE", "/pipelines/audit?detach=true&wait=replicated", nil)
	b.mustAdmin(201, "POST", "/pipelines?wait=replicated", audit)
	if mv := waitMove(t, a, id, 30*time.Second, "done", "failed"); mv["state"] != "done" {
		t.Fatalf("the move: %v", mv)
	}

	// the bucket that moved looks like the one that did not
	for _, name := range []string{"ctl", "xbkt"} {
		for _, n := range tc.nodes {
			if got := n.mustAdmin(200, "GET", "/buckets/"+name+"/pipelines", nil); len(items(t, got)) != 0 {
				t.Errorf("%s: through %s the bucket still lists %v", name, n.name, got["items"])
			}
		}
		runs := items(t, a.mustAdmin(200, "GET", "/runs?bucket="+name+"&limit=100", nil))
		if len(runs) != 4 {
			t.Fatalf("%s: %d runs, want the 4 that were queued", name, len(runs))
		}
		for _, r := range runs {
			if r["state"] != "cancelled" || r["reason"] != "pipeline_removed" {
				t.Errorf("%s: a run of the pipeline that was deleted is %v (%v)", name, r["state"], r["reason"])
			}
		}
	}
	if got := a.mustAdmin(200, "GET", "/pipelines/audit", nil); len(items2(got["attached_to"])) != 0 {
		t.Errorf("the pipeline is still attached to %v", got["attached_to"])
	}
	// and it can be attached again, to the bucket on its new home
	a.mustAdmin(200, "PUT", "/buckets/xbkt/pipelines", map[string]any{"items": []map[string]any{{"pipeline": "audit", "enabled": true}}})
	tc.noAlarms()
}

// catalogCut makes the peer listeners it wraps refuse the catalog pulls (/ops) of one node while it
// is on: that node can learn nothing new from them.
type catalogCut struct {
	who    atomic.Value // the node id whose pulls are refused
	on     atomic.Bool
	denied atomic.Int64 // pulls refused so far
}

func (c *catalogCut) wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if id, _ := c.who.Load().(string); id != "" && c.on.Load() && r.Header.Get(cluster.HeaderNode) == id && strings.HasSuffix(r.URL.Path, "/ops") {
			c.denied.Add(1)
			http.Error(w, "cut off by the test", http.StatusServiceUnavailable)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// start cuts the node off, and returns once it has been refused on every listener that wraps: a pull
// that was already being answered when the cut came has ended by then, so nothing the test does next
// can reach the node through it.
func (c *catalogCut) start(t *testing.T, id string, listeners int) {
	t.Helper()
	c.who.Store(id)
	before := c.denied.Load()
	c.on.Store(true)
	waitFor(t, 10*time.Second, "the node to be refused", func() bool { return c.denied.Load() >= before+int64(4*listeners) })
}

func (c *catalogCut) end() { c.on.Store(false) }

// A pipeline the new home's catalog has never heard of — its register is still on its way — makes
// the new home neither keep nor drop the attachment: the import waits (the answer is `busy`, the
// source lifts its freeze, serves the bucket as before and asks again later), and when the
// pipeline has arrived the move completes with the attachment in place.
func TestClusterMoveWaitsForAPipelineThatHasNotReachedTheTarget(t *testing.T) {
	var cut catalogCut
	f := newFaults()
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i == 1 {
			o.PeerWrap = f.wrap
			return
		}
		o.PeerWrap = cut.wrap // a and c: b can learn nothing from them
	})
	a, b := tc.nodes[0], tc.nodes[1]
	t.Cleanup(cut.end)
	svc := newFsvc(t)

	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "lagbkt", "home": "a"})
	cr := a.token("lagbkt", all, nil)
	for i := 0; i < 5; i++ {
		a.must(cr, 200, "PUT", fmt.Sprintf("/lagbkt/k%03d", i), []byte("before the pipeline"))
	}

	// from now on b learns nothing: the pipeline is made and attached on a
	cut.start(t, b.nodeID(), 2)
	gate := pipeDef("late", "before", svc.url("late"), a.s3URL, map[string]any{
		"token": map[string]any{"grants": []map[string]any{{"actions": []string{"read"}, "keys": []string{"{key}"}}}},
	})
	a.mustAdmin(201, "POST", "/pipelines", gate)
	a.mustAdmin(200, "PUT", "/buckets/lagbkt/pipelines", map[string]any{"items": []map[string]any{{"pipeline": "late", "enabled": true}}})
	if _, ok := b.app.Cluster().Pipeline("late"); ok {
		t.Fatal("the setup did not hold: b knows the pipeline already")
	}

	id := startMove(t, a, "lagbkt", "b", nil)
	// the move waits, and says why; the bucket is served on a between the attempts
	waitFor(t, 20*time.Second, "the move to wait for the pipeline", func() bool {
		st, mv := moveState(a, id)
		return st == "queued" && strings.Contains(fmt.Sprint(mv["error"]), `pipeline "late" has not reached the target node yet`)
	})
	waitFor(t, 10*time.Second, "a write to the bucket while the move waits", func() bool {
		return a.s3(cr, "PUT", "/lagbkt/while-waiting", []byte("written on a")).status == 200
	})
	if st, mv := moveState(a, id); st == "done" || st == "failed" {
		t.Fatalf("the move ended while b did not know the pipeline: %v", mv)
	}
	if h, _ := bucketHome(t, a, "lagbkt"); h != "a" {
		t.Fatalf("the bucket is homed on %s", h)
	}
	if n := f.count("rows"); n < 1 {
		t.Fatalf("the rows were never sent (%d): the wait was not at the import", n)
	}

	// the pipeline reaches b: the move goes on and completes
	cut.end()
	if mv := waitMove(t, a, id, 30*time.Second, "done", "failed"); mv["state"] != "done" {
		t.Fatalf("the move: %v", mv)
	}
	servesAgain(t, tc, cr, "lagbkt")
	if h, _ := bucketHome(t, a, "lagbkt"); h != "b" {
		t.Fatalf("the bucket is homed on %s", h)
	}
	for _, n := range tc.nodes {
		got := n.mustAdmin(200, "GET", "/buckets/lagbkt/pipelines", nil)
		list := items(t, got)
		if len(list) != 1 || list[0]["pipeline"] != "late" || list[0]["enabled"] != true {
			t.Fatalf("through %s the attachments are %v", n.name, got["items"])
		}
		n.must(cr, 200, "GET", "/lagbkt/while-waiting", nil)
	}
	// the attachment works on the new home: its before pipeline is asked about a write
	before := len(svc.callsOf("late"))
	r := b.must(cr, 200, "PUT", "/lagbkt/after-the-move", []byte("written on b"))
	if r.header.Get("x-binvault-node") != "b" || len(svc.callsOf("late")) <= before {
		t.Fatalf("the write was served by %q and the pipeline was called %d times (before: %d)", r.header.Get("x-binvault-node"), len(svc.callsOf("late")), before)
	}
	tc.noAlarms()
}

// The catalog entry of a bucket names the pipelines it is attached to: a target whose catalog lacks
// one of them refuses the prepare with `busy` — before anything is copied or frozen — and the move
// starts when it has arrived.
func TestClusterMovePrepareWaitsForAPipelineNamedByTheCatalogEntry(t *testing.T) {
	f := newFaults()
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i == 1 {
			o.PeerWrap = f.wrap
		}
	})
	a, b := tc.nodes[0], tc.nodes[1]
	cr := seedBucket(t, a, "namedbkt", "a", 3)
	// the entry names a pipeline that exists nowhere (yet)
	ctx := context.Background()
	if _, err := a.app.Cluster().UpdateBucket(ctx, "namedbkt", func(c cluster.BucketEntry) (cluster.BucketEntry, error) {
		c.Pipelines = []string{"ghost"}
		return c, nil
	}); err != nil {
		t.Fatal(err)
	}
	waitFor(t, 10*time.Second, "b to see the entry", func() bool {
		rec, ok := b.app.Cluster().Bucket("namedbkt")
		return ok && len(rec.Pipelines) == 1
	})

	id := startMove(t, a, "namedbkt", "b", nil)
	waitFor(t, 20*time.Second, "the move to wait for the pipeline", func() bool {
		st, mv := moveState(a, id)
		return st == "queued" && strings.Contains(fmt.Sprint(mv["error"]), `pipeline "ghost" has not reached the target node yet`)
	})
	if n := f.count("blob") + f.count("rows"); n != 0 {
		t.Fatalf("%d blobs and rows were sent although the target refused the prepare", n)
	}
	// the bucket was never frozen
	a.must(cr, 200, "PUT", "/namedbkt/not-frozen", []byte("x"))

	// the home repairs the entry (what its reconcile loop does within a minute)
	if err := a.app.Pipes.PublishAttachments(ctx, "namedbkt"); err != nil {
		t.Fatal(err)
	}
	if mv := waitMove(t, a, id, 30*time.Second, "done", "failed"); mv["state"] != "done" {
		t.Fatalf("the move: %v", mv)
	}
	servesAgain(t, tc, cr, "namedbkt")
	b.must(cr, 200, "GET", "/namedbkt/not-frozen", nil)
	tc.noAlarms()
}

// The target may hold an older incarnation of the pipeline than the attachment was made for: the
// pipeline was deleted and created again, and the target has seen neither. The attachment is then
// current, not stale: the target cannot tell until the creating op of its generation has reached it,
// so the import waits — and does not drop the attachment of a pipeline that is alive.
func TestClusterMoveKeepsAnAttachmentWhoseNewPipelineHasNotReachedTheTarget(t *testing.T) {
	var cut catalogCut
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i != 1 {
			o.PeerWrap = cut.wrap
		}
	})
	a, b := tc.nodes[0], tc.nodes[1]
	t.Cleanup(cut.end)
	svc := newFsvc(t)
	gate := pipeDef("again", "before", svc.url("again"), a.s3URL, map[string]any{
		"token": map[string]any{"grants": []map[string]any{{"actions": []string{"read"}, "keys": []string{"{key}"}}}},
	})
	attach := map[string]any{"items": []map[string]any{{"pipeline": "again", "enabled": true}}}
	a.mustAdmin(201, "POST", "/pipelines?wait=replicated", gate)
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "incbkt", "home": "a"})
	a.mustAdmin(200, "PUT", "/buckets/incbkt/pipelines", attach)
	cr := a.token("incbkt", all, nil)
	for i := 0; i < 4; i++ {
		a.must(cr, 200, "PUT", fmt.Sprintf("/incbkt/k%03d", i), []byte("x"))
	}
	waitFor(t, 10*time.Second, "b to see the attachment's pipeline names", func() bool {
		rec, ok := b.app.Cluster().Bucket("incbkt")
		return ok && len(rec.Pipelines) == 1
	})
	old, _, _ := b.app.Cluster().PipelineGeneration("again")

	// from now on b learns nothing: the pipeline is deleted and created again on a, and attached
	cut.start(t, b.nodeID(), 2)
	a.mustAdmin(204, "DELETE", "/pipelines/again?detach=true", nil)
	a.mustAdmin(201, "POST", "/pipelines", gate)
	a.mustAdmin(200, "PUT", "/buckets/incbkt/pipelines", attach)
	if gen, live, _ := b.app.Cluster().PipelineGeneration("again"); !live || gen != old {
		t.Fatalf("the setup did not hold: b has %q (live %v), it had %q", gen, live, old)
	}

	id := startMove(t, a, "incbkt", "b", nil)
	waitFor(t, 20*time.Second, "the move to wait for the new pipeline", func() bool {
		st, mv := moveState(a, id)
		return st == "queued" && strings.Contains(fmt.Sprint(mv["error"]), `pipeline "again" has not reached the target node yet`)
	})
	cut.end()
	if mv := waitMove(t, a, id, 30*time.Second, "done", "failed"); mv["state"] != "done" {
		t.Fatalf("the move: %v", mv)
	}
	servesAgain(t, tc, cr, "incbkt")
	for _, n := range tc.nodes {
		got := n.mustAdmin(200, "GET", "/buckets/incbkt/pipelines", nil)
		if list := items(t, got); len(list) != 1 || list[0]["pipeline"] != "again" {
			t.Fatalf("through %s the attachments are %v", n.name, got["items"])
		}
	}
	before := len(svc.callsOf("again"))
	b.must(cr, 200, "PUT", "/incbkt/after-the-move", []byte("x"))
	if len(svc.callsOf("again")) <= before {
		t.Fatal("the pipeline was not called for a write on the new home")
	}
	tc.noAlarms()
}

// A move that waits for a pipeline after the target has received the bucket's blobs holds a copy
// there; cancelling the move (it is queued again, so the admin may) drops that copy, and the bucket
// stays on its home, which serves it as it did before.
func TestClusterMoveCancelledWhileWaitingForAPipelineDropsTheTargetsCopy(t *testing.T) {
	var cut catalogCut
	f := newFaults()
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i == 1 {
			o.PeerWrap = f.wrap
			return
		}
		o.PeerWrap = cut.wrap
		if i == 0 {
			o.MoverTuning.RequeueDelay = time.Minute // the move stays queued while the test looks at it
		}
	})
	a, b := tc.nodes[0], tc.nodes[1]
	t.Cleanup(cut.end)
	svc := newFsvc(t)
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "waitcancel", "home": "a"})
	cr := a.token("waitcancel", all, nil)
	for i := 0; i < 5; i++ {
		a.must(cr, 200, "PUT", fmt.Sprintf("/waitcancel/k%03d", i), bytes.Repeat([]byte("b"), 2000))
	}
	cut.start(t, b.nodeID(), 2)
	a.mustAdmin(201, "POST", "/pipelines", pipeDef("late", "after", svc.url("late"), a.s3URL, nil))
	a.mustAdmin(200, "PUT", "/buckets/waitcancel/pipelines", map[string]any{"items": []map[string]any{{"pipeline": "late", "enabled": true}}})

	id := startMove(t, a, "waitcancel", "b", nil)
	waitFor(t, 20*time.Second, "the move to wait for the pipeline after the rows were sent", func() bool {
		// the record on disk (the move's own view of itself is a moment ahead of it)
		st, err := a.app.DB.Read().GetMove(context.Background(), id)
		return err == nil && st.State == "queued" && strings.Contains(st.Error, "has not reached the target node yet") && f.count("rows") >= 1
	})
	// the target holds what it received for the move
	if recs := moveRecords(t, b, "target"); len(recs) != 1 || recs[0]["state"] != "receiving" {
		t.Fatalf("the target's record while the move waits: %v", recs)
	}
	if blobs, err := b.app.DB.Read().BucketBlobs(context.Background(), "waitcancel", "", 100); err != nil || len(blobs) != 5 {
		t.Fatalf("the blobs the target holds: %d %v", len(blobs), err)
	}

	out := a.mustAdmin(200, "POST", "/moves/"+id+"/cancel", nil)
	if out["state"] != "cancelled" {
		t.Fatalf("the cancel: %v", out)
	}
	waitFor(t, 10*time.Second, "the target to drop its copy", func() bool {
		recs := moveRecords(t, b, "target")
		if len(recs) != 1 || recs[0]["state"] != "abandoned" {
			return false
		}
		blobs, err := b.app.DB.Read().BucketBlobs(context.Background(), "waitcancel", "", 100)
		_, berr := b.app.DB.Read().GetBucket(context.Background(), "waitcancel")
		return err == nil && len(blobs) == 0 && berr != nil
	})
	// the bucket stayed home and nothing else is queued: the worker is idle
	cut.end()
	if h, e := bucketHome(t, a, "waitcancel"); h != "a" || e != 0 {
		t.Fatalf("home after the cancel: %s %d", h, e)
	}
	servesAgain(t, tc, cr, "waitcancel")
	if st, _ := moveState(a, id); st != "cancelled" {
		t.Fatalf("the move after the cancel: %s", st)
	}
}
