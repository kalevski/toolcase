package app_test

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/app"
	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/mover"
)

// seedBucket creates a bucket on the named node, a token, and n small keys; it returns the token.
func seedBucket(t *testing.T, via *cnode, name, home string, n int) cred {
	t.Helper()
	via.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": name, "home": home})
	cr := via.token(name, all, nil)
	for i := 0; i < n; i++ {
		body := make([]byte, 1000+i)
		_, _ = rand.Read(body)
		via.must(cr, 200, "PUT", fmt.Sprintf("/%s/k%03d", name, i), body)
	}
	return cr
}

// countFiles counts the regular files under a directory of a node's data dir.
func countFiles(dir string) int {
	n := 0
	_ = filepath.Walk(dir, func(_ string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			n++
		}
		return nil
	})
	return n
}

// servesAgain checks that a bucket is served through every node and written to.
func servesAgain(t *testing.T, tc *tcluster, cr cred, bucket string) {
	t.Helper()
	for _, n := range tc.nodes {
		n := n
		// (a node that has not applied the catalog's last change yet answers 503 for a moment)
		eventually(t, 10*time.Second, n.name+" to serve "+bucket, func() bool {
			return n.s3(cr, "GET", "/"+bucket+"/k000", nil).status == 200
		})
	}
	tc.nodes[0].must(cr, 200, "PUT", "/"+bucket+"/after", []byte("written after"))
}

// What a target can refuse at the preparation: a bucket of that name already there, no room, a
// master key it cannot open, a cordon. The source keeps serving; nothing is left on the target.
func TestClusterMoveRefusedByTarget(t *testing.T) {
	var freeC atomic.Int64
	freeC.Store(1 << 40)
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i == 2 {
			o.FreeDisk = func() int64 { return freeC.Load() }
		}
	})
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	ctx := context.Background()
	cr := seedBucket(t, a, "refuse", "b", 5)

	// a bucket of that name is already on c (an orphan): the move starts, and ends failed
	if err := c.app.DB.Update(ctx, func(tx *meta.Tx) error {
		return tx.CreateBucket(ctx, &meta.Bucket{Name: "refuse", Generation: "orphan-generation"})
	}); err != nil {
		t.Fatal(err)
	}
	id := startMove(t, a, "refuse", "c", nil)
	mv := waitMove(t, a, id, 10*time.Second, "failed", "done")
	if mv["state"] != "failed" || !strings.Contains(fmt.Sprint(mv["error"]), "already holds a bucket named") {
		t.Fatalf("a move to a node that holds the name: %v", mv)
	}
	servesAgain(t, tc, cr, "refuse")
	if recs := moveRecords(t, c, "target"); len(recs) != 0 {
		t.Fatalf("a refused prepare left a record on the target: %v", recs)
	}
	if _, err := c.app.DB.Read().GetBucket(ctx, "refuse"); err != nil {
		t.Fatal("the target lost the bucket row that was there before (an orphan is not the move's to remove)")
	}
	if err := c.app.DB.Update(ctx, func(tx *meta.Tx) error { return tx.DeleteBucket(ctx, "refuse") }); err != nil { // delete the orphan
		t.Fatal(err)
	}

	// no room: refused at the request (the hello says so), and refused by the target itself
	freeC.Store(1 << 20)
	waitFor(t, 5*time.Second, "a and b to see that c is full", func() bool {
		for _, n := range []*cnode{a, b} {
			full := false
			for _, p := range n.app.Cluster().Peers() {
				if p.Name == "c" && p.FreeDisk <= 1<<20 {
					full = true
				}
			}
			if !full {
				return false
			}
		}
		return true
	})
	if code, out := a.admin("POST", "/buckets/refuse/move", map[string]any{"to": "c"}); code != 409 || !strings.Contains(fmt.Sprint(out["detail"]), "free") {
		t.Fatalf("a move to a full node: %d %v", code, out)
	}
	rec, _ := a.app.Cluster().Bucket("refuse")
	prepare := map[string]any{"bucket": "refuse", "generation": rec.Generation, "epoch": 1, "from": b.nodeID(), "bytes": 1 << 30, "key_ids": []string{}}
	code, _, raw := tc.peerCall(c, "POST", "/_peer/v1/moves/mv_0000000000000000000000FULL/prepare", prepare)
	var res map[string]any
	_ = json.Unmarshal(raw, &res)
	if code != 409 || res["result"] != "refused" || !strings.Contains(fmt.Sprint(res["detail"]), "free disk") {
		t.Fatalf("prepare on a full node: %d %s", code, raw)
	}
	freeC.Store(1 << 40)
	// a master key the target cannot open
	prepare = map[string]any{"bucket": "refuse", "generation": rec.Generation, "epoch": 1, "from": b.nodeID(), "bytes": 10, "key_ids": []string{"deadbeef"}}
	code, _, raw = tc.peerCall(c, "POST", "/_peer/v1/moves/mv_0000000000000000000000KEYS/prepare", prepare)
	_ = json.Unmarshal(raw, &res)
	if code != 409 || res["result"] != "refused" || !strings.Contains(fmt.Sprint(res["detail"]), "master key") {
		t.Fatalf("prepare with a key the target cannot open: %d %s", code, raw)
	}
	// a prepare that names another epoch or home than the target's catalog
	prepare = map[string]any{"bucket": "refuse", "generation": rec.Generation, "epoch": 7, "from": b.nodeID(), "bytes": 10, "key_ids": []string{}}
	if code, _, raw = tc.peerCall(c, "POST", "/_peer/v1/moves/mv_0000000000000000000000EPOC/prepare", prepare); code != 409 || !strings.Contains(string(raw), "epoch") {
		t.Fatalf("prepare at the wrong epoch: %d %s", code, raw)
	}

	// a cordoned node takes no new buckets
	a.mustAdmin(202, "POST", "/cluster/nodes/c/drain", nil)
	waitFor(t, 5*time.Second, "a and b to see that c is cordoned", func() bool {
		for _, n := range []*cnode{a, b} {
			cordoned := false
			for _, p := range n.app.Cluster().Peers() {
				if p.Name == "c" && p.Cordoned {
					cordoned = true
				}
			}
			if !cordoned {
				return false
			}
		}
		return true
	})
	if code, out := a.admin("POST", "/buckets/refuse/move", map[string]any{"to": "c"}); code != 409 || !strings.Contains(fmt.Sprint(out["detail"]), "cordoned") {
		t.Fatalf("a move to a cordoned node: %d %v", code, out)
	}
	a.mustAdmin(200, "POST", "/cluster/nodes/c/undrain", nil)
	servesAgain(t, tc, cr, "refuse")
}

// A node whose master keys differ from the others cannot take a bucket whose sealed values use
// them: the request is refused at once (spec §6.10).
func TestClusterMoveRefusedForMasterKey(t *testing.T) {
	other := make([]byte, 32)
	_, _ = rand.Read(other)
	tc := startClusterWith(t, 3, func(i int, c *config.Config) {
		if i == 2 {
			c.MasterKey = other
		}
	}, nil)
	a := tc.nodes[0]
	cr := seedBucket(t, a, "keyed", "b", 3)
	waitFor(t, 5*time.Second, "every node to see the key ids of c", func() bool {
		for _, n := range tc.nodes[:2] {
			seen := false
			for _, p := range n.app.Cluster().Peers() {
				if p.Name == "c" && len(p.KeyIDs) > 0 {
					seen = true
				}
			}
			if !seen {
				return false
			}
		}
		return true
	})
	if code, out := a.admin("POST", "/buckets/keyed/move", map[string]any{"to": "c"}); code != 409 || !strings.Contains(fmt.Sprint(out["detail"]), "master key") {
		t.Fatalf("a move to a node that cannot open the master key: %d %v", code, out)
	}
	// `auto` finds the other node
	id := startMove(t, a, "keyed", "auto", nil)
	if mv := waitMove(t, a, id, 10*time.Second, "done", "failed"); mv["state"] != "done" || mv["to"] != "a" {
		t.Fatalf("an auto move: %v", mv)
	}
	servesAgain(t, tc, cr, "keyed")
}

// The connection that carries blobs is killed over and over: the move fails, the source keeps
// serving, the target drops what it received (rows and files), and the move can be started again.
func TestClusterMoveStreamKilled(t *testing.T) {
	f := newFaults()
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i == 2 {
			o.PeerWrap = f.wrap
		}
	})
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	ctx := context.Background()
	cr := seedBucket(t, a, "killed", "b", 30)
	f.set("blob", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
		if n > 6 {
			faultKill(w)
			return
		}
		next.ServeHTTP(w, r)
	})
	id := startMove(t, a, "killed", "c", nil)
	mv := waitMove(t, a, id, 20*time.Second, "failed", "done")
	if mv["state"] != "failed" || mv["error"] == nil {
		t.Fatalf("a move whose stream is killed: %v", mv)
	}
	servesAgain(t, tc, cr, "killed")
	if h, e := bucketHome(t, a, "killed"); h != "b" || e != 0 {
		t.Fatalf("the home after a failed move: %s %d", h, e)
	}
	if got, err := b.app.DB.Read().GetBucket(ctx, "killed"); err != nil || got.Epoch != 0 || got.Versions < 30 {
		t.Fatalf("the source's bucket: %+v %v", got, err)
	}
	// the target dropped the partial copy
	waitFor(t, 10*time.Second, "c to drop the partial copy", func() bool {
		recs := moveRecords(t, c, "target")
		return len(recs) == 1 && recs[0]["state"] == "abandoned" && countFiles(filepath.Join(c.dir, "blobs")) == 0
	})
	if n, _, _ := c.app.DB.Read().BucketBlobStats(ctx, "killed"); n != 0 {
		t.Fatalf("%d blob rows of the abandoned copy are left on c", n)
	}
	if _, err := c.app.DB.Read().GetBucket(ctx, "killed"); err == nil {
		t.Fatal("c holds a bucket row after the move failed")
	}
	// the same move again, with a healthy link
	f.set("blob", nil)
	id2 := startMove(t, a, "killed", "c", nil)
	if mv := waitMove(t, a, id2, 20*time.Second, "failed", "done"); mv["state"] != "done" {
		t.Fatalf("the second move: %v", mv)
	}
	servesAgain(t, tc, cr, "killed")
}

// A freeze that outlasts BINVAULT_MOVE_FREEZE_TIMEOUT ends the move: the writes are admitted again and
// the target drops its copy.
func TestClusterMoveFreezeTimeout(t *testing.T) {
	f := newFaults()
	tc := startClusterWith(t, 3, func(i int, c *config.Config) {
		if i == 0 {
			c.MoveFreezeTimeout = 200 * time.Millisecond
		}
	}, func(i int, o *app.Options) {
		if i == 2 {
			o.PeerWrap = f.wrap
		}
	})
	a, c := tc.nodes[0], tc.nodes[2]
	svc := newFsvc(t)
	a.mustAdmin(201, "POST", "/pipelines?wait=replicated", pipeDef("watch", "after", svc.url("watch"), a.s3URL, nil))
	cr := seedBucket(t, a, "slowrows", "a", 10)
	a.mustAdmin(200, "PUT", "/buckets/slowrows/pipelines", map[string]any{"items": []map[string]any{{"pipeline": "watch", "enabled": true}}})
	f.set("rows", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
		time.Sleep(900 * time.Millisecond)
		next.ServeHTTP(w, r)
	})
	id := startMove(t, a, "slowrows", "c", nil)
	mv := waitMove(t, a, id, 20*time.Second, "failed", "done")
	if mv["state"] != "failed" || !strings.Contains(fmt.Sprint(mv["error"]), "BINVAULT_MOVE_FREEZE_TIMEOUT") {
		t.Fatalf("a move that froze too long: %v", mv)
	}
	servesAgain(t, tc, cr, "slowrows")
	// the bucket's pipelines work again: the write made after the failed move reaches the service
	waitFor(t, 10*time.Second, "the pipeline to run after the failed move", func() bool { return len(svc.callsOf("watch")) > 0 })
	waitFor(t, 10*time.Second, "c to drop its copy", func() bool {
		recs := moveRecords(t, c, "target")
		return len(recs) == 1 && recs[0]["state"] == "abandoned"
	})
	if _, err := c.app.DB.Read().GetBucket(context.Background(), "slowrows"); err == nil {
		t.Fatal("c holds the bucket")
	}
	if m := a.metric(t, "binvault_moves_total"); !strings.Contains(m, `outcome="failed"`) {
		t.Fatalf("binvault_moves_total: %q", m)
	}
}

// The cutover waits for a proper answer. A garbage page, an error from a proxy, a hang and an answer
// for another move are no answer: the bucket stays paused and the question is repeated; the answer
// OK ends it, and asking again is harmless (spec §8.8 step 5).
func TestClusterMoveActivationWithoutAnswer(t *testing.T) {
	f := newFaults()
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i == 2 {
			o.PeerWrap = f.wrap
		}
		o.MoverTuning.ActivateTimeout = 500 * time.Millisecond
	})
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	cr := seedBucket(t, a, "silent", "b", 10)
	var released atomic.Bool
	f.set("activate", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
		switch {
		case released.Load():
			next.ServeHTTP(w, r)
		case n == 1:
			faultGarbage(w)
		case n == 2:
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			_, _ = w.Write([]byte(`{"error":"proxy"}`))
		case n == 3:
			<-r.Context().Done() // no answer within A's timeout
		case n == 4:
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"move":"mv_somethingelse","result":"OK"}`))
		default:
			next.ServeHTTP(w, r)
		}
	})
	id := startMove(t, a, "silent", "c", nil)
	waitMove(t, a, id, 20*time.Second, "cutover")
	waitFor(t, 20*time.Second, "four calls without an answer", func() bool { return f.count("activate") >= 4 })
	// nothing is served meanwhile, and the move has not given up
	for _, n := range []*cnode{a, b} {
		if r := n.s3(cr, "GET", "/silent/k000", nil); r.status != 503 {
			t.Fatalf("a bucket whose move has no answer yet is served through %s: %d", n.name, r.status)
		}
	}
	if st, _ := moveState(a, id); st != "cutover" && st != "done" {
		t.Fatalf("state %s", st)
	}
	mv := waitMove(t, a, id, 20*time.Second, "done", "failed")
	if mv["state"] != "done" {
		t.Fatalf("the move: %v", mv)
	}
	released.Store(true)
	servesAgain(t, tc, cr, "silent")
	// the target's decision is final and repeatable
	for i := 0; i < 2; i++ {
		code, hdr, raw := tc.peerCall(c, "POST", "/_peer/v1/moves/"+id+"/activate", nil)
		var ans map[string]any
		_ = json.Unmarshal(raw, &ans)
		if code != 200 || !strings.HasPrefix(hdr.Get("Content-Type"), "application/json") || ans["move"] != id || ans["result"] != "OK" {
			t.Fatalf("activating again: %d %s", code, raw)
		}
	}
}

// The source restarts while the target has not answered: the bucket stays out of service after the
// restart and the question is asked again until the target answers.
func TestClusterMoveSourceRestartsInCutover(t *testing.T) {
	f := newFaults()
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i == 2 {
			o.PeerWrap = f.wrap
		}
	})
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	cr := seedBucket(t, a, "resume", "a", 10)
	var released atomic.Bool
	f.set("activate", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
		if released.Load() {
			next.ServeHTTP(w, r)
			return
		}
		faultGarbage(w)
	})
	id := startMove(t, a, "resume", "c", nil)
	waitMove(t, a, id, 10*time.Second, "cutover")
	a = tc.restart(0, nil)
	tc.waitReady(15 * time.Second)
	tc.settle()
	if st, _ := moveState(a, id); st != "cutover" {
		t.Fatalf("after the restart the move is %q", st)
	}
	for _, n := range []*cnode{a, b, c} {
		if r := n.s3(cr, "GET", "/resume/k000", nil); r.status != 503 {
			t.Fatalf("after the restart the paused bucket is served through %s: %d", n.name, r.status)
		}
	}
	callsBefore := f.count("activate")
	released.Store(true)
	mv := waitMove(t, a, id, 20*time.Second, "done", "failed")
	if mv["state"] != "done" || f.count("activate") <= callsBefore {
		t.Fatalf("the resumed move: %v", mv)
	}
	servesAgain(t, tc, cr, "resume")
	if _, err := a.app.DB.Read().GetBucket(context.Background(), "resume"); err == nil {
		t.Fatal("the old home kept the bucket")
	}
}

// The target restarts before it activated: it gives the copy up at boot and marks the move
// abandoned, so that the source's later question is answered REFUSED; the source takes the bucket
// back and serves it again.
func TestClusterMoveTargetRestartsBeforeActivation(t *testing.T) {
	f := newFaults()
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i == 2 {
			o.PeerWrap = f.wrap
		}
	})
	a, c := tc.nodes[0], tc.nodes[2]
	cr := seedBucket(t, a, "abandon", "a", 10)
	var released atomic.Bool
	f.set("activate", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
		if released.Load() {
			next.ServeHTTP(w, r)
			return
		}
		faultGarbage(w)
	})
	id := startMove(t, a, "abandon", "c", nil)
	waitMove(t, a, id, 10*time.Second, "cutover")
	if recs := moveRecords(t, c, "target"); len(recs) != 1 || recs[0]["state"] != "verified" {
		t.Fatalf("the target before its restart: %v", recs)
	}
	c = tc.restart(2, nil)
	tc.waitReady(15 * time.Second)
	tc.settle()
	if recs := moveRecords(t, c, "target"); len(recs) != 1 || recs[0]["state"] != "abandoned" {
		t.Fatalf("the target after its restart: %v", recs)
	}
	if _, err := c.app.DB.Read().GetBucket(context.Background(), "abandon"); err == nil {
		t.Fatal("the target kept the partial copy through the restart")
	}
	if n := countFiles(filepath.Join(c.dir, "blobs")); n != 0 {
		t.Fatalf("%d blob files of the abandoned copy are left", n)
	}
	released.Store(true)
	mv := waitMove(t, a, id, 20*time.Second, "failed", "done")
	if mv["state"] != "failed" || !strings.Contains(fmt.Sprint(mv["error"]), "REFUSED") && !strings.Contains(fmt.Sprint(mv["error"]), "refused") {
		t.Fatalf("the move after the target's refusal: %v", mv)
	}
	servesAgain(t, tc, cr, "abandon")
	if h, e := bucketHome(t, a, "abandon"); h != "a" || e != 0 {
		t.Fatalf("home after a refused activation: %s %d", h, e)
	}
}

// The calls of the protocol by hand: a decision is taken once and is final.
func TestClusterMoveProtocolDecisions(t *testing.T) {
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		o.MoverTuning = mover.Tuning{IdleTimeout: 400 * time.Millisecond, ActivateTimeout: time.Second}
	})
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	_ = seedBucket(t, a, "proto", "b", 2)
	rec, _ := a.app.Cluster().Bucket("proto")
	prepare := map[string]any{"bucket": "proto", "generation": rec.Generation, "epoch": 1, "from": b.nodeID(), "bytes": 100, "key_ids": []string{}, "freeze_timeout_ms": 1}
	call := func(id, verb string) (int, map[string]any) {
		code, _, raw := tc.peerCall(c, "POST", "/_peer/v1/moves/"+id+"/"+verb, map[string]any{})
		var out map[string]any
		_ = json.Unmarshal(raw, &out)
		return code, out
	}
	// an unknown move: REFUSED
	if code, out := call("mv_000000000000000000UNKNOWN0", "activate"); code != 200 || out["result"] != "REFUSED" {
		t.Fatalf("activate of an unknown move: %d %v", code, out)
	}
	// prepared but not verified: activating abandons it, for good
	id := "mv_00000000000000000000PREP01"
	if code, _, raw := tc.peerCall(c, "POST", "/_peer/v1/moves/"+id+"/prepare", prepare); code != 200 {
		t.Fatalf("prepare: %d %s", code, raw)
	}
	if code, _, raw := tc.peerCall(c, "POST", "/_peer/v1/moves/"+id+"/prepare", prepare); code != 200 { // asked twice: the same answer
		t.Fatalf("prepare again: %d %s", code, raw)
	}
	// the node takes part in one move at a time: a second one is told to wait
	prepare2 := map[string]any{"bucket": "proto", "generation": rec.Generation, "epoch": 1, "from": b.nodeID(), "bytes": 100, "key_ids": []string{}}
	if code, _, raw := tc.peerCall(c, "POST", "/_peer/v1/moves/mv_00000000000000000000PREP02/prepare", prepare2); code != 409 || !strings.Contains(string(raw), `"busy"`) {
		t.Fatalf("a second prepare: %d %s", code, raw)
	}
	if code, out := call(id, "activate"); code != 200 || out["result"] != "REFUSED" {
		t.Fatalf("activate before the rows: %d %v", code, out)
	}
	if code, out := call(id, "activate"); code != 200 || out["result"] != "REFUSED" {
		t.Fatalf("activate again: %d %v", code, out)
	}
	if code, out := call(id, "discard"); code != 200 || out["result"] != "ok" {
		t.Fatalf("discard of an abandoned move: %d %v", code, out)
	}
	// the slot is free again
	id2 := "mv_00000000000000000000PREP02"
	if code, _, raw := tc.peerCall(c, "POST", "/_peer/v1/moves/"+id2+"/prepare", prepare2); code != 200 {
		t.Fatalf("prepare after the first move ended: %d %s", code, raw)
	}
	// a source that goes silent: the target gives the copy up by itself
	waitFor(t, 10*time.Second, "the idle move to be abandoned", func() bool {
		for _, r := range moveRecords(t, c, "target") {
			if r["id"] == id2 {
				return r["state"] == "abandoned"
			}
		}
		return false
	})
	if code, out := call(id2, "activate"); code != 200 || out["result"] != "REFUSED" {
		t.Fatalf("activate after the target gave up: %d %v", code, out)
	}
	// the answers are JSON with the id echoed and nothing else would be taken for one
	code, hdr, raw := tc.peerCall(c, "POST", "/_peer/v1/moves/"+id2+"/activate", nil)
	if code != 200 || !strings.HasPrefix(hdr.Get("Content-Type"), "application/json") || !strings.Contains(string(raw), `"move":"`+id2+`"`) {
		t.Fatalf("the form of an activate answer: %d %v %s", code, hdr, raw)
	}
	// a bad id and a wrong method are not mistaken for moves
	if code, _, _ := tc.peerCall(c, "POST", "/_peer/v1/moves/not-a-move/activate", nil); code != 404 {
		t.Fatalf("a bad move id: %d", code)
	}
	if code, _, _ := tc.peerCall(c, "GET", "/_peer/v1/moves/"+id2+"/activate", nil); code != 404 {
		t.Fatalf("GET activate: %d", code)
	}
	// and a request without the cluster key is not served at all
	req, _ := http.NewRequest("POST", c.peerURL+"/_peer/v1/moves/"+id2+"/activate", nil)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 401 {
		t.Fatalf("the move protocol without the cluster key: %d", res.StatusCode)
	}
}

// The source dies at three instants of the end game — the target answered OK but nothing is recorded
// yet, the move is recorded but the catalog is not, the catalog is written but the cleanup is not —
// and finishes the move after its restart. The new home serves from the moment it activated.
func TestClusterMoveSourceCrashPoints(t *testing.T) {
	for _, point := range []string{"ok", "moved", "handoff"} {
		point := point
		t.Run(point, func(t *testing.T) {
			var armed atomic.Bool
			armed.Store(true)
			tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
				if i == 0 {
					o.MoverTuning.CrashPoint = func(p string) bool { return p == point && armed.Load() }
				}
			})
			a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
			ctx := context.Background()
			cr := seedBucket(t, a, "crash", "a", 6)
			id := startMove(t, a, "crash", "c", nil)

			// the target has decided; the source is stuck where the test says
			waitFor(t, 10*time.Second, "the target to activate", func() bool {
				recs := moveRecords(t, c, "target")
				return len(recs) == 1 && recs[0]["state"] == "activated"
			})
			waitFor(t, 10*time.Second, "the source to reach "+point, func() bool {
				switch point {
				case "ok":
					return f2(c.app.DB.Read().GetBucket(ctx, "crash")) == 1
				case "moved":
					st, _ := a.app.DB.Read().GetMove(ctx, id)
					return st != nil && st.State == "moved"
				}
				h, e := bucketHome(t, a, "crash")
				st, _ := a.app.DB.Read().GetMove(ctx, id)
				return st != nil && st.State == "moved" && h == "c" && e == 1
			})
			// the new home serves already, to clients that ask any node but the stuck one
			for _, n := range []*cnode{b, c} {
				eventually(t, 5*time.Second, n.name+" to serve the moved bucket", func() bool {
					return n.s3(cr, "GET", "/crash/k000", nil).status == 200
				})
			}
			b.must(cr, 200, "PUT", "/crash/written-on-the-new-home", []byte("v"))

			armed.Store(false)
			a = tc.restart(0, nil)
			tc.waitReady(15 * time.Second)
			tc.settle()
			mv := waitMove(t, a, id, 20*time.Second, "done", "failed")
			if mv["state"] != "done" {
				t.Fatalf("the move after the restart: %v", mv)
			}
			if _, err := a.app.DB.Read().GetBucket(ctx, "crash"); err == nil {
				t.Fatal("the old home kept the rows")
			}
			for _, n := range tc.nodes {
				n.must(cr, 200, "GET", "/crash/k005", nil)
				n.must(cr, 200, "GET", "/crash/written-on-the-new-home", nil)
			}
			if h, e := bucketHome(t, a, "crash"); h != "c" || e != 1 {
				t.Fatalf("home after the restart: %s %d", h, e)
			}
			a.must(cr, 200, "PUT", "/crash/after-the-restart", []byte("v"))
		})
	}
}

// f2 returns the epoch of a bucket row (-1 if there is none).
func f2(b *meta.Bucket, err error) int64 {
	if err != nil {
		return -1
	}
	return b.Epoch
}

// A bucket deleted — even deleted and created again — while it is being copied ends the move without
// harm: the target drops what it received and the name is free to use on it.
func TestClusterMoveBucketDeletedWhileCopying(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, c := tc.nodes[0], tc.nodes[2]
	cr := seedBucket(t, a, "vanish", "a", 3)
	big := make([]byte, 3<<20)
	_, _ = rand.Read(big)
	a.must(cr, 200, "PUT", "/vanish/big", big)
	id := startMove(t, a, "vanish", "c", map[string]any{"max_bytes_per_second": 1 << 20})
	waitMove(t, a, id, 10*time.Second, "copying")
	a.mustAdmin(204, "DELETE", "/buckets/vanish?force=true&wait=replicated", nil)
	// created again under the same name before the move notices
	cr2 := seedBucket(t, a, "vanish", "a", 2)
	mv := waitMove(t, a, id, 20*time.Second, "failed", "done")
	if mv["state"] != "failed" {
		t.Fatalf("a move of a bucket that was replaced: %v", mv)
	}
	waitFor(t, 10*time.Second, "c to drop what it received", func() bool {
		recs := moveRecords(t, c, "target")
		return len(recs) == 1 && recs[0]["state"] == "abandoned" && countFiles(filepath.Join(c.dir, "blobs")) == 0
	})
	servesAgain(t, tc, cr2, "vanish")
	if r := a.s3(cr, "GET", "/vanish/k000", nil); r.status == 200 {
		t.Fatal("the token of the deleted bucket works on the new one")
	}
	// and a move of the new bucket goes through
	id2 := startMove(t, a, "vanish", "c", nil)
	if mv := waitMove(t, a, id2, 20*time.Second, "done", "failed"); mv["state"] != "done" {
		t.Fatalf("the move of the re-created bucket: %v", mv)
	}
	servesAgain(t, tc, cr2, "vanish")
}

// The target dies right after it decided to activate, before it told the catalog: after its restart it
// writes the hand-off by itself, and the source's repeated question is answered OK.
func TestClusterMoveTargetDiesAfterItsDecision(t *testing.T) {
	var armed atomic.Bool
	armed.Store(true)
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i == 2 {
			o.MoverTuning.CrashPoint = func(p string) bool { return p == "activated" && armed.Load() }
		}
		o.MoverTuning.ActivateTimeout = 300 * time.Millisecond
	})
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	ctx := context.Background()
	cr := seedBucket(t, a, "decided", "a", 6)
	id := startMove(t, a, "decided", "c", nil)
	waitFor(t, 10*time.Second, "the target to decide", func() bool {
		recs := moveRecords(t, c, "target")
		return len(recs) == 1 && recs[0]["state"] == "activated"
	})
	// the decision is durable on c, the catalog does not say so, nothing is served
	if got, err := c.app.DB.Read().GetBucket(ctx, "decided"); err != nil || got.Epoch != 1 {
		t.Fatalf("the decision on the target: %+v %v", got, err)
	}
	if h, e := bucketHome(t, b, "decided"); h != "a" || e != 0 {
		t.Fatalf("the catalog before the target tells it: %s %d", h, e)
	}
	for _, n := range []*cnode{a, b, c} {
		if r := n.s3(cr, "GET", "/decided/k000", nil); r.status != 503 {
			t.Fatalf("a bucket whose move is half decided is served through %s: %d", n.name, r.status)
		}
	}
	if st, _ := moveState(a, id); st != "cutover" {
		t.Fatalf("the source: %s", st)
	}
	armed.Store(false)
	c = tc.restart(2, nil)
	tc.waitReady(15 * time.Second)
	tc.settle()
	if mv := waitMove(t, a, id, 20*time.Second, "done", "failed"); mv["state"] != "done" {
		t.Fatalf("the move after the target's restart: %v", mv)
	}
	for _, n := range tc.nodes {
		eventually(t, 5*time.Second, n.name+" to see the new home", func() bool {
			h, e := bucketHome(t, n, "decided")
			return h == "c" && e == 1
		})
	}
	servesAgain(t, tc, cr, "decided")
	tc.noAlarms()
	_ = c
}

// A move that waits in its cutover says why: its `error` shows what the last call to activate came
// back with (in memory only), and goes when the target answers.
func TestClusterMoveInCutoverShowsWhyItWaits(t *testing.T) {
	f := newFaults()
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i == 2 {
			o.PeerWrap = f.wrap
		}
		o.MoverTuning.ActivateTimeout = 500 * time.Millisecond
	})
	a := tc.nodes[0]
	cr := seedBucket(t, a, "waits", "a", 4)
	var released atomic.Bool
	f.set("activate", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
		if released.Load() {
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte("<html>Bad gateway</html>"))
	})
	id := startMove(t, a, "waits", "c", nil)
	waitMove(t, a, id, 20*time.Second, "cutover")
	waitFor(t, 10*time.Second, "the move to say why it waits", func() bool {
		_, mv := moveState(a, id)
		e := fmt.Sprint(mv["error"])
		return strings.Contains(e, "waiting for the target's answer to activate") && strings.Contains(e, "not an answer to activate") && strings.Contains(e, "502")
	})
	// the text is not a failure: the move is not over
	if st, _ := moveState(a, id); st != "cutover" {
		t.Fatalf("state %s", st)
	}
	released.Store(true)
	mv := waitMove(t, a, id, 20*time.Second, "done", "failed")
	if mv["state"] != "done" || mv["error"] != nil {
		t.Fatalf("the move: %v", mv)
	}
	servesAgain(t, tc, cr, "waits")
}

// A target that accepts the connection and then stops taking data — or answering — ends the move
// that is copying to it after BINVAULT_BODY_IDLE_TIMEOUT, instead of holding the source's slot for
// ever: the move fails (before its cutover, so the bucket was never lost), the target is told to drop
// what it has, and the next move runs.
func TestClusterMoveToATargetThatStallsFailsAndFreesTheSlot(t *testing.T) {
	f := newFaults()
	release := make(chan struct{})
	var once sync.Once
	t.Cleanup(func() { once.Do(func() { close(release) }) })
	tc := startClusterWith(t, 3, func(i int, c *config.Config) { c.BodyIdleTimeout = 700 * time.Millisecond },
		func(i int, o *app.Options) {
			if i == 1 {
				o.PeerWrap = f.wrap
			}
		})
	a, b := tc.nodes[0], tc.nodes[1]
	cr := seedBucket(t, a, "stalled", "a", 6)
	cr2 := seedBucket(t, a, "fine", "a", 3)
	f.set("blob", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
		<-release // never reads the body, never answers
		faultKill(w)
	})

	id := startMove(t, a, "stalled", "b", nil)
	started := time.Now()
	mv := waitMove(t, a, id, 30*time.Second, "failed", "done")
	if mv["state"] != "failed" || !strings.Contains(fmt.Sprint(mv["error"]), "stopped taking data") {
		t.Fatalf("the move to a target that stalls: %v", mv)
	}
	if took := time.Since(started); took > 20*time.Second {
		t.Fatalf("the move took %s to give up", took)
	}
	// the bucket was never frozen for it, and nothing was lost
	servesAgain(t, tc, cr, "stalled")
	// the target was told to drop its copy
	waitFor(t, 10*time.Second, "the target to abandon the move", func() bool {
		recs := moveRecords(t, b, "target")
		return len(recs) == 1 && recs[0]["state"] == "abandoned"
	})
	// the slot is free: another bucket moves, to the node that does not stall
	f.set("blob", nil)
	once.Do(func() { close(release) })
	id2 := startMove(t, a, "fine", "c", nil)
	if mv := waitMove(t, a, id2, 30*time.Second, "done", "failed"); mv["state"] != "done" {
		t.Fatalf("the next move: %v", mv)
	}
	servesAgain(t, tc, cr2, "fine")
}

// What follows the target's decision — the hand-off in the catalog, the pipelines, the node's slot —
// is the target's own: it runs on until it is done whether or not the source asks again (the source
// may have crashed, or been retired). Here the target's completion is slow, the source's call to
// activate times out and its next ones get no answer at all; the completion still ends: the catalog
// says the target is the home and the target takes part in another move.
func TestClusterMoveTargetCompletesTheActivationWithoutBeingAskedAgain(t *testing.T) {
	f := newFaults()
	gate := make(chan struct{})
	var once sync.Once
	t.Cleanup(func() { once.Do(func() { close(gate) }) })
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		o.MoverTuning.ActivateTimeout = 300 * time.Millisecond
		if i == 2 {
			o.PeerWrap = f.wrap
			// not a crash: the completion of the activation waits here until the test lets it go
			o.MoverTuning.CrashPoint = func(p string) bool {
				if p == "activated" {
					<-gate
				}
				return false
			}
		}
	})
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	cr := seedBucket(t, a, "late", "a", 5)
	cr2 := seedBucket(t, b, "other", "b", 3)
	var released atomic.Bool
	var askedByA atomic.Int64
	f.set("activate", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
		// only a's calls: the first one reaches the target, the others get garbage until released
		if r.Header.Get(cluster.HeaderNode) != a.nodeID() || askedByA.Add(1) == 1 || released.Load() {
			next.ServeHTTP(w, r)
			return
		}
		faultGarbage(w)
	})

	id := startMove(t, a, "late", "c", nil)
	waitFor(t, 10*time.Second, "the target to decide", func() bool {
		recs := moveRecords(t, c, "target")
		return len(recs) == 1 && recs[0]["state"] == "activated"
	})
	// the source's first call timed out while the completion waited; it asks again, and gets garbage
	waitFor(t, 10*time.Second, "the source to ask again", func() bool { return askedByA.Load() >= 3 })
	if h, e := bucketHome(t, b, "late"); h != "a" || e != 0 {
		t.Fatalf("the catalog before the completion: %s %d", h, e)
	}
	once.Do(func() { close(gate) })
	waitFor(t, 10*time.Second, "the target to write the hand-off by itself", func() bool {
		h, e := bucketHome(t, b, "late")
		return h == "c" && e == 1
	})
	if st, _ := moveState(a, id); st != "cutover" {
		t.Fatalf("the source got an answer it was not given: %s", st)
	}
	// the target's slot is free: it takes part in another move
	id2 := startMove(t, b, "other", "c", nil)
	if mv := waitMove(t, b, id2, 20*time.Second, "done", "failed"); mv["state"] != "done" {
		t.Fatalf("a move to the target after its activation: %v", mv)
	}
	released.Store(true)
	if mv := waitMove(t, a, id, 20*time.Second, "done", "failed"); mv["state"] != "done" {
		t.Fatalf("the first move: %v", mv)
	}
	servesAgain(t, tc, cr, "late")
	servesAgain(t, tc, cr2, "other")
	tc.noAlarms()
}

// A discard that is the first the target hears of a move overtook its prepare: the id is remembered
// as ended, the prepare that follows is refused (it would start a move nobody ends), and the node's
// slot is not taken.
func TestClusterMoveDiscardBeforePrepareIsRemembered(t *testing.T) {
	tc := startClusterWith(t, 3, nil, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	seedBucket(t, a, "overtaken", "b", 2)
	rec, _ := a.app.Cluster().Bucket("overtaken")
	prepare := map[string]any{"bucket": "overtaken", "generation": rec.Generation, "epoch": 1, "from": b.nodeID(), "bytes": 100, "key_ids": []string{}, "freeze_timeout_ms": 1000}

	const late = "mv_0000000000000000000000LATE"
	code, _, raw := tc.peerCall(c, "POST", "/_peer/v1/moves/"+late+"/discard", nil)
	var out map[string]any
	_ = json.Unmarshal(raw, &out)
	if code != 200 || out["result"] != "ok" {
		t.Fatalf("discard of a move the target has never heard of: %d %s", code, raw)
	}
	// the prepare that comes after it is refused, and says why
	code, _, raw = tc.peerCall(c, "POST", "/_peer/v1/moves/"+late+"/prepare", prepare)
	if code != 409 || !strings.Contains(string(raw), `"refused"`) || !strings.Contains(string(raw), "abandoned") {
		t.Fatalf("a prepare after the discard: %d %s", code, raw)
	}
	// nothing was received, no slot is held: another move is prepared at once
	if code, _, raw := tc.peerCall(c, "POST", "/_peer/v1/moves/mv_0000000000000000000000NEXT/prepare", prepare); code != 200 {
		t.Fatalf("a prepare of another move: %d %s", code, raw)
	}
	if code, _, _ := tc.peerCall(c, "POST", "/_peer/v1/moves/mv_0000000000000000000000NEXT/discard", nil); code != 200 {
		t.Fatalf("discard of that move: %d", code)
	}
	// and the activate of the overtaken move is REFUSED for good
	code, _, raw = tc.peerCall(c, "POST", "/_peer/v1/moves/"+late+"/activate", nil)
	_ = json.Unmarshal(raw, &out)
	if code != 200 || out["result"] != "REFUSED" {
		t.Fatalf("activate of the overtaken move: %d %s", code, raw)
	}
}
