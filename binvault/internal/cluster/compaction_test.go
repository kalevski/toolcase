package cluster

import (
	"bytes"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/config"
)

func retention(d time.Duration) func(*config.Config) {
	return func(c *config.Config) { c.ClusterRetention = d }
}

func opCount(t *testing.T, n *Node) int64 {
	t.Helper()
	st, err := n.db.Read().CatalogStats(ctxT())
	if err != nil {
		t.Fatal(err)
	}
	return st.Ops
}

// live drops the tombstones: nodes purge them on their own schedule.
func live(regs []regView) []regView {
	var out []regView
	for _, r := range regs {
		if !r.Deleted {
			out = append(out, r)
		}
	}
	return out
}

func tombstonesOf(t *testing.T, n *Node) int {
	t.Helper()
	tombs, err := n.db.Read().CatalogTombstones(ctxT())
	if err != nil {
		t.Fatal(err)
	}
	return len(tombs)
}

// An op older than the retention that every known peer acknowledged goes; what a
// lagging or unreachable peer has not acknowledged stays (spec §8.5).
func TestCompactionWaitsForTheLaggingPeer(t *testing.T) {
	fc := newFakeClock()
	c := newManual(t, 3, func(i int, sp *spec) { sp.clock = fc; sp.cfg = retention(time.Hour) })
	a, b, d := c[0], c[1], c[2]
	ctx := ctxT()

	must(a.node.CreateBucket(ctx, "keep", BucketEntry{Home: a.id()}))
	must(a.node.CreateBucket(ctx, "gone1", BucketEntry{Home: a.id()}))
	must(a.node.DeleteBucket(ctx, "gone1")) // a tombstone every node acknowledges
	settle(c...)
	d.down.Store(true) // d is cut off from now on
	must(a.node.CreateBucket(ctx, "gone2", BucketEntry{Home: a.id()}))
	must(a.node.DeleteBucket(ctx, "gone2")) // a tombstone d has not seen
	settle(c...)

	// young ops stay, however many peers acknowledged them
	res, err := a.node.Compact(ctx)
	if err != nil || res.Ops != 0 || res.Tombstones != 0 {
		t.Fatalf("compacted ops younger than the retention: %+v %v", res, err)
	}
	fc.Advance(2 * time.Hour)
	before := opCount(t, a.node)
	res, err = a.node.Compact(ctx)
	if err != nil {
		t.Fatal(err)
	}
	// d acknowledged a:1..3 (keep, gone1 and its delete); b acknowledged all 5
	if res.Ops != 3 || opCount(t, a.node) != before-3 {
		t.Fatalf("compacted %d ops (%d left), want exactly what d acknowledged: %+v", res.Ops, opCount(t, a.node), res)
	}
	if res.Tombstones != 1 || tombstonesOf(t, a.node) != 1 {
		t.Fatalf("tombstones purged %d, left %d: only the one every peer acknowledged may go", res.Tombstones, tombstonesOf(t, a.node))
	}
	if _, err := a.node.Register(ctx, KindBucket, "gone1"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("the acknowledged tombstone should be purged: %v", err)
	}
	if reg, err := a.node.Register(ctx, KindBucket, "gone2"); err != nil || !reg.Deleted {
		t.Fatalf("the unacknowledged tombstone must stay: %+v %v", reg, err)
	}
	if by := a.node.CompactionBlockedBy(); len(by) != 1 || !strings.Contains(by[0], "node3") {
		t.Fatalf("GET /cluster must say who holds the log back: %v", by)
	}
	floors := must(a.db.Read().CatalogFloors(ctx))
	if floors[a.id()] != 3 {
		t.Fatalf("floors %v", floors)
	}

	// d returns, pulls the rest and acknowledges: the second run removes everything old
	d.down.Store(false)
	settle(c...)
	res, err = a.node.Compact(ctx)
	if err != nil || res.Ops != 2 || res.Tombstones != 1 {
		t.Fatalf("%+v %v", res, err)
	}
	if opCount(t, a.node) != 0 || tombstonesOf(t, a.node) != 0 {
		t.Fatalf("ops %d tombstones %d left", opCount(t, a.node), tombstonesOf(t, a.node))
	}
	if by := a.node.CompactionBlockedBy(); len(by) != 0 {
		t.Fatalf("%v", by)
	}
	// the catalog itself is untouched, and a peer that is up to date needs no snapshot
	sameCatalog(t, "after compaction", live(catalogOf(t, a.node)), live(catalogOf(t, b.node)))
	must(a.node.CreateBucket(ctx, "later", BucketEntry{Home: a.id()}))
	settle(c...)
	if _, ok := d.node.Bucket("later"); !ok {
		t.Fatal("replication after compaction")
	}
	_ = b
}

// Nothing is known about a URL that has never answered: compaction waits.
func TestCompactionBlockedByAURLThatNeverAnswered(t *testing.T) {
	fc := newFakeClock()
	la, ua := listener(t)
	ghost, ughost := listener(t)
	ghost.Close()
	a := newTestNode(t, spec{name: "a", l: la, urls: []string{ua, ughost}, clock: fc, cfg: retention(time.Hour)})
	ctx := ctxT()
	must(a.node.CreateBucket(ctx, "one", BucketEntry{Home: a.id()}))
	a.node.discover(ctx, true)
	fc.Advance(2 * time.Hour)
	res, err := a.node.Compact(ctx)
	if err != nil || res.Ops != 0 || len(res.Blocked) != 1 || res.Blocked[0] != ughost {
		t.Fatalf("%+v %v", res, err)
	}
	if by := a.node.CompactionBlockedBy(); len(by) != 1 || !strings.Contains(by[0], ughost) || !strings.Contains(by[0], "never answered") {
		t.Fatalf("%v", by)
	}
	if opCount(t, a.node) != 1 {
		t.Fatal("ops were removed")
	}
	// the node behind the URL turns up (here: a node at that address), pulls, and acknowledges
	lg := rebind(t, ghost.Addr().String())
	g := newTestNode(t, spec{name: "g", l: lg, urls: []string{ua, ughost}, clock: fc, cfg: retention(time.Hour)})
	settle(a, g)
	res, err = a.node.Compact(ctx)
	if err != nil || res.Ops != 1 || len(res.Blocked) != 0 {
		t.Fatalf("%+v %v", res, err)
	}
}

// A retired id never holds compaction back, and a peer that returns from beyond
// the compacted prefix catches up with a snapshot — merged, so what it wrote
// meanwhile survives.
func TestRetiredPeerDoesNotBlockAndReturningPeerGetsASnapshot(t *testing.T) {
	fc := newFakeClock()
	c := newManual(t, 2, func(i int, sp *spec) { sp.clock = fc; sp.cfg = retention(time.Hour); sp.tune = tuningWithChunk(5) })
	a, b := c[0], c[1]
	ctx := ctxT()
	for i := 0; i < 12; i++ {
		must(a.node.CreateBucket(ctx, fmt.Sprintf("bucket%02d", i), BucketEntry{Home: a.id()}))
	}
	must(a.node.PutKey(ctx, "BVKAAAAAAAA", KeyEntry{Bucket: "bucket00"}))
	must(a.node.DeleteBucket(ctx, "bucket11"))
	settle(c...)       // b has everything so far
	b.down.Store(true) // b is gone for a while...
	a.node.discover(ctx, true)
	must(a.node.CreateBucket(ctx, "whileaway", BucketEntry{Home: a.id()}))
	if err := a.node.Retire(ctx, b.id()); err != nil { // ...and an admin retires it
		t.Fatal(err)
	}
	fc.Advance(2 * time.Hour)
	res, err := a.node.Compact(ctx)
	if err != nil || res.Ops == 0 {
		t.Fatalf("a retired peer must not hold compaction back: %+v %v", res, err)
	}
	if opCount(t, a.node) != 0 {
		t.Fatalf("%d ops left", opCount(t, a.node))
	}
	// b wrote something of its own while it was away
	must(b.node.CreateBucket(ctx, "bs-own", BucketEntry{Home: b.id()}))
	// the ops it needs are compacted: a answers 409 and b merges a snapshot
	if _, err := a.node.serveOps(ctx, vvOf(t, b.node), 100, b.id(), keyIDsOf(b.node), true); !errors.Is(err, errSnapshotRequired) {
		t.Fatalf("%v", err)
	}
	b.down.Store(false)
	settle(c...)
	sameCatalog(t, "after the snapshot", live(catalogOf(t, a.node)), live(catalogOf(t, b.node)))
	if _, ok := a.node.Bucket("bs-own"); !ok {
		t.Fatal("what the returning peer wrote meanwhile was lost")
	}
	if _, ok := b.node.Bucket("whileaway"); !ok {
		t.Fatal("the snapshot did not bring the catalog")
	}
	if got := vvOf(t, b.node)[a.id()]; got != vvOf(t, a.node)[a.id()] {
		t.Fatalf("version vector after the snapshot: %d", got)
	}
	// the retired peer is a member again, and holds compaction back again
	for _, p := range a.node.Peers() {
		if p.Retired {
			t.Fatalf("%+v", p)
		}
	}
}

func tuningWithChunk(n int) *Tuning {
	t := fastTuning()
	t.SnapshotChunk = n
	return &t
}

// A new node bootstraps from a snapshot, merged in chunks (spec §8.5).
func TestSnapshotBootstrap(t *testing.T) {
	fc := newFakeClock()
	la, ua := listener(t)
	lb, ub := listener(t)
	ctx := ctxT()
	// a lives alone for a while and compacts everything
	a := newTestNode(t, spec{name: "a", l: la, urls: []string{ua}, clock: fc, cfg: retention(time.Hour), tune: tuningWithChunk(7)})
	for i := 0; i < 40; i++ {
		must(a.node.CreateBucket(ctx, fmt.Sprintf("bucket%02d", i), BucketEntry{Home: a.id()}))
	}
	for i := 0; i < 3; i++ {
		must(a.node.CreatePipeline(ctx, fmt.Sprintf("pipe%d", i), PipelineEntry{Definition: []byte(fmt.Sprintf(`{"name":"pipe%d"}`, i))}))
		must(a.node.PutKey(ctx, fmt.Sprintf("BVKKEY%04d", i), KeyEntry{Bucket: "bucket00"}))
	}
	must(a.node.DeleteBucket(ctx, "bucket39"))
	a.node.discover(ctx, true) // a learns that its own URL is itself
	fc.Advance(2 * time.Hour)
	must(a.node.Compact(ctx))
	if opCount(t, a.node) != 0 {
		t.Fatal("setup: the log should be empty")
	}
	if _, err := a.node.serveOps(ctx, map[string]int64{}, 100, "n_new", keyIDsOf(a.node), true); !errors.Is(err, errSnapshotRequired) {
		t.Fatalf("a node with no ops needs a snapshot: %v", err)
	}

	// the newcomer knows a's URL and pulls
	b := newTestNode(t, spec{name: "b", l: lb, urls: []string{ua, ub}, clock: fc, tune: tuningWithChunk(7)})
	var log changeLog
	b.node.OnChange(log.add)
	b.node.discover(ctx, true)
	b.node.pullAll(ctx)
	sameCatalog(t, "bootstrap", catalogOf(t, a.node), catalogOf(t, b.node))
	if got := len(catalogOf(t, b.node)); got != 39+3+3 { // the tombstone was purged on a
		t.Fatalf("%d registers", got)
	}
	if vvOf(t, b.node)[a.id()] != 47 {
		t.Fatalf("vv %v", vvOf(t, b.node))
	}
	floors := must(b.db.Read().CatalogFloors(ctx))
	if floors[a.id()] != 47 {
		t.Fatalf("the snapshot's ops are not held individually, so the floor must cover them: %v", floors)
	}
	if home, _, ok := b.node.Home("bucket05"); !ok || home != a.id() {
		t.Fatalf("Home after the snapshot: %q %v", home, ok)
	}
	eventually(t, 2*time.Second, "the subscribers to hear of the snapshot's registers", func() bool { return len(log.snapshot()) == 45 })
	// b cannot serve the old ops to somebody else: that one needs a snapshot too
	if _, err := b.node.serveOps(ctx, map[string]int64{}, 100, "n_new", keyIDsOf(b.node), true); !errors.Is(err, errSnapshotRequired) {
		t.Fatalf("%v", err)
	}
	// and the ordinary flow takes over
	op := must(a.node.CreateBucket(ctx, "after", BucketEntry{Home: a.id()}))
	b.node.pullAll(ctx)
	if _, ok := b.node.Bucket("after"); !ok || vvOf(t, b.node)[a.id()] != op.Seq {
		t.Fatalf("ops after the snapshot: %v", vvOf(t, b.node))
	}
}

// A tombstone that arrives in a snapshot is as young as its op: it must not be
// purged just because the snapshot's version vector covers it. Purging it early
// would let a stale node resurrect the deleted register.
func TestTombstoneFromASnapshotIsNotPurgedEarly(t *testing.T) {
	fc := newFakeClock()
	la, ua := listener(t)
	lb, ub := listener(t)
	ctx := ctxT()
	a := newTestNode(t, spec{name: "a", l: la, urls: []string{ua}, clock: fc, cfg: retention(time.Hour)})
	must(a.node.CreateBucket(ctx, "doomed", BucketEntry{Home: a.id()}))
	fc.Advance(2 * time.Hour)
	must(a.node.DeleteBucket(ctx, "doomed")) // young
	must(a.node.CreateBucket(ctx, "other", BucketEntry{Home: a.id()}))
	a.node.discover(ctx, true)
	must(a.node.Compact(ctx)) // removes the old create; the young ops stay
	// b has no peers, so no acknowledgement is missing: only the age of the tombstone
	// itself stands between it and the purge
	b := newTestNode(t, spec{name: "b", l: lb, urls: []string{ub}, clock: fc, cfg: retention(time.Hour)})
	mergeSnapshotDirect(t, b.node, snapshotBody(t, a.node))
	b.node.discover(ctx, true)
	if floors := must(b.db.Read().CatalogFloors(ctx)); floors[a.id()] != 3 {
		t.Fatalf("floors %v: the snapshot covers all 3 ops", floors)
	}
	if reg, err := b.node.Register(ctx, KindBucket, "doomed"); err != nil || !reg.Deleted {
		t.Fatalf("%+v %v", reg, err)
	}
	if res := must(b.node.Compact(ctx)); res.Tombstones != 0 {
		t.Fatalf("a young tombstone was purged because a snapshot covers it: %+v", res)
	}
	if tombstonesOf(t, b.node) != 1 {
		t.Fatal("tombstone gone")
	}
	// once it is old it goes
	fc.Advance(2 * time.Hour)
	if res := must(b.node.Compact(ctx)); res.Tombstones != 1 {
		t.Fatalf("%+v", res)
	}
	_ = ua
}

// Snapshots from a faulty peer are refused as a whole: a truncated stream, an
// invalid register, a register stamped past the clock guard. The version vector
// is only applied once every register is in.
func TestBadSnapshotsAreRefused(t *testing.T) {
	fc := newFakeClock()
	valid := `{"kind":"bucket","name":"photos","payload":{"home":"n_x","epoch":0,"generation":"x:1","created_at":1,"pipelines":[]},"hlc":%d,"origin":"x","seq":1}`
	good := fmt.Sprintf(valid, at(time.Second))
	cases := map[string]string{
		"truncated":        `{"node_id":"n_x","vv":{"x":5},"regs":[` + good + `,{"kind":"buck`,
		"no vector":        `{"node_id":"n_x","regs":[` + good + `]}`,
		"not an object":    `[1,2,3]`,
		"invalid register": `{"node_id":"n_x","vv":{"x":5},"regs":[{"kind":"bucket","name":"Bad Name","payload":{},"hlc":5,"origin":"x","seq":1}]}`,
		"deleted mismatch": `{"node_id":"n_x","vv":{"x":5},"regs":[{"kind":"bucket","name":"photos","deleted":true,"payload":{"home":"n_x","epoch":0,"generation":"x:1","created_at":1,"pipelines":[]},"hlc":5,"origin":"x","seq":1}]}`,
		"future":           fmt.Sprintf(`{"node_id":"n_x","vv":{"x":5},"regs":[`+valid+`]}`, at(time.Hour)),
		"bad vector":       `{"node_id":"n_x","vv":{"bad origin":5},"regs":[]}`,
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			tn := newTestNode(t, spec{bare: true, clock: fc})
			vv, _, err := tn.node.readSnapshot(ctxT(), bytes.NewReader([]byte(body)), "n_x")
			if err == nil {
				err = tn.node.finishSnapshot(ctxT(), vv)
			}
			if err == nil {
				t.Fatal("accepted")
			}
			if got := vvOf(t, tn.node); len(got) != 0 {
				t.Fatalf("the version vector was applied: %v", got)
			}
			if name == "future" {
				if !errors.Is(err, errFuture) {
					t.Fatalf("%v", err)
				}
				if h := tn.node.HeldOps(); len(h) != 1 || h[0].Reason != "clock" {
					t.Fatalf("%+v", h)
				}
			}
		})
	}
	// the good one on its own is fine
	tn := newTestNode(t, spec{bare: true, clock: fc})
	vv, n, err := tn.node.readSnapshot(ctxT(), strings.NewReader(`{"node_id":"n_x","vv":{"x":1},"regs":[`+good+`]}`), "n_x")
	if err != nil || n != 1 || vv["x"] != 1 {
		t.Fatalf("%v %d %v", err, n, vv)
	}
}

// Over HTTP: a peer that serves a snapshot that is cut short is not believed.
func TestTruncatedSnapshotOverHTTPLeavesTheVectorAlone(t *testing.T) {
	fc := newFakeClock()
	la, ua := listener(t)
	lb, ub := listener(t)
	ctx := ctxT()
	a := newTestNode(t, spec{name: "a", l: la, urls: []string{ua}, clock: fc, cfg: retention(time.Hour)})
	for i := 0; i < 20; i++ {
		must(a.node.CreateBucket(ctx, fmt.Sprintf("bucket%02d", i), BucketEntry{Home: a.id()}))
	}
	a.node.discover(ctx, true)
	fc.Advance(2 * time.Hour)
	must(a.node.Compact(ctx))
	if opCount(t, a.node) != 0 {
		t.Fatal("setup: the log should be empty")
	}
	good := snapshotBody(t, a.node)
	// a front that relays everything but cuts the snapshot in half
	front := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != PeerPrefix+"snapshot" {
			a.node.Handler().ServeHTTP(w, r)
			return
		}
		if !a.node.CheckPeerKey(r.Header.Get(HeaderPeerKey)) {
			w.WriteHeader(401)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(good[:len(good)/2])
	}))
	defer front.Close()
	b := newTestNode(t, spec{name: "b", l: lb, urls: []string{front.URL, ub}, clock: fc, tune: tuningWithChunk(4)})
	b.node.discover(ctx, true)
	b.node.pullAll(ctx)
	if got := vvOf(t, b.node); len(got) != 0 {
		t.Fatalf("the version vector must not move on a truncated snapshot: %v", got)
	}
	if p := b.node.Peers(); len(p) != 1 || p[0].Error == "" || !strings.Contains(p[0].Error, "snapshot") {
		t.Fatalf("%+v", p)
	}
}
