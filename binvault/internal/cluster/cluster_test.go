package cluster

import (
	"fmt"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/obs"
)

func TestReplicatesBothWays(t *testing.T) {
	c := newManual(t, 2, nil)
	a, b := c[0], c[1]
	ctx := ctxT()
	must(a.node.CreateBucket(ctx, "photos", BucketEntry{Home: a.id()}))
	must(a.node.CreatePipeline(ctx, "scan", PipelineEntry{Definition: []byte(`{"name":"scan"}`)}))
	settle(c...)
	must(b.node.PutKey(ctx, "BVKAAAAAAAA", KeyEntry{Bucket: "photos"}))
	settle(c...)

	sameCatalog(t, "after both ways", catalogOf(t, a.node), catalogOf(t, b.node))
	if got := catalogOf(t, a.node); len(got) != 3 {
		t.Fatalf("%s", brief(got))
	}
	if home, _, ok := b.node.Home("photos"); !ok || home != a.id() {
		t.Fatalf("b's view of the home: %q %v", home, ok)
	}
	if bucket, ok := a.node.LookupKey("BVKAAAAAAAA"); !ok || bucket != "photos" {
		t.Fatalf("a's view of the key: %q %v", bucket, ok)
	}

	// what the admin layer shows
	peers := a.node.Peers()
	if len(peers) != 1 {
		t.Fatalf("%+v", peers)
	}
	p := peers[0]
	if p.ID != b.id() || p.Name != "node2" || !p.Reachable || p.Lag != 0 || p.Endpoint != "http://node2.example.test:9000" ||
		p.FreeDisk != 1<<30 || p.Version != "test" || p.Protocol != ProtocolVersion || p.LastPull.IsZero() || p.PeerLag != 0 || len(p.URLs) != 1 {
		t.Fatalf("%+v", p)
	}
	if got, ok := a.node.PeerByName("node2"); !ok || got.ID != b.id() {
		t.Fatal("PeerByName")
	}
	if id, ok := a.node.NodeID("node2"); !ok || id != b.id() || a.node.NodeName(b.id()) != "node2" || a.node.NodeName(a.id()) != "node1" {
		t.Fatal("name <-> id")
	}
	if u, ok := a.node.PeerURL(b.id()); !ok || u != b.url {
		t.Fatalf("PeerURL %q %v", u, ok)
	}
	if _, ok := a.node.PeerURL(a.id()); ok {
		t.Fatal("PeerURL of the node itself")
	}
	self := a.node.Self()
	if !self.Self || self.ID != a.id() || self.Name != "node1" || self.BucketsHomed != 1 || !self.Ready {
		t.Fatalf("%+v", self)
	}
	if p.BucketsHomed != 0 {
		t.Fatalf("b homes %d buckets", p.BucketsHomed)
	}
}

// URLs that reach one node under two names are one peer; two processes answering
// under one id are refused (a copied data dir).
func TestSelfDiscoveryAndAliases(t *testing.T) {
	l1, u1 := listener(t)
	l2, u2 := listener(t)
	lAlias, alias := listener(t)
	urls := []string{u1, u2, alias}
	a := newTestNode(t, spec{name: "a", l: l1, urls: urls})
	b := newTestNode(t, spec{name: "b", l: l2, urls: urls})
	serve(t, lAlias, b.node.Handler())

	a.node.discover(ctxT(), true)
	a.node.mu.Lock()
	classes := []urlClass{a.node.us[u1].class, a.node.us[u2].class, a.node.us[alias].class}
	a.node.mu.Unlock()
	if !reflect.DeepEqual(classes, []urlClass{classSelf, classPeer, classPeer}) {
		t.Fatalf("classes %v", classes)
	}
	if peers := a.node.Peers(); len(peers) != 1 || len(peers[0].URLs) != 2 {
		t.Fatalf("aliases are one peer: %+v", peers)
	}
	if up := a.node.usablePeers(); len(up) != 1 || up[0].url != u2 {
		t.Fatalf("one pull URL per peer: %+v", up)
	}
	if clones := a.node.Clones(); len(clones) != 0 {
		t.Fatalf("%+v", clones)
	}
	// the alias keeps working when the first URL fails
	b.down.Store(true)
	must(b.node.CreateBucket(ctxT(), "viaalias", BucketEntry{Home: b.id()}))
	a.node.discover(ctxT(), true)
	pullAlias := a.node.usablePeers()
	if len(pullAlias) != 1 || pullAlias[0].url != alias {
		t.Fatalf("pull URL after the first failed: %+v", pullAlias)
	}
	a.node.pullAll(ctxT())
	if _, ok := a.node.Bucket("viaalias"); !ok {
		t.Fatal("did not pull through the alias")
	}
}

// Both sides keep accepting catalog writes while cut off, and merge to identical
// catalogs when the link returns (spec §8.9).
func TestPartitionAndHeal(t *testing.T) {
	c := newManual(t, 3, nil)
	a, b, cn := c[0], c[1], c[2]
	ctx := ctxT()
	must(a.node.CreatePipeline(ctx, "scan", PipelineEntry{Definition: []byte(`{"name":"scan","v":0}`)}))
	must(a.node.CreateBucket(ctx, "shared", BucketEntry{Home: a.id()}))
	settle(c...)
	sameCatalog(t, "baseline", catalogOf(t, a.node), catalogOf(t, cn.node))

	cn.down.Store(true) // {c} against {a, b}
	must(a.node.CreateBucket(ctx, "left", BucketEntry{Home: a.id()}))
	must(b.node.PutKey(ctx, "BVKLEFTLEFT", KeyEntry{Bucket: "left"}))
	must(cn.node.CreateBucket(ctx, "right", BucketEntry{Home: cn.id()}))
	// the same pipeline edited on both sides: the later hlc wins everywhere
	must(a.node.UpdatePipeline(ctx, "scan", func(p PipelineEntry) (PipelineEntry, error) {
		p.Definition = []byte(`{"name":"scan","v":1,"side":"left"}`)
		return p, nil
	}))
	time.Sleep(5 * time.Millisecond)
	late := must(cn.node.UpdatePipeline(ctx, "scan", func(p PipelineEntry) (PipelineEntry, error) {
		p.Definition = []byte(`{"name":"scan","v":2,"side":"right"}`)
		return p, nil
	}))
	settle(c...)
	if _, ok := cn.node.Bucket("left"); ok {
		t.Fatal("the partition did not isolate c")
	}
	if _, ok := a.node.Bucket("right"); ok {
		t.Fatal("the partition did not isolate a and b")
	}
	sameCatalog(t, "a and b during the partition", catalogOf(t, a.node), catalogOf(t, b.node))
	for _, p := range a.node.Peers() {
		if p.ID == cn.id() && p.Reachable {
			t.Fatal("c should look unreachable from a")
		}
	}

	cn.down.Store(false)
	settle(c...)
	want := catalogOf(t, a.node)
	for i, n := range c {
		sameCatalog(t, fmt.Sprintf("node %d after the heal", i), want, catalogOf(t, n.node))
	}
	for _, name := range []string{"left", "right", "shared"} {
		if _, ok := cn.node.Bucket(name); !ok {
			t.Fatalf("bucket %s lost", name)
		}
	}
	p, _ := a.node.Pipeline("scan")
	if !strings.Contains(string(p.Definition), `"side":"right"`) || p.OpID() != late.ID() {
		t.Fatalf("the later edit must win: %s from %s", p.Definition, p.OpID())
	}
	// each side that saw both edits logged the loser
	foundConflict := false
	for _, n := range c {
		for _, cf := range n.node.Conflicts() {
			if cf.Register == "pipeline/scan" && cf.Winner == late.ID() {
				foundConflict = true
			}
		}
	}
	if !foundConflict {
		t.Fatal("the concurrent pipeline edit was not reported as a conflict")
	}
}

// Ops are relayed from every origin, so a change reaches a node that cannot talk
// to its author (spec §8.5).
func TestTransitiveRelay(t *testing.T) {
	la, ua := listener(t)
	lb, ub := listener(t)
	lc, uc := listener(t)
	a := newTestNode(t, spec{name: "a", l: la, urls: []string{ua, ub}}) // a only talks to b
	b := newTestNode(t, spec{name: "b", l: lb, urls: []string{ua, ub, uc}})
	c := newTestNode(t, spec{name: "c", l: lc, urls: []string{ub, uc}}) // c only talks to b
	ctx := ctxT()
	must(a.node.CreateBucket(ctx, "froma", BucketEntry{Home: a.id()}))
	must(c.node.CreateBucket(ctx, "fromc", BucketEntry{Home: c.id()}))
	settle(a, b, c)
	for _, n := range []*tnode{a, b, c} {
		for _, name := range []string{"froma", "fromc"} {
			if _, ok := n.node.Bucket(name); !ok {
				t.Fatalf("%s has not got %s", n.node.Name(), name)
			}
		}
	}
	sameCatalog(t, "relay", catalogOf(t, a.node), catalogOf(t, c.node))
}

// A local write nudges the peers, which pull at once: replication does not wait
// for the pull interval (spec §8.5).
func TestNudgeReplicatesAtOnce(t *testing.T) {
	c := newManual(t, 3, func(i int, sp *spec) {
		sp.start = true
		sp.cfg = func(cfg *config.Config) { cfg.ClusterPullInterval = time.Hour }
	})
	for _, n := range c {
		if err := n.node.WaitReady(ctxT()); err != nil {
			t.Fatal(err)
		}
	}
	// relay too: a's nudge reaches b and c; c may not wait for its own timer either
	start := time.Now()
	op := must(c[0].node.CreateBucket(ctxT(), "photos", BucketEntry{Home: c[0].id()}))
	eventually(t, 6*time.Second, "the bucket to reach b and c", func() bool {
		_, okB := c[1].node.Bucket("photos")
		_, okC := c[2].node.Bucket("photos")
		return okB && okC
	})
	if d := time.Since(start); d > 5*time.Second {
		t.Fatalf("replication took %s with a one hour pull interval", d)
	}
	if pending := c[0].node.WaitReplicated(ctxT(), []Op{op}, 3*time.Second); len(pending) != 0 {
		t.Fatalf("not acknowledged: %v", pending)
	}
}

func TestWaitReplicated(t *testing.T) {
	c := newManual(t, 3, func(i int, sp *spec) { sp.start = true })
	for _, n := range c {
		if err := n.node.WaitReady(ctxT()); err != nil {
			t.Fatal(err)
		}
	}
	a, b, d := c[0], c[1], c[2]
	op := must(a.node.CreateBucket(ctxT(), "photos", BucketEntry{Home: a.id()}))
	if pending := a.node.WaitReplicated(ctxT(), []Op{op}, 5*time.Second); len(pending) != 0 {
		t.Fatalf("pending: %v", pending)
	}
	for _, n := range []*tnode{b, d} {
		if _, ok := n.node.Bucket("photos"); !ok {
			t.Fatalf("%s acknowledged but does not have the bucket", n.node.Name())
		}
	}
	if pending := a.node.WaitReplicated(ctxT(), nil, time.Second); pending != nil {
		t.Fatal("nothing to wait for")
	}

	// b is cut off from a (both directions): the wait times out and names it
	a.down.Store(true)
	b.down.Store(true)
	op = must(a.node.CreateBucket(ctxT(), "second", BucketEntry{Home: a.id()}))
	start := time.Now()
	pending := a.node.WaitReplicated(ctxT(), []Op{op}, 600*time.Millisecond)
	if time.Since(start) < 500*time.Millisecond {
		t.Fatalf("returned after %s", time.Since(start))
	}
	// d cannot reach a either (a is down for everybody), so both peers are pending
	names := map[string]bool{}
	for _, p := range pending {
		names[p.Name] = true
		if p.URL == "" || p.ID == "" {
			t.Fatalf("%+v", p)
		}
	}
	if !names["node2"] || !names["node3"] || len(pending) != 2 {
		t.Fatalf("pending %v", pending)
	}
	// the cut-off is lifted: acknowledged
	a.down.Store(false)
	b.down.Store(false)
	if pending := a.node.WaitReplicated(ctxT(), []Op{op}, 10*time.Second); len(pending) != 0 {
		t.Fatalf("after healing: %v", pending)
	}
}

// A URL that has never answered is pending until it does; a retired node and a
// node's own URL are not waited for.
func TestWaitReplicatedUnknownAndRetired(t *testing.T) {
	l1, u1 := listener(t)
	l2, u2 := listener(t)
	ghost, ughost := listener(t)
	ghost.Close() // nothing listens there
	urls := []string{u1, u2, ughost}
	a := newTestNode(t, spec{name: "a", l: l1, urls: urls})
	b := newTestNode(t, spec{name: "b", l: l2, urls: urls})
	op := must(a.node.CreateBucket(ctxT(), "photos", BucketEntry{Home: a.id()}))
	settle(a, b)
	pending := a.node.WaitReplicated(ctxT(), []Op{op}, 200*time.Millisecond)
	if len(pending) != 1 || pending[0].URL != ughost || pending[0].ID != "" {
		t.Fatalf("pending %+v", pending)
	}
	if got := pending[0].String(); got != ughost {
		t.Fatal(got)
	}
	// a node that answers and is acknowledged by its pull is not pending; a retired
	// one is not waited for
	if err := a.node.Retire(ctxT(), b.id()); err != nil {
		t.Fatal(err)
	}
	pending = a.node.WaitReplicated(ctxT(), []Op{op}, 100*time.Millisecond)
	if len(pending) != 1 || pending[0].URL != ughost {
		t.Fatalf("pending after retiring b: %+v", pending)
	}
	if err := a.node.Retire(ctxT(), a.id()); err != ErrSelf {
		t.Fatalf("%v", err)
	}
	if err := a.node.Retire(ctxT(), "n_nobody"); err != ErrUnknownNode {
		t.Fatalf("%v", err)
	}
}

func TestRetireRefusedWhileBucketsAreHomedThere(t *testing.T) {
	c := newManual(t, 2, nil)
	ctx := ctxT()
	must(c[1].node.CreateBucket(ctx, "onb", BucketEntry{Home: c[1].id()}))
	settle(c...)
	err := c[0].node.Retire(ctx, c[1].id())
	if err == nil || !strings.Contains(err.Error(), ErrHomesBuckets.Error()) {
		t.Fatalf("%v", err)
	}
	// dropping the entry (catalog_only) lets the node go
	must(c[0].node.DeleteBucket(ctx, "onb"))
	if err := c[0].node.Retire(ctx, c[1].id()); err != nil {
		t.Fatal(err)
	}
	peers := c[0].node.Peers()
	if len(peers) != 1 || !peers[0].Retired || peers[0].RetiredWhy != "removed by an admin" {
		t.Fatalf("%+v", peers)
	}
	// it is still reachable at its URL: answering again makes it a member again
	c[0].node.discover(ctx, true)
	if peers := c[0].node.Peers(); len(peers) != 1 || peers[0].Retired {
		t.Fatalf("a retired node that answers must be revived: %+v", peers)
	}
}

// The subscribers see every register that changes, in commit order, local or
// replicated, once; Replay re-delivers the current state.
func TestChangeNotifications(t *testing.T) {
	c := newManual(t, 2, nil)
	a, b := c[0], c[1]
	var logA, logB changeLog
	a.node.OnChange(logA.add)
	b.node.OnChange(logB.add)
	ctx := ctxT()

	op1 := must(a.node.CreateBucket(ctx, "photos", BucketEntry{Home: a.id()}))
	must(a.node.CreatePipeline(ctx, "scan", PipelineEntry{Definition: []byte(`{"name":"scan"}`)}))
	must(a.node.DeleteBucket(ctx, "photos"))
	eventually(t, 2*time.Second, "local changes", func() bool { return len(logA.snapshot()) == 3 })
	for _, ch := range logA.snapshot() {
		if !ch.Local || ch.Replayed {
			t.Fatalf("%+v", ch)
		}
	}
	got := logA.snapshot()
	if got[0].Key != "bucket/photos" || got[0].Deleted || got[0].Op.ID() != op1.ID() || got[1].Key != "pipeline/scan" || !got[2].Deleted || got[2].Value != nil {
		t.Fatalf("%+v", got)
	}
	if be, err := got[0].Bucket(); err != nil || be.Home != a.id() || be.Generation != op1.ID() {
		t.Fatalf("%+v %v", be, err)
	}
	if pe, err := got[1].Pipeline(); err != nil || pe.Revision != 1 {
		t.Fatalf("%+v %v", pe, err)
	}

	settle(c...)
	eventually(t, 2*time.Second, "replicated changes", func() bool { return len(logB.snapshot()) == 2 })
	for _, ch := range logB.snapshot() {
		if ch.Local {
			t.Fatalf("a replicated change flagged Local: %+v", ch)
		}
	}
	// the create of photos lost to its own delete in one batch: only the winner is delivered
	for _, ch := range logB.snapshot() {
		if ch.Key == "bucket/photos" && !ch.Deleted {
			t.Fatalf("a superseded value was delivered: %+v", ch)
		}
	}

	// Replay: everything current, tombstones included, flagged Replayed
	before := len(logB.snapshot())
	if err := b.node.Replay(ctx, KindPipeline); err != nil {
		t.Fatal(err)
	}
	eventually(t, 2*time.Second, "replay", func() bool { return len(logB.snapshot()) == before+1 })
	last := logB.snapshot()[before]
	if !last.Replayed || last.Key != "pipeline/scan" || last.Deleted {
		t.Fatalf("%+v", last)
	}
	if err := b.node.Replay(ctx); err != nil {
		t.Fatal(err)
	}
	eventually(t, 2*time.Second, "full replay", func() bool { return len(logB.snapshot()) == before+1+2 })
}

// A peer's acknowledgement is its next pull. The pull loop applies a batch, waits
// for the subscribers, and only then asks again: so `?wait=replicated` returning
// means the change has been materialised (spec §8.7).
func TestAcknowledgementWaitsForSubscribers(t *testing.T) {
	c := newManual(t, 2, func(i int, sp *spec) { sp.start = true })
	for _, n := range c {
		if err := n.node.WaitReady(ctxT()); err != nil {
			t.Fatal(err)
		}
	}
	a, b := c[0], c[1]
	release := make(chan struct{})
	var once sync.Once
	b.node.OnChange(func([]Change) { <-release })
	t.Cleanup(func() { once.Do(func() { close(release) }) })

	op := must(a.node.CreatePipeline(ctxT(), "scan", PipelineEntry{Definition: []byte(`{"name":"scan"}`)}))
	pending := a.node.WaitReplicated(ctxT(), []Op{op}, 400*time.Millisecond)
	if len(pending) != 1 || pending[0].Name != "node2" {
		t.Fatalf("acknowledged before the subscriber ran: %v", pending)
	}
	if _, ok := b.node.Pipeline("scan"); !ok {
		t.Fatal("the op itself is applied (only the acknowledgement waits)")
	}
	once.Do(func() { close(release) })
	if pending := a.node.WaitReplicated(ctxT(), []Op{op}, 5*time.Second); len(pending) != 0 {
		t.Fatalf("%v", pending)
	}
}

// The vector in the database covers every op a node has applied, whichever pull
// loop applied it, so an acknowledgement must wait for the changes of ops that a
// different loop queued. Node c learns the op from b (a relay), not from a: its
// loop to b applies it and queues the change behind a subscriber that has not
// returned. Its loop to a then starts a new exchange; the vector it reads covers
// the op, and sending it now would let a's ?wait=replicated return while the op
// has no effect on c yet (a pipeline GET answering 404 right after a 201).
func TestAcknowledgementCoversOpsAppliedByAnotherLoop(t *testing.T) {
	c := newManual(t, 3, nil)
	a, b, d := c[0], c[1], c[2]
	ctx := ctxT()
	settle(c...)
	peer := func(from, of *tnode) *peerState {
		from.node.mu.Lock()
		defer from.node.mu.Unlock()
		return from.node.peers[of.id()]
	}
	release := make(chan struct{})
	var once sync.Once
	var delivered atomic.Int32
	d.node.OnChange(func([]Change) { <-release; delivered.Add(1) })
	t.Cleanup(func() { once.Do(func() { close(release) }) })

	op := must(a.node.CreatePipeline(ctx, "scan", PipelineEntry{Definition: []byte(`{"name":"scan"}`)}))
	if err := b.node.pullPeer(ctx, peer(b, a)); err != nil { // b has the op, and has acknowledged it to a
		t.Fatal(err)
	}
	relay := make(chan error, 1)
	go func() { relay <- d.node.pullPeer(ctx, peer(d, b)) }() // c applies the op through b; its subscriber blocks
	eventually(t, 5*time.Second, "c to apply the op it got from b", func() bool {
		_, ok := d.node.Pipeline("scan")
		return ok
	})
	direct := make(chan error, 1)
	go func() { direct <- d.node.pullPeer(ctx, peer(d, a)) }() // c's exchange with the writer itself

	pending := a.node.WaitReplicated(ctx, []Op{op}, 600*time.Millisecond)
	if len(pending) != 1 || pending[0].Name != "node3" || delivered.Load() != 0 {
		t.Fatalf("acknowledged before the subscriber of the acknowledging node ran: pending=%v, delivered=%d", pending, delivered.Load())
	}
	once.Do(func() { close(release) })
	if pending := a.node.WaitReplicated(ctx, []Op{op}, 5*time.Second); len(pending) != 0 || delivered.Load() == 0 {
		t.Fatalf("after the subscriber returned: pending=%v, delivered=%d", pending, delivered.Load())
	}
	for _, ch := range []chan error{relay, direct} {
		if err := <-ch; err != nil {
			t.Fatal(err)
		}
	}
}

// A subscriber that panics does not stop the delivery.
func TestSubscriberPanicIsContained(t *testing.T) {
	tn := newTestNode(t, spec{})
	var log changeLog
	tn.node.OnChange(func([]Change) { panic("boom") })
	tn.node.OnChange(log.add)
	must(tn.node.CreateBucket(ctxT(), "photos", BucketEntry{Home: tn.id()}))
	eventually(t, 2*time.Second, "delivery after a panic", func() bool { return len(log.snapshot()) == 1 })
}

func TestSyncNowAndBucketCheck(t *testing.T) {
	c := newManual(t, 3, nil)
	a, b, d := c[0], c[1], c[2]
	ctx := ctxT()
	settle(c...)
	// b creates a bucket that has not replicated: a asks every peer, finds it, pulls
	must(b.node.CreateBucket(ctx, "fresh", BucketEntry{Home: b.id()}))
	found, unreachable := a.node.PeersKnowBucket(ctx, "fresh")
	if len(found) != 1 || found[0].NodeID != b.id() || found[0].Node != "node2" || found[0].Home != b.id() || len(unreachable) != 0 {
		t.Fatalf("%+v %v", found, unreachable)
	}
	if found, _ := a.node.PeersKnowBucket(ctx, "unknown"); len(found) != 0 {
		t.Fatalf("%+v", found)
	}
	if _, ok := a.node.Bucket("fresh"); ok {
		t.Fatal("replicated already")
	}
	if !a.node.SyncNow(ctx) {
		t.Fatal("first SyncNow should pull")
	}
	if _, ok := a.node.Bucket("fresh"); !ok {
		t.Fatal("SyncNow did not find the bucket")
	}
	if a.node.SyncNow(ctx) {
		t.Fatal("SyncNow runs at most once a second")
	}
	// an unreachable peer is named
	d.down.Store(true)
	a.node.discover(ctx, true)
	found, unreachable = a.node.PeersKnowBucket(ctx, "fresh")
	if len(unreachable) != 0 { // d is known to be down: it is not even asked
		t.Fatalf("%v", unreachable)
	}
	if len(found) != 1 {
		t.Fatalf("%+v", found)
	}
}

func TestMetricsAreRegistered(t *testing.T) {
	reg := obs.NewRegistry()
	c := newManual(t, 2, func(i int, sp *spec) {
		if i == 0 {
			sp.reg = reg
		}
	})
	settle(c...)
	must(c[0].node.CreateBucket(ctxT(), "photos", BucketEntry{Home: c[0].id()}))
	var sb strings.Builder
	if _, err := reg.WriteTo(&sb); err != nil {
		t.Fatal(err)
	}
	out := sb.String()
	for _, want := range []string{
		`binvault_cluster_peer_up{peer="node2"} 1`,
		`binvault_cluster_replication_lag_ops{peer="node2"} 0`,
		"binvault_cluster_held_ops 0",
		"binvault_cluster_conflicts 0",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("metrics lack %q:\n%s", want, out)
		}
	}
}

// ---- helpers ------------------------------------------------------------------------

// Route is the forwarder's cheap view of a node: where to send, and whether to try.
func TestRouteAndStatus(t *testing.T) {
	c := newManual(t, 2, nil)
	a, b := c[0], c[1]
	ctx := ctxT()
	must(a.node.CreateBucket(ctx, "photos", BucketEntry{Home: b.id()}))
	must(a.node.DeleteBucket(ctx, "photos")) // a tombstone
	settle(c...)

	if r, ok := a.node.Route(a.id()); !ok || !r.Self || !r.Reachable || r.Name != "node1" {
		t.Fatalf("self: %+v %v", r, ok)
	}
	r, ok := a.node.Route(b.id())
	if !ok || r.Self || !r.Reachable || r.URL != b.url || r.Name != "node2" || r.Draining || r.Retired {
		t.Fatalf("peer: %+v %v", r, ok)
	}
	if _, ok := a.node.Route("n_nobody"); ok {
		t.Fatal("unknown node")
	}
	b.down.Store(true)
	a.node.discover(ctx, true)
	if r, _ := a.node.Route(b.id()); r.Reachable || r.URL != b.url {
		t.Fatalf("a node that stopped answering is known down, and still has its URL: %+v", r)
	}
	b.down.Store(false)
	a.node.discover(ctx, true)
	if r, _ := a.node.Route(b.id()); !r.Reachable {
		t.Fatalf("%+v", r)
	}
	if err := a.node.Retire(ctx, b.id()); err != nil {
		t.Fatal(err)
	}
	if r, _ := a.node.Route(b.id()); !r.Retired || r.Reachable {
		t.Fatalf("a retired node is not a route: %+v", r)
	}

	st, err := a.node.Status(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if st.Mode != "cluster" || !st.Ready || st.Self.ID != a.id() || len(st.Peers) != 1 || st.Origin != a.id() ||
		st.VV[a.id()] != 2 || st.Log.Ops != 2 || st.Log.Registers != 0 || st.Log.Tombstones != 1 || st.Log.OldestOp.IsZero() {
		t.Fatalf("%+v", st)
	}
	solo := newTestNode(t, spec{}).node
	solo.cfg.ClusterURLs = nil
	solo.single = true
	if st, _ := solo.Status(ctx); st.Mode != "single" {
		t.Fatalf("%+v", st)
	}
}

func TestAutoPlacement(t *testing.T) {
	free := []int64{100, 300, 200, 500}
	c := newManual(t, 4, func(i int, sp *spec) {})
	for i, n := range c {
		v := free[i]
		n.node.freeDisk = func() int64 { return v }
	}
	settle(c...)
	a := c[0].node
	if p, ok := a.AutoPlacement(); !ok || p.Name != "node4" {
		t.Fatalf("the node with the most free disk: %+v %v", p, ok)
	}
	if err := c[3].node.SetCordoned(ctxT(), true); err != nil {
		t.Fatal(err)
	}
	c[3].node.discover(ctxT(), true)
	settle(c...)
	if p, ok := a.AutoPlacement(); !ok || p.Name != "node2" {
		t.Fatalf("a cordoned node is skipped: %+v %v", p, ok)
	}
	c[1].down.Store(true)
	settle(c...)
	if p, ok := a.AutoPlacement(); !ok || p.Name != "node3" {
		t.Fatalf("an unreachable node is skipped: %+v %v", p, ok)
	}
	// this node counts too
	free[0] = 1 << 40
	a.freeDisk = func() int64 { return free[0] }
	if p, ok := a.AutoPlacement(); !ok || p.Name != "node1" || !p.Self {
		t.Fatalf("%+v %v", p, ok)
	}
}
