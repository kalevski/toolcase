package cluster

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/seal"
)

const sealHeaders = "pipeline-headers"

func sealedEntry(t testing.TB, ring *seal.Keyring, name, secret string) PipelineEntry {
	t.Helper()
	sv, err := ring.Seal(sealHeaders, name, []byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	return PipelineEntry{
		Definition: []byte(`{"name":"` + name + `","stage":"after"}`),
		Sealed:     map[string]SealedValue{"headers": {Type: sealHeaders, ID: name, Value: sv}},
	}
}

// An op carrying a value sealed under a master key goes only to a peer that can
// open that key; otherwise it is held (not skipped) and alarmed until the peer has
// the key (spec §4.7, §8.3). The origin's stream waits behind it; other origins
// are not affected.
func TestOpsSealedUnderAKeyThePeerLacksAreHeld(t *testing.T) {
	ring21, ring1 := ringOf(t, 2, 1), ringOf(t, 1)
	la, ua := listener(t)
	lb, ub := listener(t)
	urls := []string{ua, ub}
	ctx := ctxT()
	a := newTestNode(t, spec{name: "a", l: la, urls: urls, ring: ring21})
	b := newTestNode(t, spec{name: "b", l: lb, urls: urls, ring: ring1})

	sealedOp := must(a.node.CreatePipeline(ctx, "scan", sealedEntry(t, ring21, "scan", "token-for-scan")))
	must(a.node.CreatePipeline(ctx, "plain", PipelineEntry{Definition: []byte(`{"name":"plain"}`)}))
	must(b.node.CreateBucket(ctx, "bucket-b", BucketEntry{Home: b.id()}))
	settle(a, b)

	if _, ok := b.node.Pipeline("scan"); ok {
		t.Fatal("a value sealed under a key b does not have was sent to b")
	}
	if _, ok := b.node.Pipeline("plain"); ok {
		t.Fatal("the stream must wait behind the held op, not skip it")
	}
	if _, ok := a.node.Bucket("bucket-b"); !ok {
		t.Fatal("another origin must not be held up")
	}
	held := a.node.HeldOps()
	if len(held) != 1 || held[0].Direction != "out" || held[0].Reason != "sealed" || held[0].Op != sealedOp.ID() || held[0].Peer != b.id() {
		t.Fatalf("held %+v", held)
	}
	// the receiver is told what the sender holds back from it
	if bh := b.node.HeldOps(); len(bh) != 1 || bh[0].Direction != "withheld" || bh[0].Peer != a.id() || bh[0].Op != sealedOp.ID() {
		t.Fatalf("%+v", bh)
	}
	if al := must(a.node.Alarms(ctx)); len(al.HeldOps) != 1 {
		t.Fatalf("%+v", al)
	}
	if peers := b.node.Peers(); len(peers) != 1 || peers[0].Lag != 2 {
		t.Fatalf("b is two ops behind a, and says so: %+v", peers)
	}
	// the mismatch is visible too: b cannot open a key a seals under
	if m := b.node.Mismatches(); len(m) != 1 || m[0].Setting != "master_key_ids" {
		t.Fatalf("%+v", m)
	}

	// the key reaches b (restart with the new key in its ring)
	addr := lb.Addr().String()
	b.close()
	b2 := newTestNode(t, spec{name: "b", dir: b.dir, l: rebind(t, addr), urls: urls, ring: ring21})
	settle(a, b2)
	p, ok := b2.node.Pipeline("scan")
	if !ok {
		t.Fatal("the held op was never delivered")
	}
	if _, ok := b2.node.Pipeline("plain"); !ok {
		t.Fatal("the ops behind the held one were not delivered")
	}
	// the value arrived still sealed, and opens for the record it was sealed for
	sv := p.Sealed["headers"]
	got, err := ring21.Open(sv.Type, sv.ID, sv.Value)
	if err != nil || string(got) != "token-for-scan" {
		t.Fatalf("%q %v", got, err)
	}
	if h := a.node.HeldOps(); len(h) != 0 {
		t.Fatalf("the alarm must clear once the peer can open the key: %+v", h)
	}
	if h := b2.node.HeldOps(); len(h) != 0 {
		t.Fatalf("%+v", h)
	}
	if m := b2.node.Mismatches(); len(m) != 0 {
		t.Fatalf("%+v", m)
	}
}

// A caller that did not say which keys it opens is assumed to open none.
func TestOpsAreWithheldFromACallerWithoutKeyIDs(t *testing.T) {
	ring := ringOf(t, 1)
	tn := newTestNode(t, spec{ring: ring})
	must(tn.node.CreatePipeline(ctxT(), "scan", sealedEntry(t, ring, "scan", "x")))
	must(tn.node.CreatePipeline(ctxT(), "plain", PipelineEntry{Definition: []byte(`{"name":"plain"}`)}))
	resp, err := tn.node.serveOps(ctxT(), map[string]int64{}, 100, "n_x", nil, false)
	if err != nil || len(resp.Ops) != 0 || len(resp.Held) != 1 {
		t.Fatalf("%+v %v", resp, err)
	}
	resp, err = tn.node.serveOps(ctxT(), map[string]int64{}, 100, "n_x", keyIDsOf(tn.node), true)
	if err != nil || len(resp.Ops) != 2 || len(resp.Held) != 0 {
		t.Fatalf("%+v %v", resp, err)
	}
	// over HTTP the header decides, then the last hello, then nothing
	key := map[string]string{HeaderPeerKey: testKey}
	_, body := do(t, "GET", tn.url+PeerPrefix+"ops?since=", key)
	var r opsResponse
	_ = json.Unmarshal([]byte(body), &r)
	if len(r.Ops) != 0 || len(r.Held) != 1 {
		t.Fatalf("%s", body)
	}
	key[HeaderKeyIDs] = joinIDs(tn.node.keyIDStrings())
	_, body = do(t, "GET", tn.url+PeerPrefix+"ops?since=", key)
	r = opsResponse{}
	_ = json.Unmarshal([]byte(body), &r)
	if len(r.Ops) != 2 {
		t.Fatalf("%s", body)
	}
	key[HeaderKeyIDs] = "zz"
	_, body = do(t, "GET", tn.url+PeerPrefix+"ops?since=", key)
	r = opsResponse{}
	_ = json.Unmarshal([]byte(body), &r)
	if len(r.Ops) != 0 {
		t.Fatalf("a malformed key id header must not open anything: %s", body)
	}
}

// The receiver checks too: it does not trust the sender to have filtered.
func TestReceiverHoldsOpsItCannotOpen(t *testing.T) {
	ring3 := ringOf(t, 3)
	entry := sealedEntry(t, ring3, "scan", "secret")
	op := Op{Origin: "x", Seq: 1, HLC: at(time.Second), V: 1, Kind: KindPipeline, Key: "scan"}
	op.Payload = canon(t, KindPipeline, PipelineEntry{Definition: entry.Definition, Revision: 1, Generation: "x:1", Sealed: entry.Sealed})
	next := pipelineOp(t, "x", 2, at(2*time.Second), "plain", "x:2", 1, nil)

	fc := newFakeClock()
	without := newTestNode(t, spec{bare: true, clock: fc, ring: ringOf(t, 1)})
	res := apply(t, without.node, op, next)
	if res.Applied != 0 || len(res.Held) != 1 || res.Held[0].Reason != "sealed" || !strings.Contains(res.Held[0].Detail, "master key") {
		t.Fatalf("%+v", res)
	}
	if vv := vvOf(t, without.node); vv["x"] != 0 {
		t.Fatalf("the op was skipped: %v", vv)
	}
	// a node that has the key takes it, and the stream behind it
	with := newTestNode(t, spec{bare: true, clock: fc, ring: ringOf(t, 3, 1)})
	if res := apply(t, with.node, op, next); res.Applied != 2 || len(res.Held) != 0 {
		t.Fatalf("%+v", res)
	}
	// a node with no ring at all opens nothing
	none := newTestNode(t, spec{bare: true, clock: fc})
	none.node.ring = nil
	if res := apply(t, none.node, op); res.Applied != 0 || len(res.Held) != 1 {
		t.Fatalf("%+v", res)
	}
}

// binvault validate and rekey reach the sealed values inside the catalog: the live
// registers and the ops still in the log (spec §4.7).
func TestCheckSealedAndRekeyCatalog(t *testing.T) {
	ring1 := ringOf(t, 1)
	tn := newTestNode(t, spec{ring: ring1})
	n := tn.node
	ctx := ctxT()
	must(n.CreatePipeline(ctx, "scan", sealedEntry(t, ring1, "scan", "first")))
	must(n.UpdatePipeline(ctx, "scan", func(c PipelineEntry) (PipelineEntry, error) {
		c.Sealed = sealedEntry(t, ring1, "scan", "second").Sealed
		return c, nil
	}))
	must(n.CreatePipeline(ctx, "thumbs", sealedEntry(t, ring1, "thumbs", "third")))
	must(n.CreatePipeline(ctx, "plain", PipelineEntry{Definition: []byte(`{"name":"plain"}`)}))
	must(n.DeletePipeline(ctx, "plain"))

	ring21, ring2, ring3 := ringOf(t, 2, 1), ringOf(t, 2), ringOf(t, 3)
	problems, checked, err := CheckSealed(ctx, tn.db, ring21)
	if err != nil || len(problems) != 0 || checked != 5 { // 2 registers + 3 ops carrying a value
		t.Fatalf("%v %d %v", problems, checked, err)
	}
	problems, _, err = CheckSealed(ctx, tn.db, ring3)
	if err != nil || len(problems) != 5 || !strings.Contains(problems[0], "catalog") {
		t.Fatalf("%v %v", problems, err)
	}
	if problems, _, _ := CheckSealed(ctx, tn.db, ring2); len(problems) != 5 {
		t.Fatalf("the new key alone opens nothing sealed under the old one: %v", problems)
	}

	// rekey under the rotation ring: all of it is re-sealed, in one transaction
	var changed int
	if err := tn.db.Update(ctx, func(tx *meta.Tx) (err error) { changed, err = RekeyCatalog(ctx, tx, ring21); return }); err != nil {
		t.Fatal(err)
	}
	if changed != 3 { // three distinct ciphertexts, each in an op and in a register or only in an op
		t.Fatalf("re-sealed %d values", changed)
	}
	// now the old key can go
	problems, checked, err = CheckSealed(ctx, tn.db, ring2)
	if err != nil || len(problems) != 0 || checked != 5 {
		t.Fatalf("%v %d %v", problems, checked, err)
	}
	// a register and the op that wrote it stay byte-identical, and still canonical
	for _, tc := range []struct{ name, op string }{{"scan", "update"}, {"thumbs", "create"}} {
		reg := must(n.Register(ctx, KindPipeline, tc.name))
		o := must(n.db.Read().CatalogGetOp(ctx, reg.Origin, reg.Seq))
		if !bytes.Equal(reg.Value, o.Payload) {
			t.Fatalf("%s: register and op diverged after rekey", tc.name)
		}
		if err := validateBody(KindPipeline, tc.name, reg.Prev, reg.Value); err != nil {
			t.Fatalf("%s: %v", tc.name, err)
		}
		var e PipelineEntry
		_ = json.Unmarshal(reg.Value, &e)
		kid, _ := seal.SealedKeyID(e.Sealed["headers"].Value)
		if kid != ring2.CurrentID() {
			t.Fatalf("%s: sealed under %s, want %s", tc.name, kid, ring2.CurrentID())
		}
	}
	// nothing left to do
	if err := tn.db.Update(ctx, func(tx *meta.Tx) (err error) { changed, err = RekeyCatalog(ctx, tx, ring2); return }); err != nil || changed != 0 {
		t.Fatalf("%d %v", changed, err)
	}

	// a value that cannot be opened fails the call and nothing is replaced
	snapshot := catalogOf(t, n)
	err = tn.db.Update(ctx, func(tx *meta.Tx) (err error) { _, err = RekeyCatalog(ctx, tx, ring3); return })
	if err == nil {
		t.Fatal("rekey with a ring that cannot open the values must fail")
	}
	sameCatalog(t, "after a failed rekey", snapshot, catalogOf(t, n))
}

// A snapshot is refused (before it is streamed) to a node that cannot open one of
// the sealed values in it: it would have to refuse the whole snapshot anyway.
func TestSnapshotIsHeldBackFromANodeWithoutTheKey(t *testing.T) {
	fc := newFakeClock()
	ring21, ring1 := ringOf(t, 2, 1), ringOf(t, 1)
	la, ua := listener(t)
	lb, ub := listener(t)
	lc, uc := listener(t)
	ctx := ctxT()
	a := newTestNode(t, spec{name: "a", l: la, urls: []string{ua}, clock: fc, ring: ring21, cfg: retention(time.Hour)})
	must(a.node.CreateBucket(ctx, "photos", BucketEntry{Home: a.id()}))
	must(a.node.CreatePipeline(ctx, "scan", sealedEntry(t, ring21, "scan", "secret")))
	a.node.discover(ctx, true)
	fc.Advance(2 * time.Hour)
	must(a.node.Compact(ctx)) // a new node can only bootstrap from a snapshot now

	b := newTestNode(t, spec{name: "b", l: lb, urls: []string{ua, ub}, clock: fc, ring: ring1})
	b.node.discover(ctx, true)
	b.node.pullAll(ctx)
	if got := vvOf(t, b.node); len(got) != 0 {
		t.Fatalf("a snapshot b cannot open was applied: %v", got)
	}
	if _, ok := b.node.Bucket("photos"); ok {
		t.Fatal("nothing of a refused snapshot may be merged")
	}
	if p := b.node.Peers(); len(p) != 1 || !strings.Contains(p[0].Error, "409") || !strings.Contains(p[0].Error, "master key") {
		t.Fatalf("the refusal must be visible: %+v", p)
	}
	// with the key it bootstraps
	c := newTestNode(t, spec{name: "c", l: lc, urls: []string{ua, uc}, clock: fc, ring: ring21})
	c.node.discover(ctx, true)
	c.node.pullAll(ctx)
	if _, ok := c.node.Bucket("photos"); !ok || vvOf(t, c.node)[a.id()] != 2 {
		t.Fatalf("%v", vvOf(t, c.node))
	}
	if p, ok := c.node.Pipeline("scan"); !ok || p.Sealed["headers"].ID != "scan" {
		t.Fatalf("%+v", p)
	}
}
