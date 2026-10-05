package cluster

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

// permutations returns every ordering of 0..n-1.
func permutations(n int) [][]int {
	var out [][]int
	var rec func(cur []int, used []bool)
	rec = func(cur []int, used []bool) {
		if len(cur) == n {
			out = append(out, append([]int(nil), cur...))
			return
		}
		for i := 0; i < n; i++ {
			if !used[i] {
				used[i] = true
				rec(append(cur, i), used)
				used[i] = false
			}
		}
	}
	rec(nil, make([]bool, n))
	return out
}

// single builds a lone node on a fake clock at testBase.
func single(t *testing.T) (*tnode, *fakeClock) {
	t.Helper()
	fc := newFakeClock()
	return newTestNode(t, spec{clock: fc}), fc
}

// The (hlc, origin) rule picks one winner whatever order the ops arrive in; a
// tie on hlc goes to the higher origin (spec §8.5).
func TestWinnerRuleAnyOrder(t *testing.T) {
	ops := []Op{
		bucketOp(t, "a", 1, at(10*time.Second), "photos", "n_a", "a:1", 0),
		bucketOp(t, "b", 1, at(10*time.Second), "photos", "n_b", "b:1", 0), // same hlc, higher origin: wins
		bucketOp(t, "c", 1, at(9*time.Second), "photos", "n_c", "c:1", 0),  // older
	}
	var want []regView
	for _, perm := range permutations(len(ops)) {
		tn, _ := single(t)
		for _, i := range perm {
			apply(t, tn.node, ops[i])
		}
		got := catalogOf(t, tn.node)
		if len(got) != 1 || got[0].Origin != "b" || got[0].Aux != "n_b" {
			t.Fatalf("order %v: winner %+v", perm, got)
		}
		if home, _, ok := tn.node.Home("photos"); !ok || home != "n_b" {
			t.Fatalf("order %v: Home = %q %v", perm, home, ok)
		}
		if want == nil {
			want = got
		}
		sameCatalog(t, "any order", got, want)
		// three writes that none of the authors had seen: two conflicts, whichever
		// order the node meets them in
		if c := tn.node.Conflicts(); len(c) != 2 {
			t.Fatalf("order %v: %d conflicts recorded, want 2: %+v", perm, len(c), c)
		}
	}
}

// Two writes that none of the authors had seen, of the same value, lose nothing whichever wins: no
// conflict is reported — the old and the new home of a moved bucket write the same hand-off. A
// different value written at the same time is one, as before.
func TestIdenticalConcurrentWritesAreNoConflict(t *testing.T) {
	same := []Op{
		bucketOp(t, "a", 1, at(10*time.Second), "photos", "n_b", "a:1", 1), // the old home's hand-off
		bucketOp(t, "b", 1, at(11*time.Second), "photos", "n_b", "a:1", 1), // the new home's
	}
	for _, perm := range permutations(len(same)) {
		tn, _ := single(t)
		for _, i := range perm {
			apply(t, tn.node, same[i])
		}
		if c := tn.node.Conflicts(); len(c) != 0 {
			t.Fatalf("order %v: two writes of the same value were reported as a conflict: %+v", perm, c)
		}
		if got := catalogOf(t, tn.node); len(got) != 1 || got[0].Origin != "b" {
			t.Fatalf("order %v: winner %+v", perm, got)
		}
	}
	// the same value, but one of them also names a pipeline: the entries differ, so this is one
	differ := []Op{
		bucketOp(t, "a", 1, at(10*time.Second), "photos", "n_b", "a:1", 1),
		bucketOp(t, "b", 1, at(11*time.Second), "photos", "n_b", "a:1", 1, "scan"),
	}
	for _, perm := range permutations(len(differ)) {
		tn, _ := single(t)
		for _, i := range perm {
			apply(t, tn.node, differ[i])
		}
		if c := tn.node.Conflicts(); len(c) != 1 {
			t.Fatalf("order %v: %d conflicts recorded for two different values, want 1: %+v", perm, len(c), c)
		}
	}
	// two admins deleting one bucket at once: the tombstones are the same value as well
	tn, _ := single(t)
	apply(t, tn.node, delOp("a", 1, at(10*time.Second), KindBucket, "photos"), delOp("b", 1, at(11*time.Second), KindBucket, "photos"))
	if c := tn.node.Conflicts(); len(c) != 0 {
		t.Fatalf("two tombstones were reported as a conflict: %+v", c)
	}
}

// A write that was made after seeing the other (its prev names it) is not a
// conflict, and neither is a cause that arrives after its effect.
func TestCausalChainIsNoConflict(t *testing.T) {
	first := bucketOp(t, "a", 1, at(time.Second), "photos", "n_a", "a:1", 0)
	second := bucketOp(t, "b", 1, at(2*time.Second), "photos", "n_a", "a:1", 0, "p1")
	second.Prev = "a:1"
	third := bucketOp(t, "a", 2, at(3*time.Second), "photos", "n_a", "a:1", 0, "p1", "p2")
	third.Prev = "b:1"
	chain := []Op{first, second, third}

	// every arrival order of the three, with each origin's ops in seq order. The
	// final state is the same in all of them; when a cause is applied before its
	// effect (b:1 before a:2) nothing is reported either. (An effect that arrives
	// before its cause cannot be told from a concurrent write by the prev field
	// alone, which only names one hop; that is why a batch is applied in HLC order.)
	for _, perm := range permutations(len(chain)) {
		var seq []Op
		for _, i := range perm {
			seq = append(seq, chain[i])
		}
		seq = orderPerOrigin(seq)
		tn, _ := single(t)
		causal, seenB := true, false
		for _, op := range seq {
			switch op.ID() {
			case "b:1":
				seenB = true
			case "a:2":
				causal = causal && seenB
			}
			apply(t, tn.node, op)
		}
		got := catalogOf(t, tn.node)
		if len(got) != 1 || got[0].Seq != 2 || got[0].Origin != "a" {
			t.Fatalf("order %v: %+v", perm, got)
		}
		if c := tn.node.Conflicts(); causal && len(c) != 0 {
			t.Fatalf("order %v: a causal chain was reported as a conflict: %+v", perm, c)
		}
	}
	// a batch that arrives effect-before-cause is applied in HLC order
	tn, _ := single(t)
	apply(t, tn.node, second, first)
	apply(t, tn.node, third)
	if c := tn.node.Conflicts(); len(c) != 0 {
		t.Fatalf("a batch delivered effect-before-cause was reported as a conflict: %+v", c)
	}
	// a longer chain across three origins delivered effect-first in ONE batch: the batch
	// is applied in HLC order, so each op is met after what it replaced
	c1 := bucketOp(t, "a", 1, at(time.Second), "chain", "n_a", "a:1", 0)
	c2 := bucketOp(t, "b", 1, at(2*time.Second), "chain", "n_a", "a:1", 0, "p1")
	c2.Prev = "a:1"
	c3 := bucketOp(t, "c", 1, at(3*time.Second), "chain", "n_a", "a:1", 0, "p1", "p2")
	c3.Prev = "b:1"
	tn3, _ := single(t)
	apply(t, tn3.node, c3, c2, c1)
	if c := tn3.node.Conflicts(); len(c) != 0 {
		t.Fatalf("a causal chain delivered in reverse within one batch was reported as a conflict: %+v", c)
	}
	if reg, _ := tn3.node.Register(ctxT(), KindBucket, "chain"); reg.OpID() != "c:1" {
		t.Fatalf("%+v", reg)
	}

	// two writes made without seeing each other are one
	rival := bucketOp(t, "c", 1, at(2500*time.Millisecond), "photos", "n_c", "c:1", 0)
	rival.Prev = "a:1"
	apply(t, tn.node, rival)
	c := tn.node.Conflicts()
	if len(c) != 1 || c[0].Register != "bucket/photos" || c[0].Winner != "a:2" || c[0].Loser != "c:1" {
		t.Fatalf("%+v", c)
	}
}

func TestApplyIsIdempotentAndWaitsAcrossGaps(t *testing.T) {
	tn, _ := single(t)
	o1 := bucketOp(t, "a", 1, at(1*time.Second), "one", "n_a", "a:1", 0)
	o2 := bucketOp(t, "a", 2, at(2*time.Second), "two", "n_a", "a:2", 0)
	o3 := bucketOp(t, "a", 3, at(3*time.Second), "three", "n_a", "a:3", 0)

	res := apply(t, tn.node, o1, o3) // o2 missing: o3 must wait
	if res.Applied != 1 || vvOf(t, tn.node)["a"] != 1 {
		t.Fatalf("applied across a gap: %+v vv %v", res, vvOf(t, tn.node))
	}
	if len(res.Held) != 0 {
		t.Fatalf("a gap is not a held op: %+v", res.Held)
	}
	res = apply(t, tn.node, o2, o3)
	if res.Applied != 2 || vvOf(t, tn.node)["a"] != 3 {
		t.Fatalf("after the gap closed: %+v vv %v", res, vvOf(t, tn.node))
	}
	before := catalogOf(t, tn.node)
	res = apply(t, tn.node, o1, o2, o3, o2)
	if res.Applied != 0 || res.Dups != 4 {
		t.Fatalf("applying twice must be a no-op: %+v", res)
	}
	sameCatalog(t, "idempotent", before, catalogOf(t, tn.node))
}

// Delete and re-create: whichever has the higher hlc wins, in every order.
func TestTombstonesAndRecreate(t *testing.T) {
	create := bucketOp(t, "a", 1, at(10*time.Second), "photos", "n_a", "a:1", 0)
	del := delOp("b", 1, at(20*time.Second), KindBucket, "photos")
	recreate := bucketOp(t, "a", 2, at(30*time.Second), "photos", "n_a", "a:2", 0)

	for _, tc := range []struct {
		name     string
		delAt    time.Duration
		wantLive bool
		wantGen  string
	}{
		{"recreate after the delete", 20 * time.Second, true, "a:2"},
		{"delete after the recreate", 40 * time.Second, false, ""},
	} {
		d := del
		d.HLC = at(tc.delAt)
		ops := []Op{create, d, recreate}
		for _, perm := range permutations(len(ops)) {
			tn, _ := single(t)
			// a's two ops must arrive in seq order
			var seq []Op
			for _, i := range perm {
				seq = append(seq, ops[i])
			}
			for _, op := range orderPerOrigin(seq) {
				apply(t, tn.node, op)
			}
			reg, err := tn.node.Register(ctxT(), KindBucket, "photos")
			if err != nil {
				t.Fatalf("%s %v: %v", tc.name, perm, err)
			}
			if reg.Deleted != !tc.wantLive {
				t.Fatalf("%s %v: deleted=%v", tc.name, perm, reg.Deleted)
			}
			if rec, ok := tn.node.Bucket("photos"); ok != tc.wantLive || (ok && rec.Generation != tc.wantGen) {
				t.Fatalf("%s %v: Bucket = %+v %v", tc.name, perm, rec, ok)
			}
		}
	}
}

// orderPerOrigin keeps the arrival order of ops of different origins but puts
// each origin's ops in seq order (a peer serves an origin in order).
func orderPerOrigin(ops []Op) []Op {
	byOrigin := map[string][]Op{}
	for _, op := range ops {
		byOrigin[op.Origin] = append(byOrigin[op.Origin], op)
	}
	for _, list := range byOrigin {
		for i := range list {
			for j := i + 1; j < len(list); j++ {
				if list[j].Seq < list[i].Seq {
					list[i], list[j] = list[j], list[i]
				}
			}
		}
	}
	next := map[string]int{}
	out := make([]Op, 0, len(ops))
	for _, op := range ops {
		out = append(out, byOrigin[op.Origin][next[op.Origin]])
		next[op.Origin]++
	}
	return out
}

func TestValidationRefusesMalformedOps(t *testing.T) {
	good := bucketOp(t, "y", 1, at(time.Second), "fine", "n_y", "y:1", 0)
	base := func() Op { return bucketOp(t, "x", 1, at(time.Second), "photos", "n_x", "x:1", 0) }
	cases := map[string]func(o *Op){
		"unknown kind":          func(o *Op) { o.Kind = "volume" },
		"bad bucket name":       func(o *Op) { o.Key = "Bad_Name" },
		"name with dots":        func(o *Op) { o.Key = "a..b" },
		"whitespace in payload": func(o *Op) { o.Payload = []byte(strings.Replace(string(o.Payload), `{"home"`, `{ "home"`, 1)) },
		"unknown field": func(o *Op) {
			o.Payload = []byte(`{"home":"n_x","epoch":0,"generation":"x:1","created_at":1,"pipelines":[],"admin":true}`)
		},
		"null pipelines": func(o *Op) {
			o.Payload = []byte(`{"home":"n_x","epoch":0,"generation":"x:1","created_at":1,"pipelines":null}`)
		},
		"trailing data": func(o *Op) { o.Payload = append(append([]byte(nil), o.Payload...), []byte(` {}`)...) },
		"negative epoch": func(o *Op) {
			o.Payload = []byte(`{"home":"n_x","epoch":-1,"generation":"x:1","created_at":1,"pipelines":[]}`)
		},
		"bad generation": func(o *Op) {
			o.Payload = []byte(`{"home":"n_x","epoch":0,"generation":"no spaces!","created_at":1,"pipelines":[]}`)
		},
		"empty generation": func(o *Op) {
			o.Payload = []byte(`{"home":"n_x","epoch":0,"generation":"","created_at":1,"pipelines":[]}`)
		},
		"home with a dot": func(o *Op) {
			o.Payload = []byte(`{"home":"n.x","epoch":0,"generation":"x:1","created_at":1,"pipelines":[]}`)
		},
		"duplicate pipelines": func(o *Op) {
			o.Payload = []byte(`{"home":"n_x","epoch":0,"generation":"x:1","created_at":1,"pipelines":["p","p"]}`)
		},
		"loose tombstone":      func(o *Op) { o.Payload = []byte(`{"deleted": true}`) },
		"zero protocol":        func(o *Op) { o.V = 0 },
		"zero hlc":             func(o *Op) { o.HLC = 0 },
		"bad prev":             func(o *Op) { o.Prev = "not an op id" },
		"empty payload":        func(o *Op) { o.Payload = nil },
		"bad key id":           func(o *Op) { o.Kind, o.Key, o.Payload = KindKey, "bad key!", []byte(`{"bucket":"photos"}`) },
		"key entry bad bucket": func(o *Op) { o.Kind, o.Key, o.Payload = KindKey, "BVKABC", []byte(`{"bucket":"NOPE"}`) },
		"duplicate json keys": func(o *Op) {
			o.Kind, o.Key, o.Payload = KindKey, "BVKABC", []byte(`{"bucket":"photos","bucket":"other"}`)
		},
		"pipeline without definition": func(o *Op) {
			o.Kind, o.Key, o.Payload = KindPipeline, "p1", []byte(`{"definition":null,"revision":1,"generation":"x:1"}`)
		},
		"pipeline definition not an object": func(o *Op) {
			o.Kind, o.Key, o.Payload = KindPipeline, "p1", []byte(`{"definition":[1],"revision":1,"generation":"x:1"}`)
		},
		"pipeline definition not canonical": func(o *Op) {
			o.Kind, o.Key, o.Payload = KindPipeline, "p1", []byte(`{"definition":{"b":1,"a":2},"revision":1,"generation":"x:1"}`)
		},
		"pipeline revision zero": func(o *Op) {
			o.Kind, o.Key, o.Payload = KindPipeline, "p1", []byte(`{"definition":{},"revision":0,"generation":"x:1"}`)
		},
		"sealed value too short": func(o *Op) {
			o.Kind, o.Key, o.Payload = KindPipeline, "p1", []byte(`{"definition":{},"revision":1,"generation":"x:1","sealed":{"headers":{"type":"t","id":"p1","value":"AAAA"}}}`)
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			tn, _ := single(t)
			bad := base()
			mutate(&bad)
			res := apply(t, tn.node, bad, good)
			if res.Applied != 1 {
				t.Fatalf("applied %d ops, want only the good one", res.Applied)
			}
			if vv := vvOf(t, tn.node); vv["x"] != 0 || vv["y"] != 1 {
				t.Fatalf("vv %v", vv)
			}
			if len(res.Held) != 1 || res.Held[0].Reason != "invalid" {
				t.Fatalf("held %+v, want one invalid op", res.Held)
			}
			held := tn.node.HeldOps()
			if len(held) != 1 || held[0].Reason != "invalid" || held[0].Direction != "in" {
				t.Fatalf("HeldOps %+v", held)
			}
			if _, ok := tn.node.Bucket("fine"); !ok {
				t.Fatal("the good op of the batch was not applied")
			}
		})
	}
}

// An op from a newer protocol is held (and alarmed) until the node is upgraded
// (spec §9.6); the origin's stream waits behind it.
func TestNewerProtocolIsHeld(t *testing.T) {
	tn, _ := single(t)
	future := bucketOp(t, "x", 1, at(time.Second), "photos", "n_x", "x:1", 0)
	future.V = ProtocolVersion + 1
	future.Payload = []byte(`{"anything":["a","newer","node","may","write"]}`)
	next := bucketOp(t, "x", 2, at(2*time.Second), "other", "n_x", "x:2", 0)
	res := apply(t, tn.node, future, next)
	if res.Applied != 0 || len(res.Held) != 1 || res.Held[0].Reason != "protocol" {
		t.Fatalf("%+v", res)
	}
	if vv := vvOf(t, tn.node); vv["x"] != 0 {
		t.Fatalf("vv %v: the stream must wait behind the held op", vv)
	}
}

func TestLocalWriteAPI(t *testing.T) {
	tn, _ := single(t)
	n := tn.node
	ctx := ctxT()

	op := must(n.CreateBucket(ctx, "photos", BucketEntry{Home: n.ID(), CreatedAt: 1234}))
	if op.Origin != n.ID() || op.Seq != 1 || op.Kind != KindBucket || op.Key != "photos" {
		t.Fatalf("op %+v", op)
	}
	rec, ok := n.Bucket("photos")
	if !ok || rec.Generation != op.ID() || rec.Home != n.ID() || rec.Epoch != 0 || len(rec.Pipelines) != 0 || rec.CreatedAt != 1234 {
		t.Fatalf("the generation of a bucket is the id of its create op: %+v %v", rec, ok)
	}
	if _, err := n.CreateBucket(ctx, "photos", BucketEntry{Home: n.ID(), Generation: "other"}); !errors.Is(err, ErrExists) {
		t.Fatalf("creating a live name: %v", err)
	}
	if vv := vvOf(t, n); vv[n.ID()] != 1 {
		t.Fatalf("a refused create must not use a sequence number: %v", vv)
	}

	// update: attachments; the generation cannot change
	up := must(n.UpdateBucket(ctx, "photos", func(cur BucketEntry) (BucketEntry, error) {
		cur.Pipelines = []string{"scan", "thumbs"}
		cur.Generation = "evil:9"
		return cur, nil
	}))
	if up.Prev != op.ID() {
		t.Fatalf("prev %q, want %q", up.Prev, op.ID())
	}
	rec, _ = n.Bucket("photos")
	if rec.Generation != op.ID() || !reflect.DeepEqual(rec.Pipelines, []string{"scan", "thumbs"}) {
		t.Fatalf("%+v", rec)
	}
	if _, err := n.UpdateBucket(ctx, "ghost", func(c BucketEntry) (BucketEntry, error) { return c, nil }); !errors.Is(err, ErrNotFound) {
		t.Fatalf("updating a missing bucket: %v", err)
	}
	if _, err := n.UpdateBucket(ctx, "photos", func(c BucketEntry) (BucketEntry, error) { return c, errors.New("no") }); err == nil {
		t.Fatal("an error from the update function must abort the write")
	}
	if _, err := n.UpdateBucket(ctx, "photos", func(c BucketEntry) (BucketEntry, error) { c.Pipelines = []string{"Bad Name"}; return c, nil }); !errors.Is(err, ErrInvalid) {
		t.Fatalf("an invalid entry: %v", err)
	}

	if got := n.AttachedTo("scan"); !reflect.DeepEqual(got, []string{"photos"}) {
		t.Fatalf("attached_to: %v", got)
	}
	if got := n.AttachedTo("nothing"); len(got) != 0 {
		t.Fatalf("%v", got)
	}

	// move hand-off: the home and the epoch change, the generation stays
	must(n.UpdateBucket(ctx, "photos", func(c BucketEntry) (BucketEntry, error) { c.Home, c.Epoch = "n_other", 1; return c, nil }))
	if home, epoch, ok := n.Home("photos"); !ok || home != "n_other" || epoch != 1 {
		t.Fatalf("Home %q %d %v", home, epoch, ok)
	}

	// delete, then re-create: a new generation, nothing of the old bucket
	del := must(n.DeleteBucket(ctx, "photos"))
	if _, _, ok := n.Home("photos"); ok {
		t.Fatal("a deleted bucket has no home")
	}
	op2 := must(n.CreateBucket(ctx, "photos", BucketEntry{Home: n.ID()}))
	rec, _ = n.Bucket("photos")
	if rec.Generation != op2.ID() || rec.Generation == op.ID() || op2.Prev != del.ID() || rec.Epoch != 0 {
		t.Fatalf("%+v prev %q", rec, op2.Prev)
	}
	list := must(n.ListBuckets(ctx, "", 10))
	if len(list) != 1 || list[0].Name != "photos" {
		t.Fatalf("%+v", list)
	}

	// a creator may bring its own generation (the application's, kept in its own table)
	own := must(n.CreateBucket(ctx, "ownbucket", BucketEntry{Home: n.ID(), Generation: "01J9Z4K0ABCDEFGHJKMNPQRSTV"}))
	if rec, _ := n.Bucket("ownbucket"); rec.Generation != "01J9Z4K0ABCDEFGHJKMNPQRSTV" || own.Seq == 0 {
		t.Fatalf("%+v", rec)
	}
	ownP := must(n.CreatePipeline(ctx, "ownpipe", PipelineEntry{Definition: []byte(`{}`), Generation: "01J9Z4K0PIPELINEGEN"}))
	if p, _ := n.Pipeline("ownpipe"); p.Generation != "01J9Z4K0PIPELINEGEN" || ownP.Seq == 0 {
		t.Fatalf("%+v", p)
	}
	must(n.DeleteBucket(ctx, "ownbucket"))
	must(n.DeletePipeline(ctx, "ownpipe"))

	// access-key index
	must(n.PutKey(ctx, "BVKAAAAAAAA", KeyEntry{Bucket: "photos"}))
	must(n.PutKey(ctx, "BVKBBBBBBBB", KeyEntry{Bucket: "photos"}))
	if b, ok := n.LookupKey("BVKAAAAAAAA"); !ok || b != "photos" {
		t.Fatalf("LookupKey %q %v", b, ok)
	}
	if keys := must(n.KeysOf(ctx, "photos")); len(keys) != 2 {
		t.Fatalf("%+v", keys)
	}
	must(n.DeleteKey(ctx, "BVKAAAAAAAA"))
	if _, ok := n.LookupKey("BVKAAAAAAAA"); ok {
		t.Fatal("deleted key still resolves")
	}
	if keys := must(n.KeysOf(ctx, "photos")); len(keys) != 1 || keys[0].AccessKeyID != "BVKBBBBBBBB" {
		t.Fatalf("%+v", keys)
	}
	if cnt := must(n.CountBucketsHomed(ctx, n.ID())); cnt != 1 {
		t.Fatalf("buckets homed here: %d", cnt)
	}

	// pipelines: generation, revision, sealed values stay inside
	pop := must(n.CreatePipeline(ctx, "scan", PipelineEntry{Definition: json.RawMessage(`{"stage":"before", "name":"scan"}`)}))
	p, ok := n.Pipeline("scan")
	if !ok || p.Revision != 1 || p.Generation != pop.ID() || string(p.Definition) != `{"name":"scan","stage":"before"}` {
		t.Fatalf("%+v %v (the definition is stored canonically)", p, ok)
	}
	if _, err := n.CreatePipeline(ctx, "scan", PipelineEntry{Definition: json.RawMessage(`{}`)}); !errors.Is(err, ErrExists) {
		t.Fatalf("%v", err)
	}
	must(n.UpdatePipeline(ctx, "scan", func(c PipelineEntry) (PipelineEntry, error) {
		c.Definition = json.RawMessage(`{"name":"scan","stage":"before","paused":true}`)
		return c, nil
	}))
	p, _ = n.Pipeline("scan")
	if p.Revision != 2 || p.Generation != pop.ID() {
		t.Fatalf("%+v", p)
	}
	must(n.DeletePipeline(ctx, "scan"))
	if _, ok := n.Pipeline("scan"); ok {
		t.Fatal("deleted pipeline")
	}
	if gen, live, exists := n.PipelineGeneration("scan"); gen != "" || live || !exists {
		t.Fatalf("a tombstone: %q %v %v", gen, live, exists)
	}
	if _, live, exists := n.PipelineGeneration("never"); live || exists {
		t.Fatal("no register at all")
	}
	pop2 := must(n.CreatePipeline(ctx, "scan", PipelineEntry{Definition: json.RawMessage(`{"name":"scan"}`)}))
	if gen, live, _ := n.PipelineGeneration("scan"); !live || gen != pop2.ID() || gen == pop.ID() {
		t.Fatalf("a re-created pipeline is a new pipeline: %q", gen)
	}
}

func TestBatchWriteIsAtomic(t *testing.T) {
	tn, _ := single(t)
	n := tn.node
	ctx := ctxT()
	must(n.CreateBucket(ctx, "photos", BucketEntry{Home: n.ID()}))
	must(n.PutKey(ctx, "BVKAAAAAAAA", KeyEntry{Bucket: "photos"}))
	// forced bucket delete: the bucket entry and its keys go together
	ops, err := n.Write(ctx, DeleteBucketDraft("photos"), DeleteKeyDraft("BVKAAAAAAAA"))
	if err != nil || len(ops) != 2 || ops[1].Seq != ops[0].Seq+1 {
		t.Fatalf("%+v %v", ops, err)
	}
	if _, ok := n.Bucket("photos"); ok {
		t.Fatal("bucket still there")
	}
	// a failing draft rolls the whole batch back, sequence numbers included
	before := vvOf(t, n)
	_, err = n.Write(ctx, PutKeyDraft("BVKCCCCCCCC", KeyEntry{Bucket: "photos"}), PutKeyDraft("bad key!", KeyEntry{Bucket: "photos"}))
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("%v", err)
	}
	if _, ok := n.LookupKey("BVKCCCCCCCC"); ok {
		t.Fatal("the first draft of a failed batch was applied")
	}
	if !reflect.DeepEqual(before, vvOf(t, n)) {
		t.Fatalf("vv moved: %v -> %v", before, vvOf(t, n))
	}
	// the same register twice in one batch sees its own earlier write
	ops, err = n.Write(ctx, CreateBucketDraft("again", BucketEntry{Home: n.ID()}), UpdateBucketDraft("again", func(c BucketEntry) (BucketEntry, error) {
		c.Pipelines = []string{"p"}
		return c, nil
	}))
	if err != nil || ops[1].Prev != ops[0].ID() {
		t.Fatalf("%+v %v", ops, err)
	}
}

// Writes are refused before the start-up fence ends, and after Stop.
func TestWriteNeedsReady(t *testing.T) {
	tn := newTestNode(t, spec{start: false})
	tn.node.ready.Store(false)
	if _, err := tn.node.CreateBucket(ctxT(), "photos", BucketEntry{Home: tn.id()}); !errors.Is(err, ErrNotReady) {
		t.Fatalf("%v", err)
	}
	tn.node.setReady()
	if _, err := tn.node.CreateBucket(ctxT(), "photos", BucketEntry{Home: tn.id()}); err != nil {
		t.Fatal(err)
	}
	tn.node.Stop()
	if _, err := tn.node.CreateBucket(ctxT(), "more", BucketEntry{Home: tn.id()}); !errors.Is(err, ErrStopped) {
		t.Fatalf("%v", err)
	}
}

// The in-memory bucket mirror never disagrees with the database, under
// concurrent local writes and replicated batches.
func TestBucketMirrorMatchesDatabase(t *testing.T) {
	tn, _ := single(t)
	n := tn.node
	ctx := ctxT()
	var wg sync.WaitGroup
	for g := 0; g < 4; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			for i := 0; i < 40; i++ {
				name := string(rune('a'+g)) + "bucket" + string(rune('a'+i%5))
				switch i % 4 {
				case 0, 1:
					_, _ = n.CreateBucket(ctx, name, BucketEntry{Home: n.ID()})
				case 2:
					_, _ = n.UpdateBucket(ctx, name, func(c BucketEntry) (BucketEntry, error) { c.Epoch++; return c, nil })
				case 3:
					_, _ = n.DeleteBucket(ctx, name)
				}
			}
		}(g)
	}
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := int64(1); i <= 60; i++ {
			name := "remote" + string(rune('a'+i%7))
			var op Op
			if i%5 == 0 {
				op = delOp("rem", i, at(time.Duration(i)*time.Millisecond), KindBucket, name)
			} else {
				op = bucketOp(t, "rem", i, at(time.Duration(i)*time.Millisecond), name, "n_rem", "rem:"+strconv.Itoa(1+int(i%9)), 0)
			}
			if _, err := n.applyRemote(ctx, []Op{op}, "test"); err != nil {
				t.Error(err)
				return
			}
		}
	}()
	wg.Wait()
	regs, err := n.db.Read().CatalogListRegs(ctx, KindBucket, "", 1000, false)
	if err != nil {
		t.Fatal(err)
	}
	live := map[string]bool{}
	for _, r := range regs {
		live[r.Name] = true
		rec, err := decodeBucket(&r)
		if err != nil {
			t.Fatal(err)
		}
		got, ok := n.Bucket(r.Name)
		if !ok || got.Home != rec.Home || got.Epoch != rec.Epoch || got.Generation != rec.Generation || got.OpID() != rec.OpID() {
			t.Fatalf("mirror of %s: %+v %v, database: %+v", r.Name, got, ok, rec)
		}
	}
	n.bm.mu.RLock()
	defer n.bm.mu.RUnlock()
	for name := range n.bm.m {
		if !live[name] {
			t.Fatalf("the mirror holds %s, the database does not", name)
		}
	}
}

func TestOrphansAndMissing(t *testing.T) {
	var local []LocalBucket
	var mu sync.Mutex
	fc := newFakeClock()
	tn := newTestNode(t, spec{clock: fc, local: func(context.Context) ([]LocalBucket, error) {
		mu.Lock()
		defer mu.Unlock()
		return append([]LocalBucket(nil), local...), nil
	}})
	n := tn.node
	ctx := ctxT()
	self := n.ID()
	// catalog: mine (home here), moved (home elsewhere, epoch 2), gone (tombstone), recreated (new generation)
	apply(t, n,
		bucketOp(t, "z", 1, at(1*time.Second), "mine", self, "z:1", 0),
		bucketOp(t, "z", 2, at(2*time.Second), "moved", "n_other", "z:2", 2),
		bucketOp(t, "z", 3, at(3*time.Second), "gone", self, "z:3", 0),
		delOp("z", 4, at(4*time.Second), KindBucket, "gone"),
		bucketOp(t, "z", 5, at(5*time.Second), "recreated", self, "z:5", 0),
		bucketOp(t, "z", 6, at(6*time.Second), "rival", "n_other", "z:6", 0), // lost a create race
		bucketOp(t, "z", 7, at(7*time.Second), "lost", self, "z:7", 0),       // homed here, no data
		bucketOp(t, "z", 8, at(8*time.Second), "stranded", "n_retired", "z:8", 0),
	)
	n.mu.Lock()
	n.retireLocked("n_retired", "test", fc.Now())
	n.mu.Unlock()
	mu.Lock()
	local = []LocalBucket{
		{Name: "mine", Generation: "z:1", Epoch: 0},        // fine
		{Name: "moved", Generation: "z:2", Epoch: 0},       // stale: the bucket moved on
		{Name: "gone", Generation: "z:3", Epoch: 0},        // dropped with catalog_only
		{Name: "recreated", Generation: "old:1", Epoch: 0}, // the name was re-created
		{Name: "rival", Generation: "mine:1", Epoch: 0},    // generation differs
		{Name: "unknown", Generation: "u:1", Epoch: 0},     // the catalog has no entry
	}
	mu.Unlock()
	orphans, err := n.OrphansOf(ctx, local)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]string{}
	for _, o := range orphans {
		got[o.Name] = o.Reason
	}
	want := map[string]string{"moved": "epoch", "gone": "deleted", "recreated": "generation", "rival": "generation", "unknown": "unknown"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("orphans %v, want %v", got, want)
	}
	// a local epoch above the catalog's is the new home of a move whose hand-off
	// op has not replicated yet: not an orphan
	if is, why, err := n.IsOrphan(ctx, LocalBucket{Name: "moved", Generation: "z:2", Epoch: 3}); err != nil || is {
		t.Fatalf("new home inside a move: %v %q %v", is, why, err)
	}
	// same epoch, other home: a concurrent create elsewhere won
	if is, why, _ := n.IsOrphan(ctx, LocalBucket{Name: "moved", Generation: "z:2", Epoch: 2}); !is || why != "other_home" {
		t.Fatalf("%v %q", is, why)
	}

	al, err := n.Alarms(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(al.Orphans) != len(want) {
		t.Fatalf("alarm orphans %+v", al.Orphans)
	}
	miss := map[string]string{}
	for _, m := range al.Missing {
		miss[m.Name] = m.Reason
	}
	// "recreated" is homed here and local data has another generation: no data for it
	// (moved and rival are homed on a node this cluster does not know)
	wantMissing := map[string]string{"recreated": "no_local_data", "lost": "no_local_data", "stranded": "retired_home", "moved": "unknown_home", "rival": "unknown_home"}
	if !reflect.DeepEqual(miss, wantMissing) {
		t.Fatalf("missing %v, want %v", miss, wantMissing)
	}
	if n.missingHere(ctx) != 2 {
		t.Fatalf("hello reports %d missing buckets here", n.missingHere(ctx))
	}
	if hi := n.hello(ctx); hi.Missing != 2 {
		t.Fatalf("%+v", hi)
	}
}

func TestClockGuardHoldsFutureOpsUntilTimeCatchesUp(t *testing.T) {
	tn, fc := single(t)
	n := tn.node
	skew := n.cfg.ClusterMaxClockSkew
	future := bucketOp(t, "x", 1, at(skew+10*time.Minute), "photos", "n_x", "x:1", 0)
	later := bucketOp(t, "x", 2, at(skew+10*time.Minute+time.Second), "other", "n_x", "x:2", 0)
	fine := bucketOp(t, "y", 1, at(time.Second), "fine", "n_y", "y:1", 0)

	res := apply(t, n, future, later, fine)
	if res.Applied != 1 || len(res.Held) != 1 || res.Held[0].Reason != "clock" || res.Held[0].Op != "x:1" {
		t.Fatalf("%+v", res)
	}
	if _, ok := n.Bucket("fine"); !ok {
		t.Fatal("another origin must not wait for a held one")
	}
	if _, ok := n.Bucket("photos"); ok {
		t.Fatal("the future op was applied")
	}
	if h := n.HeldOps(); len(h) != 1 || h[0].Origin != "x" {
		t.Fatalf("%+v", h)
	}
	// the local clock was not dragged into the future by the op it refused
	if last := n.clock.Last(); last.Physical().After(fc.Now().Add(time.Minute)) {
		t.Fatalf("the clock observed a held op: %s", last.Physical())
	}
	// time catches up: the same ops are applied, in order, and the alarm clears
	fc.Advance(11 * time.Minute)
	res = apply(t, n, future, later)
	if res.Applied != 2 || len(res.Held) != 0 {
		t.Fatalf("%+v", res)
	}
	if h := n.HeldOps(); len(h) != 0 {
		t.Fatalf("held ops after the clock caught up: %+v", h)
	}
	if _, ok := n.Bucket("other"); !ok {
		t.Fatal("the stream behind the held op was not applied")
	}
	// and a local write is stamped after everything seen
	op := must(n.CreateBucket(ctxT(), "mine", BucketEntry{Home: n.ID()}))
	if op.HLC <= later.HLC {
		t.Fatalf("a local op (%d) must order after every op seen (%d)", op.HLC, later.HLC)
	}
}

// A faulty peer cannot make a node allocate without bound: oversized payloads are
// refused, and the table of held streams is capped.
func TestHostilePeerCannotInflateTheNode(t *testing.T) {
	tn, _ := single(t)
	n := tn.node

	big := bucketOp(t, "x", 1, at(time.Second), "photos", "n_x", "x:1", 0)
	big.Payload = append([]byte(`{"home":"`), make([]byte, maxPayloadBytes+1)...)
	if res := apply(t, n, big); res.Applied != 0 || len(res.Held) != 1 || res.Held[0].Reason != "invalid" {
		t.Fatalf("an oversized payload: %+v", res)
	}

	// many origins, each with one bad op
	var ops []Op
	for i := 0; i < maxHeld+100; i++ {
		op := bucketOp(t, "ok", 1, at(time.Second), "photos", "n_x", "ok:1", 0)
		op.Origin = "hostile" + strconv.Itoa(i)
		op.Kind = "volume"
		ops = append(ops, op)
	}
	res := apply(t, n, ops...)
	if res.Applied != 0 {
		t.Fatalf("%+v", res)
	}
	if got := len(n.HeldOps()); got > maxHeld+1 {
		t.Fatalf("%d held streams recorded: the table must be capped at %d", got, maxHeld)
	}
	// a string of a megabyte as an origin is clipped in what is recorded
	huge := bucketOp(t, "x", 1, at(time.Second), "other", "n_x", "x:1", 0)
	huge.Origin = strings.Repeat("a", 1<<20)
	apply(t, n, huge)
	for _, h := range n.HeldOps() {
		if len(h.Op) > 100 || len(h.Origin) > 100 {
			t.Fatalf("an unclipped origin in the alarm: %d bytes", len(h.Op))
		}
	}
	if _, err := decodeVV(strings.Repeat("a:1,", maxSinceOrigins+1)); err == nil {
		t.Fatal("too many origins in since")
	}
}

// A pipeline's generation is the id of the op that created it: OpApplied says whether this node
// has seen that op, which is how a node tells a register that is behind from one that moved on.
func TestOpApplied(t *testing.T) {
	tn, _ := single(t)
	apply(t, tn.node,
		bucketOp(t, "a", 1, at(time.Second), "photos", "n_a", "a:1", 0),
		bucketOp(t, "a", 2, at(2*time.Second), "photos", "n_a", "a:1", 0, "p1"))
	for id, want := range map[string]bool{"a:1": true, "a:2": true, "a:3": false, "b:1": false} {
		if applied, known := tn.node.OpApplied(id); !known || applied != want {
			t.Fatalf("OpApplied(%q) = %v, %v; want %v, true", id, applied, known, want)
		}
	}
	for _, notAnOp := range []string{"", "gen-of-a-local-pipeline", "a:0", "a:x", ":3"} {
		if _, known := tn.node.OpApplied(notAnOp); known {
			t.Fatalf("%q was taken for an op id", notAnOp)
		}
	}
}
