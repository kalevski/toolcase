package cluster

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/seal"
)

func keyIDsOf(n *Node) map[seal.KeyID]bool {
	m := map[seal.KeyID]bool{}
	for _, id := range n.ring.IDs() {
		m[id] = true
	}
	return m
}

// pullDirect hands `to` what a pull from `from` would: the ops beyond to's version
// vector, page after page.
func pullDirect(t *testing.T, from, to *Node) {
	t.Helper()
	ctx := context.Background()
	for i := 0; i < 1000; i++ {
		resp, err := from.serveOps(ctx, vvOf(t, to), 100, to.ID(), keyIDsOf(to), true)
		if err != nil {
			t.Fatal(err)
		}
		if len(resp.Ops) == 0 {
			return
		}
		res := apply(t, to, resp.Ops...)
		if res.Applied == 0 && res.Dups == 0 {
			return
		}
	}
	t.Fatal("pullDirect did not settle")
}

// allOpsOf returns every op a node holds, per origin in seq order.
func allOpsOf(t *testing.T, n *Node) []Op {
	t.Helper()
	var out []Op
	for o := range vvOf(t, n) {
		rows, err := n.db.Read().CatalogOpRange(context.Background(), o, 0, 1<<30)
		if err != nil {
			t.Fatal(err)
		}
		for _, r := range rows {
			out = append(out, opFromMeta(r))
		}
	}
	return out
}

// interleave shuffles ops while keeping each origin's seq order (a peer always
// serves an origin in order), splits them into random batches and re-sends some
// already-delivered batches as duplicates (zonewright's test, adapted).
func interleave(rng *rand.Rand, ops []Op) [][]Op {
	byOrigin := map[string][]Op{}
	var origins []string
	for _, op := range ops {
		if _, ok := byOrigin[op.Origin]; !ok {
			origins = append(origins, op.Origin)
		}
		byOrigin[op.Origin] = append(byOrigin[op.Origin], op)
	}
	for _, list := range byOrigin {
		for i := range list { // seq order
			for j := i + 1; j < len(list); j++ {
				if list[j].Seq < list[i].Seq {
					list[i], list[j] = list[j], list[i]
				}
			}
		}
	}
	var seq []Op
	for {
		var live []string
		for _, o := range origins {
			if len(byOrigin[o]) > 0 {
				live = append(live, o)
			}
		}
		if len(live) == 0 {
			break
		}
		o := live[rng.IntN(len(live))]
		seq = append(seq, byOrigin[o][0])
		byOrigin[o] = byOrigin[o][1:]
	}
	var batches [][]Op
	for len(seq) > 0 {
		n := 1 + rng.IntN(min(len(seq), 8))
		batch := append([]Op(nil), seq[:n]...)
		if len(batches) > 0 && rng.IntN(3) == 0 {
			prev := batches[rng.IntN(len(batches))]
			batch = append(append([]Op(nil), prev...), batch...) // duplicates first
		}
		batches = append(batches, batch)
		seq = seq[n:]
	}
	return batches
}

var (
	propBuckets   = []string{"alpha", "bravo", "charlie", "delta"}
	propPipelines = []string{"scan", "thumbs", "gate"}
	propKeys      = []string{"BVKAAAAA", "BVKBBBBB", "BVKCCCCC", "BVKDDDDD", "BVKEEEEE"}
)

func pick(rng *rand.Rand, l []string) string { return l[rng.IntN(len(l))] }

// randomDraft makes a plausible catalog change against what the node sees now:
// bucket creates, hand-offs (home and epoch change), attachment changes and
// deletes; pipeline create/update/delete; key put/delete.
func randomDraft(rng *rand.Rand, n *Node, nodeIDs []string) Draft {
	switch rng.IntN(5) {
	case 0, 1: // bucket
		name := pick(rng, propBuckets)
		if _, live := n.Bucket(name); !live {
			return CreateBucketDraft(name, BucketEntry{Home: pick(rng, nodeIDs), CreatedAt: rng.Int64N(1_000_000)})
		}
		switch rng.IntN(5) {
		case 0:
			return DeleteBucketDraft(name)
		case 1: // a move's hand-off
			home := pick(rng, nodeIDs)
			return UpdateBucketDraft(name, func(c BucketEntry) (BucketEntry, error) { c.Home, c.Epoch = home, c.Epoch+1; return c, nil })
		default: // the home attaches pipelines
			var set []string
			for _, p := range propPipelines {
				if rng.IntN(2) == 0 {
					set = append(set, p)
				}
			}
			return UpdateBucketDraft(name, func(c BucketEntry) (BucketEntry, error) { c.Pipelines = set; return c, nil })
		}
	case 2, 3: // pipeline
		name := pick(rng, propPipelines)
		def := json.RawMessage(fmt.Sprintf(`{"name":%q,"timeout":"%ds"}`, name, 1+rng.IntN(30)))
		if _, live := n.Pipeline(name); !live {
			return CreatePipelineDraft(name, PipelineEntry{Definition: def})
		}
		if rng.IntN(4) == 0 {
			return DeletePipelineDraft(name)
		}
		return UpdatePipelineDraft(name, func(c PipelineEntry) (PipelineEntry, error) { c.Definition = def; return c, nil })
	default: // key
		id := pick(rng, propKeys)
		if rng.IntN(3) == 0 {
			return DeleteKeyDraft(id)
		}
		return PutKeyDraft(id, KeyEntry{Bucket: pick(rng, propBuckets)})
	}
}

// snapshotBody asks a node for its snapshot through the real handler.
func snapshotBody(t *testing.T, n *Node) []byte {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, PeerPrefix+"snapshot", nil)
	req.Header.Set(HeaderKeyIDs, joinIDs(n.keyIDStrings()))
	rec := httptest.NewRecorder()
	n.handleSnapshot(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("snapshot: %d %s", rec.Code, rec.Body.String())
	}
	return rec.Body.Bytes()
}

// mergeSnapshotDirect merges a snapshot body the way the pull loop does.
func mergeSnapshotDirect(t *testing.T, n *Node, body []byte) {
	t.Helper()
	vv, _, err := n.readSnapshot(context.Background(), bytes.NewReader(body), "test")
	if err != nil {
		t.Fatal(err)
	}
	if err := n.finishSnapshot(context.Background(), vv); err != nil {
		t.Fatal(err)
	}
}

// The core guarantee (spec §8.5, §12): ops from 2-4 origins, delivered in any
// order, in any batches, with duplicates, give identical catalogs on every node —
// with hand-offs, tombstones, re-creations, and a stale snapshot merged first.
func TestConvergenceProperty(t *testing.T) {
	rounds := 10
	if testing.Short() {
		rounds = 4
	}
	for round := 0; round < rounds; round++ {
		rng := rand.New(rand.NewPCG(uint64(round)+1, 7))
		count := 2 + rng.IntN(3)
		nodes := make([]*tnode, count)
		var ids []string
		for i := range nodes {
			nodes[i] = newTestNode(t, spec{bare: true, name: fmt.Sprintf("p%d", i)})
			ids = append(ids, nodes[i].id())
		}
		var stale []byte
		for step := 0; step < 60; step++ {
			n := nodes[rng.IntN(len(nodes))]
			if _, err := n.node.Write(ctxT(), randomDraft(rng, n.node, ids)); err != nil &&
				!errors.Is(err, ErrExists) && !errors.Is(err, ErrNotFound) {
				t.Fatalf("round %d: %v", round, err)
			}
			if rng.IntN(5) == 0 { // a partial sync creates causal chains across origins
				pullDirect(t, nodes[rng.IntN(len(nodes))].node, nodes[rng.IntN(len(nodes))].node)
			}
			if step == 30 {
				stale = snapshotBody(t, nodes[rng.IntN(len(nodes))].node)
			}
		}
		// the originals, fully synced, agree
		for pass := 0; pass < 2; pass++ {
			for i := range nodes {
				for j := range nodes {
					pullDirect(t, nodes[i].node, nodes[j].node)
				}
			}
		}
		want := catalogOf(t, nodes[0].node)
		wantVV := vvOf(t, nodes[0].node)
		for i, n := range nodes {
			sameCatalog(t, fmt.Sprintf("round %d: node %d after a full sync", round, i), want, catalogOf(t, n.node))
			if !reflect.DeepEqual(wantVV, vvOf(t, n.node)) {
				t.Fatalf("round %d: version vectors differ: %v vs %v", round, wantVV, vvOf(t, n.node))
			}
			// the bucket mirror agrees with the registers
			for _, r := range want {
				if r.Key[:7] != "bucket/" {
					continue
				}
				_, _, ok := n.node.Home(r.Key[7:])
				if ok == r.Deleted {
					t.Fatalf("round %d: mirror of %s says live=%v, register deleted=%v", round, r.Key, ok, r.Deleted)
				}
			}
		}
		// everything any node ever wrote, replayed in random orders into fresh nodes
		var ops []Op
		seen := map[string]bool{}
		for _, n := range nodes {
			for _, op := range allOpsOf(t, n.node) {
				if !seen[op.ID()] {
					seen[op.ID()] = true
					ops = append(ops, op)
				}
			}
		}
		// trials 0-2 replay the ops alone; 3-5 also merge the snapshot taken half-way
		// through the history, first, in the middle and last: merged, never swapped in,
		// so the newer state wins in every case
		for trial := 0; trial < 6; trial++ {
			fresh := newTestNode(t, spec{bare: true})
			batches := interleave(rng, ops)
			at := -1
			if trial >= 3 && stale != nil {
				at = []int{0, len(batches) / 2, len(batches)}[trial-3]
			}
			for i, batch := range batches {
				if i == at {
					mergeSnapshotDirect(t, fresh.node, stale)
				}
				apply(t, fresh.node, batch...)
			}
			if at == len(batches) {
				mergeSnapshotDirect(t, fresh.node, stale)
			}
			sameCatalog(t, fmt.Sprintf("round %d trial %d (%d ops, snapshot at %d)", round, trial, len(ops), at), want, catalogOf(t, fresh.node))
		}
	}
}

// A move's hand-off op (the old home's write) can reach a node after the new
// home's first op for the bucket. The (hlc, origin) rule alone decides which one
// stands, identically everywhere, whatever the arrival order (spec §8.5, §12).
func TestHandoffArrivingAfterNewHomeOps(t *testing.T) {
	for _, handoffFirst := range []bool{true, false} {
		t.Run(fmt.Sprintf("handoff_written_first=%v", handoffFirst), func(t *testing.T) {
			fc := newFakeClock()
			mk := func(name string) *tnode { return newTestNode(t, spec{bare: true, clock: fc, name: name}) }
			a, b := mk("old-home"), mk("new-home")
			ctx := ctxT()

			create := must(a.node.CreateBucket(ctx, "photos", BucketEntry{Home: a.id()}))
			pullDirect(t, a.node, b.node)
			fc.Advance(time.Second)

			// A (the old home) records the hand-off; B (the new home, activated over the
			// move protocol, which the catalog does not carry) attaches a pipeline. Neither
			// has seen the other's write.
			handoff := func() Op {
				return must(a.node.UpdateBucket(ctx, "photos", func(c BucketEntry) (BucketEntry, error) { c.Home, c.Epoch = b.id(), 1; return c, nil }))
			}
			firstOfNewHome := func() Op {
				return must(b.node.UpdateBucket(ctx, "photos", func(c BucketEntry) (BucketEntry, error) {
					c.Home, c.Epoch, c.Pipelines = b.id(), 1, []string{"scan"}
					return c, nil
				}))
			}
			var h, f Op
			if handoffFirst {
				h = handoff()
				fc.Advance(time.Second)
				f = firstOfNewHome()
			} else {
				f = firstOfNewHome()
				fc.Advance(time.Second)
				h = handoff()
			}
			winner := f
			if h.HLC > f.HLC {
				winner = h
			}

			// third nodes that know the create and then receive the two writes in either order
			var thirds []*tnode
			for i, order := range [][]Op{{h, f}, {f, h}, {f, h}} {
				c := mk(fmt.Sprintf("third%d", i))
				apply(t, c.node, create)
				for _, op := range order {
					apply(t, c.node, op)
				}
				thirds = append(thirds, c)
			}
			pullDirect(t, a.node, b.node)
			pullDirect(t, b.node, a.node)
			all := append([]*tnode{a, b}, thirds...)
			want := catalogOf(t, a.node)
			for i, n := range all {
				sameCatalog(t, fmt.Sprintf("node %d", i), want, catalogOf(t, n.node))
				reg, _ := n.node.Register(ctx, KindBucket, "photos")
				if reg.OpID() != winner.ID() {
					t.Fatalf("node %d: bucket entry written by %s, want %s (the higher hlc)", i, reg.OpID(), winner.ID())
				}
				if home, epoch, ok := n.node.Home("photos"); !ok || home != b.id() || epoch != 1 {
					t.Fatalf("node %d: Home %q %d %v", i, home, epoch, ok)
				}
			}
			// both writes replaced the create without seeing each other: a conflict, once
			if c := thirds[0].node.Conflicts(); len(c) != 1 || c[0].Winner != winner.ID() {
				t.Fatalf("conflicts %+v", c)
			}
		})
	}
}
