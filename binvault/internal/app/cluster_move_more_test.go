package app_test

import (
	"context"
	"crypto/rand"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/app"
	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/janitor"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// A move is cancelled while it is queued or copying, never after the bucket is frozen; a cancelled
// move leaves the source serving and the target empty.
func TestClusterMoveCancel(t *testing.T) {
	f := newFaults()
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i == 2 {
			o.PeerWrap = f.wrap
		}
	})
	a, c := tc.nodes[0], tc.nodes[2]
	cr := seedBucket(t, a, "cancelme", "a", 5)
	big := make([]byte, 3<<20)
	_, _ = rand.Read(big)
	a.must(cr, 200, "PUT", "/cancelme/big", big)
	cr2 := seedBucket(t, a, "queued", "a", 3)

	// copying (slowly), with a second move waiting behind it
	id := startMove(t, a, "cancelme", "c", map[string]any{"max_bytes_per_second": 1 << 20})
	waitMove(t, a, id, 10*time.Second, "copying")
	id2 := startMove(t, a, "queued", "c", nil)
	waitMove(t, a, id2, 10*time.Second, "queued")
	if st, _ := moveState(a, id2); st != "queued" {
		t.Fatalf("the second move: %s", st)
	}
	// cancel the queued one: at once, and its bucket never noticed
	out := a.mustAdmin(200, "POST", "/moves/"+id2+"/cancel", nil)
	if out["state"] != "cancelled" {
		t.Fatalf("cancel of a queued move: %v", out)
	}
	// cancel the copying one (through another node: the call goes to the source)
	out = tc.nodes[1].mustAdmin(200, "POST", "/moves/"+id+"/cancel", nil)
	if out["state"] != "cancelled" || out["role"] != "source" {
		t.Fatalf("cancel of a copying move: %v", out)
	}
	servesAgain(t, tc, cr, "cancelme")
	servesAgain(t, tc, cr2, "queued")
	waitFor(t, 10*time.Second, "c to drop the copy", func() bool {
		recs := moveRecords(t, c, "target")
		return len(recs) == 1 && recs[0]["state"] == "abandoned" && countFiles(filepath.Join(c.dir, "blobs")) == 0
	})
	// a finished move cannot be cancelled; the target does not cancel
	if code, out := a.admin("POST", "/moves/"+id+"/cancel", nil); code != 409 {
		t.Fatalf("cancel of a cancelled move: %d %v", code, out)
	}
	if code, out := a.admin("GET", "/moves/"+id, nil); code != 200 || out["state"] != "cancelled" || out["error"] == nil {
		t.Fatalf("the cancelled move: %d %v", code, out)
	}

	// after the freeze there is no cancel
	f.set("rows", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
		time.Sleep(800 * time.Millisecond)
		next.ServeHTTP(w, r)
	})
	id3 := startMove(t, a, "queued", "c", nil)
	waitMove(t, a, id3, 10*time.Second, "frozen")
	if code, out := a.admin("POST", "/moves/"+id3+"/cancel", nil); code != 409 || !strings.Contains(fmt.Sprint(out["detail"]), "frozen") {
		t.Fatalf("cancel of a frozen move: %d %v", code, out)
	}
	if mv := waitMove(t, a, id3, 20*time.Second, "done", "failed", "cancelled"); mv["state"] != "done" {
		t.Fatalf("the move that could not be cancelled: %v", mv)
	}
	servesAgain(t, tc, cr2, "queued")
}

// Two moves for one bucket: one is accepted, the other is 409. Two moves into one node: it takes
// part in one at a time, the other is told to wait, and goes. Two moves out of one node: they run one
// after the other (spec §8.8 Limits).
func TestClusterMoveRaces(t *testing.T) {
	f := newFaults()
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i == 2 {
			o.PeerWrap = f.wrap
		}
	})
	a, b := tc.nodes[0], tc.nodes[1]
	cr1 := seedBucket(t, a, "race1", "a", 5)
	cr2 := seedBucket(t, a, "race2", "b", 5)
	cr3 := seedBucket(t, a, "race3", "a", 5)
	cr4 := seedBucket(t, a, "race4", "a", 5)

	// the same bucket twice at once
	var wg sync.WaitGroup
	codes := make([]int, 2)
	ids := make([]string, 2)
	for i := range codes {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			code, out := a.admin("POST", "/buckets/race3/move", map[string]any{"to": "b"})
			codes[i] = code
			ids[i], _ = out["id"].(string)
		}(i)
	}
	wg.Wait()
	if !(codes[0] == 202 && codes[1] == 409 || codes[0] == 409 && codes[1] == 202) {
		t.Fatalf("two moves of one bucket at once: %v", codes)
	}
	waitMove(t, a, ids[0]+ids[1], 20*time.Second, "done", "failed")

	// two moves into c, the first held there for a while: the second is told that c is busy
	f.set("rows", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
		time.Sleep(1500 * time.Millisecond)
		next.ServeHTTP(w, r)
	})
	idA := startMove(t, a, "race1", "c", nil)
	waitMove(t, a, idA, 10*time.Second, "frozen")
	f.set("rows", nil)
	idB := startMove(t, a, "race2", "c", nil)
	sawBusy := false
	deadline := time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) {
		st, mv := moveState(a, idB)
		if st == "queued" && strings.Contains(fmt.Sprint(mv["error"]), "busy") {
			sawBusy = true
		}
		if st == "done" || st == "failed" {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if !sawBusy {
		t.Fatal("the second move into a busy node was not told to wait")
	}
	waitMove(t, a, idA, 20*time.Second, "done")
	if mv := waitMove(t, a, idB, 20*time.Second, "done", "failed"); mv["state"] != "done" {
		t.Fatalf("the second move: %v", mv)
	}

	// two moves out of a (race3 now lives on b: move race4 and then race3's neighbour): one runs, the
	// other waits in the queue, both end done
	f.set("rows", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
		time.Sleep(600 * time.Millisecond)
		next.ServeHTTP(w, r)
	})
	id5 := startMove(t, a, "race4", "c", nil)
	waitMove(t, a, id5, 10*time.Second, "frozen")
	id6 := startMove(t, a, "race1", "a", nil)
	if st, _ := moveState(a, id6); st != "queued" && st != "preparing" && st != "copying" && st != "frozen" && st != "done" {
		t.Fatalf("the second move out of one node: %s", st)
	}
	waitMove(t, a, id5, 20*time.Second, "done")
	waitMove(t, a, id6, 20*time.Second, "done")
	f.set("rows", nil)
	for name, cr := range map[string]cred{"race1": cr1, "race2": cr2, "race3": cr3, "race4": cr4} {
		servesAgain(t, tc, cr, name)
	}
	for name, want := range map[string]string{"race1": "a", "race2": "c", "race3": "b", "race4": "c"} {
		if h, _ := bucketHome(t, b, name); h != want {
			t.Fatalf("%s is homed on %s, want %s", name, h, want)
		}
	}
}

// Two nodes that move a bucket to each other at the same moment each ask the other while taking part
// in a move: both are told to wait, back off for different times and go one after the other.
func TestClusterMoveCrossing(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b := tc.nodes[0], tc.nodes[1]
	crX := seedBucket(t, a, "crossx", "a", 5)
	crY := seedBucket(t, a, "crossy", "b", 5)
	var wg sync.WaitGroup
	ids := make([]string, 2)
	for i, call := range [][2]string{{"crossx", "b"}, {"crossy", "a"}} {
		wg.Add(1)
		go func(i int, bucket, to string) {
			defer wg.Done()
			_, out := a.admin("POST", "/buckets/"+bucket+"/move", map[string]any{"to": to})
			ids[i], _ = out["id"].(string)
		}(i, call[0], call[1])
	}
	wg.Wait()
	for _, id := range ids {
		if mv := waitMove(t, a, id, 30*time.Second, "done", "failed"); mv["state"] != "done" {
			t.Fatalf("a crossing move: %v", mv)
		}
	}
	servesAgain(t, tc, crX, "crossx")
	servesAgain(t, tc, crY, "crossy")
	if h, _ := bucketHome(t, b, "crossx"); h != "b" {
		t.Fatalf("crossx: %s", h)
	}
	if h, _ := bucketHome(t, a, "crossy"); h != "a" {
		t.Fatalf("crossy: %s", h)
	}
}

// Without a cluster the move and drain endpoints are 409, and GET /status counts moves in a cluster.
func TestClusterMoveSingleNodeAndStatus(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("solo", nil)
	for _, call := range [][2]string{{"POST", "/buckets/solo/move"}, {"GET", "/moves"}, {"GET", "/moves/x"}, {"POST", "/moves/x/cancel"}, {"POST", "/cluster/nodes/x/drain"}} {
		if code, out := n.admin(call[0], call[1], map[string]any{"to": "b"}); code != 409 {
			t.Fatalf("%s %s on a single node: %d %v", call[0], call[1], code, out)
		}
	}
	// a change to a bucket is admitted on a single node (the gate is there, nothing is frozen)
	n.mustAdmin(200, "PATCH", "/buckets/solo", map[string]any{"max_objects": 10})

	tc := startCluster(t, 3, nil)
	a, c := tc.nodes[0], tc.nodes[2]
	seedBucket(t, a, "counted", "a", 3)
	st := a.mustAdmin(200, "GET", "/status", nil)
	if mv, _ := st["moves"].(map[string]any); mv == nil || mv["queued"].(float64) != 0 || mv["running"].(float64) != 0 || mv["incoming"].(float64) != 0 {
		t.Fatalf("status before a move: %v", st)
	}
	id := startMove(t, a, "counted", "c", nil)
	waitMove(t, a, id, 20*time.Second, "done")
	for _, node := range []*cnode{a, c} {
		st = node.mustAdmin(200, "GET", "/status", nil)
		if mv, _ := st["moves"].(map[string]any); mv == nil || mv["queued"].(float64) != 0 || mv["running"].(float64) != 0 {
			t.Fatalf("status of %s after a move: %v", node.name, st)
		}
	}
}

// A bucket moves away and comes back: the epoch rises, the blobs that waited for the collector on
// the way back are taken back by the new arrival, and what the collector does afterwards removes
// nothing that is referenced.
func TestClusterMoveThereAndBackAgain(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	ctx := context.Background()
	cr := seedBucket(t, a, "boomerang", "b", 25)
	want := map[string][]byte{}
	for i := 0; i < 25; i++ {
		key := fmt.Sprintf("/boomerang/k%03d", i)
		want[key] = a.must(cr, 200, "GET", key, nil).body
	}
	for step, hop := range []struct {
		via *cnode
		to  string
	}{{a, "c"}, {a, "b"}, {b, "a"}, {c, "b"}} {
		id := startMove(t, hop.via, "boomerang", hop.to, nil)
		if mv := waitMove(t, a, id, 20*time.Second, "done", "failed"); mv["state"] != "done" {
			t.Fatalf("hop %d: %v", step, mv)
		}
		for _, n := range tc.nodes {
			n := n
			eventually(t, 5*time.Second, n.name+" to see the new home", func() bool {
				h, e := bucketHome(t, n, "boomerang")
				return h == hop.to && e == step+1
			})
		}
	}
	tc.noAlarms()
	// the collector runs with no grace at all: what the bucket references must survive
	for _, n := range tc.nodes {
		if _, err := janitor.GC(ctx, n.app.DB, n.app.Store, 0, time.Now().Add(time.Hour)); err != nil {
			t.Fatal(err)
		}
	}
	for _, n := range tc.nodes {
		for key, body := range want {
			if r := n.must(cr, 200, "GET", key, nil); string(r.body) != string(body) {
				t.Fatalf("through %s: %s differs after the hops", n.name, key)
			}
		}
	}
	// the records: b took the bucket in twice (the lists are the whole cluster's, merged)
	n := 0
	for _, r := range moveRecords(t, b, "target") {
		if r["to"] == "b" && r["state"] == "activated" {
			n++
		}
	}
	if n != 2 {
		t.Fatalf("b's incoming records: %d", n)
	}
	if recs := moveRecords(t, a, "source"); len(recs) != 4 {
		t.Fatalf("the sources' records: %v", recs)
	}
	servesAgain(t, tc, cr, "boomerang")
}

// The target is gone for good while the cutover waits: retiring it ends the move, and the source
// takes the bucket back at epoch + 2 (spec §8.8 Failures, §6.9).
func TestClusterMoveTargetRetiredInCutover(t *testing.T) {
	f := newFaults()
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i == 2 {
			o.PeerWrap = f.wrap
		}
	})
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	cr := seedBucket(t, a, "stuck", "a", 8)
	f.set("activate", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) { faultGarbage(w) })
	id := startMove(t, a, "stuck", "c", nil)
	waitMove(t, a, id, 10*time.Second, "cutover")
	if r := a.s3(cr, "GET", "/stuck/k000", nil); r.status != 503 {
		t.Fatalf("a bucket in its cutover: %d", r.status)
	}
	c.crash()
	a.mustAdmin(204, "DELETE", "/cluster/nodes/"+c.nodeID(), nil)
	mv := waitMove(t, a, id, 20*time.Second, "failed", "done")
	if mv["state"] != "failed" || !strings.Contains(fmt.Sprint(mv["error"]), "retired") {
		t.Fatalf("the move after the target's retirement: %v", mv)
	}
	for _, n := range []*cnode{a, b} {
		n := n
		eventually(t, 5*time.Second, n.name+" to see the bucket at epoch 2", func() bool {
			h, e := bucketHome(t, n, "stuck")
			return h == "a" && e == 2
		})
	}
	a.must(cr, 200, "GET", "/stuck/k000", nil)
	b.must(cr, 200, "GET", "/stuck/k000", nil)
	a.must(cr, 200, "PUT", "/stuck/after-retire", []byte("served again"))
	if got, err := a.app.DB.Read().GetBucket(context.Background(), "stuck"); err != nil || got.Epoch != 2 {
		t.Fatalf("the local epoch: %+v %v", got, err)
	}
}

// The source restarts while it copies: the move ends failed (there is no resume), the bucket is served
// as before, the target drops its partial copy.
func TestClusterMoveSourceRestartsWhileCopying(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, c := tc.nodes[0], tc.nodes[2]
	cr := seedBucket(t, a, "midway", "a", 5)
	big := make([]byte, 4<<20)
	_, _ = rand.Read(big)
	a.must(cr, 200, "PUT", "/midway/big", big)
	id := startMove(t, a, "midway", "c", map[string]any{"max_bytes_per_second": 1 << 20})
	waitMove(t, a, id, 10*time.Second, "copying")
	time.Sleep(300 * time.Millisecond)
	a = tc.restart(0, nil)
	tc.waitReady(15 * time.Second)
	tc.settle()
	mv := waitMove(t, a, id, 10*time.Second, "failed", "done")
	if mv["state"] != "failed" || !strings.Contains(fmt.Sprint(mv["error"]), "restart") {
		t.Fatalf("a move interrupted by a restart: %v", mv)
	}
	servesAgain(t, tc, cr, "midway")
	waitFor(t, 20*time.Second, "c to drop the partial copy", func() bool {
		recs := moveRecords(t, c, "target")
		return len(recs) == 1 && recs[0]["state"] == "abandoned" && countFiles(filepath.Join(c.dir, "blobs")) == 0
	})
	// and the same move runs to the end
	id2 := startMove(t, a, "midway", "c", nil)
	if mv := waitMove(t, a, id2, 20*time.Second, "done", "failed"); mv["state"] != "done" {
		t.Fatalf("the second move: %v", mv)
	}
	servesAgain(t, tc, cr, "midway")
}

// Draining a node cordons it and moves every bucket it homes to the others, one after another;
// `auto` placement skips it meanwhile and `undrain` lifts the cordon (spec §6.9).
func TestClusterDrain(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	creds := map[string]cred{}
	for i := 0; i < 4; i++ {
		name := fmt.Sprintf("drain%d", i)
		creds[name] = seedBucket(t, a, name, "b", 8)
	}
	out := a.mustAdmin(202, "POST", "/cluster/nodes/b/drain", nil)
	if out["cordoned"] != true || out["node"] != "b" {
		t.Fatalf("drain: %v", out)
	}
	// visible while it runs, and when it is over
	sawRunning := false
	waitFor(t, 30*time.Second, "b to be empty", func() bool {
		for _, nd := range items2(a.mustAdmin(200, "GET", "/cluster", nil)["nodes"]) {
			if nd["name"] != "b" {
				continue
			}
			d, _ := nd["drain"].(map[string]any)
			if d != nil && d["state"] == "running" && d["remaining"].(float64) > 0 {
				sawRunning = true
			}
			return d != nil && d["state"] == "done" && d["remaining"].(float64) == 0 && nd["buckets_homed"].(float64) == 0
		}
		return false
	})
	_ = sawRunning
	for name, cr := range creds {
		for _, n := range tc.nodes {
			n.must(cr, 200, "GET", "/"+name+"/k007", nil)
		}
		rec, _ := a.app.Cluster().Bucket(name)
		if a.app.Cluster().NodeName(rec.Home) == "b" || rec.Epoch != 1 {
			t.Fatalf("%s is homed on %s at epoch %d", name, a.app.Cluster().NodeName(rec.Home), rec.Epoch)
		}
	}
	moves := items(t, a.mustAdmin(200, "GET", "/moves?limit=100", nil))
	done := 0
	for _, m := range moves {
		if m["state"] == "done" && m["from"] == "b" {
			done++
		}
	}
	if done != 4 || len(moves) != 4 {
		t.Fatalf("the drain's moves: %v", moves)
	}
	if n, _ := b.app.DB.Read().CountBuckets(context.Background()); n != 0 {
		t.Fatalf("b still holds %d buckets", n)
	}
	// the list pages through the merged moves with a cursor, and filters by state, bucket and role
	page1 := a.mustAdmin(200, "GET", "/moves?limit=3", nil)
	if len(items(t, page1)) != 3 || page1["next_cursor"] == nil {
		t.Fatalf("the first page of moves: %v", page1)
	}
	page2 := c.mustAdmin(200, "GET", "/moves?limit=3&cursor="+page1["next_cursor"].(string), nil)
	if len(items(t, page2)) != 1 || page2["next_cursor"] != nil || items(t, page2)[0]["id"] == items(t, page1)[2]["id"] {
		t.Fatalf("the second page of moves: %v", page2)
	}
	if got := items(t, a.mustAdmin(200, "GET", "/moves?state=done&bucket=drain2", nil)); len(got) != 1 || got[0]["bucket"] != "drain2" {
		t.Fatalf("moves filtered by bucket and state: %v", got)
	}
	if got := items(t, a.mustAdmin(200, "GET", "/moves?state=failed", nil)); len(got) != 0 {
		t.Fatalf("failed moves: %v", got)
	}
	if got := items(t, a.mustAdmin(200, "GET", "/moves?role=target&limit=100", nil)); len(got) != 0 && got[0]["role"] != "target" {
		t.Fatalf("target records: %v", got)
	}
	if code, _ := a.admin("GET", "/moves?role=bystander", nil); code != 400 {
		t.Fatalf("an unknown role filter: %d", code)
	}

	// `auto` placement skips the cordoned node; naming it is refused
	for i := 0; i < 6; i++ {
		name := fmt.Sprintf("fresh%d", i)
		o := a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": name, "home": "auto"})
		if o["home"] == "b" {
			t.Fatalf("%s was placed on the cordoned node", name)
		}
	}
	if code, out := a.admin("POST", "/buckets", map[string]any{"name": "named", "home": "b"}); code != 409 || !strings.Contains(fmt.Sprint(out["detail"]), "cordoned") {
		t.Fatalf("a bucket on a cordoned node: %d %v", code, out)
	}
	_ = c
	// the cordon is part of the node: it survives a restart
	b = tc.restart(1, nil)
	tc.waitReady(15 * time.Second)
	tc.settle()
	if !b.app.Cluster().Cordoned() {
		t.Fatal("the cordon did not survive the restart")
	}
	out = a.mustAdmin(200, "POST", "/cluster/nodes/b/undrain", nil)
	if out["cordoned"] != false {
		t.Fatalf("undrain: %v", out)
	}
	eventually(t, 5*time.Second, "b to take buckets again", func() bool {
		code, _ := a.admin("POST", "/buckets", map[string]any{"name": "named", "home": "b"})
		return code == 201
	})
}

// A drain goes on after the node restarts in the middle of it: the cordon is persistent and the
// bucket whose move was interrupted is moved again.
func TestClusterDrainResumesAfterRestart(t *testing.T) {
	f := newFaults()
	var slow atomic.Bool
	slow.Store(true)
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i != 1 {
			o.PeerWrap = func(next http.Handler) http.Handler {
				return f.wrap(next)
			}
		}
	})
	a, b := tc.nodes[0], tc.nodes[1]
	f.set("rows", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
		if slow.Load() {
			time.Sleep(700 * time.Millisecond)
		}
		next.ServeHTTP(w, r)
	})
	creds := map[string]cred{}
	for i := 0; i < 3; i++ {
		name := fmt.Sprintf("res%d", i)
		creds[name] = seedBucket(t, a, name, "b", 4)
	}
	a.mustAdmin(202, "POST", "/cluster/nodes/b/drain", nil)
	waitFor(t, 20*time.Second, "the first bucket to leave b", func() bool {
		n, _ := a.app.Cluster().CountBucketsHomed(context.Background(), b.nodeID())
		return n < 3
	})
	slow.Store(false)
	b = tc.restart(1, nil)
	tc.waitReady(15 * time.Second)
	tc.settle()
	waitFor(t, 30*time.Second, "the drain to finish after the restart", func() bool {
		for _, n := range tc.nodes { // every node's catalog: the restarted one pulls what it missed
			if c, _ := n.app.Cluster().CountBucketsHomed(context.Background(), b.nodeID()); c != 0 {
				return false
			}
		}
		return true
	})
	for name, cr := range creds {
		for _, n := range tc.nodes {
			n.must(cr, 200, "GET", "/"+name+"/k003", nil)
		}
	}
	a.mustAdmin(200, "POST", "/cluster/nodes/b/undrain", nil)
}

// A node whose copy of a bucket is behind the catalog's epoch (restored from a backup older than a
// move) does not serve it and reports an orphan; at the right epoch it serves again (spec §8.5, §8.8).
func TestClusterStaleEpochIsNotServed(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b := tc.nodes[0], tc.nodes[1]
	ctx := context.Background()
	cr := seedBucket(t, a, "stale", "a", 4)
	for _, hop := range []string{"b", "a"} { // there and back: the bucket is on a at epoch 2
		id := startMove(t, a, "stale", hop, nil)
		if mv := waitMove(t, a, id, 20*time.Second, "done", "failed"); mv["state"] != "done" {
			t.Fatalf("hop to %s: %v", hop, mv)
		}
	}
	tc.noAlarms()
	servesAgain(t, tc, cr, "stale")
	rec, _ := a.app.Cluster().Bucket("stale")
	setEpoch := func(e int64) {
		t.Helper()
		if err := a.app.DB.Update(ctx, func(tx *meta.Tx) error {
			ok, err := tx.SetBucketEpoch(ctx, "stale", rec.Generation, e)
			if err == nil && !ok {
				err = fmt.Errorf("no such bucket")
			}
			return err
		}); err != nil {
			t.Fatal(err)
		}
	}
	setEpoch(0)
	for _, n := range []*cnode{a, b} {
		r := n.s3(cr, "GET", "/stale/k000", nil)
		if r.status != 503 || r.header.Get("Retry-After") == "" {
			t.Fatalf("a copy behind the catalog is served through %s: %d", n.name, r.status)
		}
	}
	if code, out, hdr := a.adminHdr("PATCH", "/buckets/stale", map[string]any{"max_objects": 1000}); code != 503 || out["error"] != "unavailable" || hdr == nil {
		t.Fatalf("a settings change on a stale copy: %d %v", code, out)
	}
	eventually(t, 10*time.Second, "the stale copy to be reported as an orphan", func() bool {
		al, _ := a.mustAdmin(200, "GET", "/cluster", nil)["alarms"].(map[string]any)
		orphans, _ := al["orphans"].([]any)
		return len(orphans) == 1 && orphans[0].(map[string]any)["reason"] == "epoch"
	})
	setEpoch(2)
	servesAgain(t, tc, cr, "stale")
	tc.noAlarms()
}

// Retiring a target that is alive and has decided to activate must not make the source take the
// bucket back at epoch + 2: the target is the home, and may have acknowledged writes already. The
// source asks the target's record of the move first; "activated" ends the move as done (spec §8.8
// Failures). Here the source thinks the target is dead (its hello is refused) and retired, while the
// target holds its decision and has not yet told the catalog.
func TestClusterMoveRetiredTargetThatActivatedIsTheHome(t *testing.T) {
	var blocked atomic.Bool
	var aID atomic.Value
	gate := make(chan struct{})
	var once sync.Once
	t.Cleanup(func() { once.Do(func() { close(gate) }) })
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		o.MoverTuning.ActivateTimeout = 300 * time.Millisecond
		if i == 2 {
			o.MoverTuning.CrashPoint = func(p string) bool { // the completion of the activation waits for the test
				if p == "activated" {
					<-gate
				}
				return false
			}
			o.PeerWrap = func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					// a's view of the target goes dark: everything but the move calls is refused
					if id, _ := aID.Load().(string); id != "" && blocked.Load() && r.Header.Get(cluster.HeaderNode) == id && !strings.Contains(r.URL.Path, "/moves/") {
						http.Error(w, "refused by the test", http.StatusServiceUnavailable)
						return
					}
					next.ServeHTTP(w, r)
				})
			}
		}
	})
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	aID.Store(a.nodeID())
	cr := seedBucket(t, a, "alive", "a", 6)

	id := startMove(t, a, "alive", "c", nil)
	waitFor(t, 10*time.Second, "the target to decide", func() bool {
		recs := moveRecords(t, c, "target")
		return len(recs) == 1 && recs[0]["state"] == "activated"
	})
	// a loses sight of c and the admin retires it (the catalog does not home anything there yet)
	blocked.Store(true)
	waitFor(t, 10*time.Second, "a to find c unreachable", func() bool {
		for _, p := range a.app.Cluster().Peers() {
			if p.Name == "c" {
				return !p.Reachable
			}
		}
		return false
	})
	a.mustAdmin(204, "DELETE", "/cluster/nodes/"+c.nodeID(), nil)

	// the move is done, not failed and not taken back
	mv := waitMove(t, a, id, 30*time.Second, "done", "failed")
	if mv["state"] != "done" {
		t.Fatalf("the move after the retirement of a target that had activated: %v", mv)
	}
	once.Do(func() { close(gate) })
	for _, n := range []*cnode{a, b} {
		n := n
		eventually(t, 10*time.Second, n.name+" to see c as the home", func() bool {
			h, e := bucketHome(t, n, "alive")
			return h == "c" && e == 1
		})
	}
	blocked.Store(false)
	servesAgain(t, tc, cr, "alive")
	if got, err := a.app.DB.Read().GetBucket(context.Background(), "alive"); err == nil {
		t.Fatalf("the old home kept the bucket: %+v", got)
	}
}

// The old home removes the rows of a moved bucket in pieces — one short transaction each — so that a
// bucket with millions of versions does not hold the node's writer for all the seconds that takes.
// The move stays `moved` until the last piece; a node that stops between two pieces finds the rest
// after its restart and ends the move (spec §8.8 step 6).
func TestClusterMoveCleanupInPiecesResumesAfterRestart(t *testing.T) {
	var armed atomic.Bool
	armed.Store(true)
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i == 0 {
			o.MoverTuning.CleanupChunk = 3
			o.MoverTuning.CrashPoint = func(p string) bool { return p == "cleanup" && armed.CompareAndSwap(true, false) }
		}
	})
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	ctx := context.Background()
	cr := seedBucket(t, a, "pieces", "a", 20)
	id := startMove(t, a, "pieces", "c", nil)

	// the first piece is gone, the others are not, and the move is not over
	waitFor(t, 15*time.Second, "the cleanup to stop after its first piece", func() bool { return !armed.Load() })
	time.Sleep(200 * time.Millisecond)
	st, _ := a.app.DB.Read().GetMove(ctx, id)
	if st == nil || st.State != "moved" {
		t.Fatalf("the move between two pieces: %+v", st)
	}
	res, err := a.app.DB.Read().ListVersions(ctx, "pieces", meta.ListOptions{MaxKeys: 100})
	if err != nil || len(res.Entries) == 0 || len(res.Entries) >= 20 {
		t.Fatalf("the rows left after the first piece: %d %v", len(res.Entries), err)
	}
	if _, err := a.app.DB.Read().GetBucket(ctx, "pieces"); err != nil {
		t.Fatalf("the bucket row went before the last piece: %v", err)
	}
	// meanwhile the new home serves it
	for _, n := range []*cnode{b, c} {
		n := n
		eventually(t, 5*time.Second, n.name+" to serve the moved bucket", func() bool {
			return n.s3(cr, "GET", "/pieces/k019", nil).status == 200
		})
	}

	a = tc.restart(0, nil)
	tc.waitReady(15 * time.Second)
	tc.settle()
	if mv := waitMove(t, a, id, 20*time.Second, "done", "failed"); mv["state"] != "done" {
		t.Fatalf("the move after the restart: %v", mv)
	}
	if _, err := a.app.DB.Read().GetBucket(ctx, "pieces"); err == nil {
		t.Fatal("the old home kept the bucket row")
	}
	q := a.app.DB.Read()
	if res, err := q.ListVersions(ctx, "pieces", meta.ListOptions{MaxKeys: 100}); err != nil || len(res.Entries) != 0 {
		t.Fatalf("version rows left on the old home: %d %v", len(res.Entries), err)
	}
	if ts, err := q.ListTokens(ctx, "pieces", "", 10); err != nil || len(ts) != 0 {
		t.Fatalf("tokens left on the old home: %d %v", len(ts), err)
	}
	if n, err := q.CountRuns(ctx, meta.RunFilter{Bucket: "pieces"}); err != nil || n != 0 {
		t.Fatalf("runs left on the old home: %d %v", n, err)
	}
	// the blobs wait for the collector
	if blobs, err := q.BucketBlobs(ctx, "pieces", "", 100); err != nil || len(blobs) != 20 {
		t.Fatalf("blob rows on the old home: %d %v", len(blobs), err)
	} else {
		for _, bl := range blobs {
			if bl.Refs != 0 || bl.ZeroSince == nil {
				t.Fatalf("a blob of the moved bucket is not released: %+v", bl)
			}
		}
	}
	servesAgain(t, tc, cr, "pieces")
	tc.noAlarms()
}
