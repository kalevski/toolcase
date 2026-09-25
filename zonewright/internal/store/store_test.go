package store

import (
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/hlc"
)

var t0 = time.Date(2026, 9, 25, 12, 0, 0, 0, time.UTC)

func open(t *testing.T) *Store {
	t.Helper()
	now := t0
	s, err := Open(filepath.Join(t.TempDir(), "zw.db"), func() time.Time { now = now.Add(time.Millisecond); return now })
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func a(name, ip string) config.Record { return config.Record{Name: name, Type: "A", Value: ip} }

func mustWrite(t *testing.T, s *Store, drafts ...Draft) []Op {
	t.Helper()
	ops, err := s.LocalWrite(drafts)
	if err != nil {
		t.Fatal(err)
	}
	return ops
}

func createZone(zone string, recs ...config.Record) []Draft {
	d := []Draft{{Kind: KindZoneCreate, Zone: zone, Payload: CreatePayload{}}}
	for _, r := range recs {
		d = append(d, Draft{Kind: KindRRset, Zone: zone, Generation: NewGeneration, Name: r.Name, Type: r.Type, Payload: RRsetPayload{Records: []config.Record{r}}})
	}
	return d
}

func allOps(t *testing.T, s *Store) []Op {
	t.Helper()
	ops, _, err := s.OpsSince(map[string]int64{}, 1<<30)
	if err != nil {
		t.Fatal(err)
	}
	return ops
}

func pull(t *testing.T, from, to *Store) {
	t.Helper()
	vv, _ := to.VV()
	ops, _, err := from.OpsSince(vv, 1<<30)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := to.ApplyRemote(ops, time.Hour, nil); err != nil {
		t.Fatal(err)
	}
}

func zonesOf(t *testing.T, s *Store) []Zone {
	t.Helper()
	z, err := s.Zones()
	if err != nil {
		t.Fatal(err)
	}
	return z
}

func TestLocalWriteAndView(t *testing.T) {
	s := open(t)
	mustWrite(t, s, createZone("example.com", a("www", "192.0.2.1"), a("@", "192.0.2.2"))...)
	z, ok, err := s.Zone("example.com")
	if err != nil || !ok {
		t.Fatal(ok, err)
	}
	if z.Serial != 2026092503 { // base 2026092500 + 3 ops
		t.Errorf("serial %d", z.Serial)
	}
	if len(z.Records) != 2 || z.Records[0].Name != "@" {
		t.Errorf("records (apex first): %+v", z.Records)
	}
	// Delete the RRset (tombstone) → gone from the view, serial still rises.
	mustWrite(t, s, Draft{Kind: KindRRset, Zone: "example.com", Generation: z.Generation, Name: "www", Type: "A", Payload: RRsetPayload{Deleted: true}})
	z, _, _ = s.Zone("example.com")
	if len(z.Records) != 1 || z.Serial != 2026092504 {
		t.Errorf("after delete: %+v", z)
	}
}

func TestNodeIDStableAndUnique(t *testing.T) {
	dir := t.TempDir()
	s1, _ := Open(filepath.Join(dir, "a.db"), nil)
	id := s1.NodeID()
	s1.Close()
	s1, _ = Open(filepath.Join(dir, "a.db"), nil)
	defer s1.Close()
	s2, _ := Open(filepath.Join(dir, "b.db"), nil)
	defer s2.Close()
	if s1.NodeID() != id || s2.NodeID() == id || len(id) != 34 {
		t.Fatalf("ids: %s %s %s", id, s1.NodeID(), s2.NodeID())
	}
}

// Deleting a zone on one node while another writes into it: the write
// belongs to the dead generation and stays invisible; re-creating starts
// clean with a higher serial.
func TestGenerations(t *testing.T) {
	a1, b1 := open(t), open(t)
	mustWrite(t, a1, createZone("example.com", a("www", "192.0.2.1"))...)
	pull(t, a1, b1)
	z, _, _ := b1.Zone("example.com")
	oldSerial := z.Serial

	mustWrite(t, a1, Draft{Kind: KindZoneDelete, Zone: "example.com", Generation: z.Generation, Payload: struct{}{}})
	mustWrite(t, b1, Draft{Kind: KindRRset, Zone: "example.com", Generation: z.Generation, Name: "api", Type: "A", Payload: RRsetPayload{Records: []config.Record{a("api", "192.0.2.9")}}})
	pull(t, a1, b1)
	pull(t, b1, a1)
	for _, s := range []*Store{a1, b1} {
		if _, ok, _ := s.Zone("example.com"); ok {
			t.Fatal("concurrent write resurrected a deleted zone")
		}
	}
	mustWrite(t, b1, createZone("example.com", a("new", "192.0.2.5"))...)
	pull(t, b1, a1)
	z, ok, _ := a1.Zone("example.com")
	if !ok || len(z.Records) != 1 || z.Records[0].Name != "new" || z.Serial <= oldSerial {
		t.Fatalf("re-created zone: %+v (old serial %d)", z, oldSerial)
	}
}

func TestCNAMERepair(t *testing.T) {
	a1, b1 := open(t), open(t)
	mustWrite(t, a1, createZone("example.com")...)
	pull(t, a1, b1)
	z, _, _ := a1.Zone("example.com")
	mustWrite(t, a1, Draft{Kind: KindRRset, Zone: "example.com", Generation: z.Generation, Name: "shop", Type: "A", Payload: RRsetPayload{Records: []config.Record{a("shop", "192.0.2.1")}}})
	mustWrite(t, b1, Draft{Kind: KindRRset, Zone: "example.com", Generation: z.Generation, Name: "shop", Type: "CNAME", Payload: RRsetPayload{Records: []config.Record{{Name: "shop", Type: "CNAME", Value: "x.org."}}}})
	pull(t, a1, b1)
	pull(t, b1, a1)
	za, _, _ := a1.Zone("example.com")
	zb, _, _ := b1.Zone("example.com")
	// Which side wins depends on the clocks; what matters is that both
	// nodes pick the same one and exactly one RRset survives at the name.
	if !reflect.DeepEqual(za, zb) || len(za.Records) != 1 || len(za.Repairs) != 1 {
		t.Fatalf("repair not deterministic or wrong:\n a=%+v\n b=%+v", za, zb)
	}
}

// The core guarantee: any interleaving of the same ops, with duplicates and
// arbitrary batch splits, converges to identical zones and serials.
func TestConvergenceProperty(t *testing.T) {
	for round := 0; round < 25; round++ {
		rng := rand.New(rand.NewPCG(uint64(round), 7))
		nodes := []*Store{open(t), open(t), open(t)}
		for step := 0; step < 60; step++ {
			n := nodes[rng.IntN(len(nodes))]
			if d, ok := randomDraft(rng, n); ok {
				mustWrite(t, n, d...)
			}
			if rng.IntN(5) == 0 { // occasional partial sync creates causal chains
				pull(t, nodes[rng.IntN(3)], nodes[rng.IntN(3)])
			}
		}
		var ops []Op
		for _, n := range nodes {
			ops = append(ops, allOps(t, n)...)
		}
		var want []Zone
		for trial := 0; trial < 4; trial++ {
			fresh := open(t)
			for _, batch := range interleave(rng, ops) {
				if _, err := fresh.ApplyRemote(batch, time.Hour, nil); err != nil {
					t.Fatal(err)
				}
			}
			got := zonesOf(t, fresh)
			if trial == 0 {
				want = got
				continue
			}
			if !reflect.DeepEqual(got, want) {
				t.Fatalf("round %d trial %d diverged:\n got=%+v\nwant=%+v", round, trial, got, want)
			}
		}
		// The original nodes, fully synced, agree too.
		for i := range nodes {
			for j := range nodes {
				pull(t, nodes[i], nodes[j])
			}
		}
		for i, n := range nodes {
			if got := zonesOf(t, n); !reflect.DeepEqual(got, want) {
				t.Fatalf("round %d node %d diverged after full sync", round, i)
			}
		}
	}
}

// interleave shuffles ops while keeping each origin's seq order (a peer
// always serves an origin in order), splits them into random batches and
// re-sends some already-applied ops as duplicates.
func interleave(rng *rand.Rand, ops []Op) [][]Op {
	byOrigin := map[string][]Op{}
	var origins []string
	for _, op := range ops {
		if _, ok := byOrigin[op.Origin]; !ok {
			origins = append(origins, op.Origin)
		}
		byOrigin[op.Origin] = append(byOrigin[op.Origin], op)
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

func randomDraft(rng *rand.Rand, s *Store) ([]Draft, bool) {
	zone := []string{"a.com", "b.com"}[rng.IntN(2)]
	z, exists, _ := s.Zone(zone)
	if !exists {
		return []Draft{{Kind: KindZoneCreate, Zone: zone, Payload: CreatePayload{}}}, true
	}
	switch rng.IntN(10) {
	case 0:
		return []Draft{{Kind: KindZoneDelete, Zone: zone, Generation: z.Generation, Payload: struct{}{}}}, true
	case 1:
		return []Draft{{Kind: KindSettings, Zone: zone, Generation: z.Generation, Payload: Settings{TTL: config.TTL(60 * (1 + rng.IntN(5)))}}}, true
	}
	name := []string{"@", "www", "api"}[rng.IntN(3)]
	typ := []string{"A", "TXT", "CNAME"}[rng.IntN(3)]
	if rng.IntN(4) == 0 {
		return []Draft{{Kind: KindRRset, Zone: zone, Generation: z.Generation, Name: name, Type: typ, Payload: RRsetPayload{Deleted: true}}}, true
	}
	v := fmt.Sprintf("192.0.2.%d", rng.IntN(250))
	if typ == "TXT" {
		v = "v" + v
	} else if typ == "CNAME" {
		v = "t.example.org."
	}
	return []Draft{{Kind: KindRRset, Zone: zone, Generation: z.Generation, Name: name, Type: typ,
		Payload: RRsetPayload{Records: []config.Record{{Name: name, Type: typ, Value: v}}}}}, true
}

func TestOpsSinceAndGaps(t *testing.T) {
	s := open(t)
	mustWrite(t, s, createZone("example.com", a("a", "192.0.2.1"), a("b", "192.0.2.2"), a("c", "192.0.2.3"))...)
	ops, more, _ := s.OpsSince(map[string]int64{s.NodeID(): 1}, 2)
	if len(ops) != 2 || !more || ops[0].Seq != 2 {
		t.Fatalf("paging: %d %v %+v", len(ops), more, ops)
	}
	// A gap (seq 1 missing) must not be applied.
	r := open(t)
	res, _ := r.ApplyRemote(ops, time.Hour, nil)
	if res.Applied != 0 {
		t.Fatalf("applied across a gap: %+v", res)
	}
}

func TestClockGuardHoldsFutureOps(t *testing.T) {
	s, r := open(t), open(t)
	ops := mustWrite(t, s, createZone("example.com")...)
	ops[0].HLC = hlc.FromTime(t0.Add(time.Hour))
	res, err := r.ApplyRemote(ops, 2*time.Minute, nil)
	if err != nil || res.Applied != 0 || res.Held != 1 {
		t.Fatalf("%+v %v", res, err)
	}
}

func TestValidateHookRejects(t *testing.T) {
	s, r := open(t), open(t)
	ops := mustWrite(t, s, createZone("example.com")...)
	_, err := r.ApplyRemote(ops, time.Hour, func(*Op) error { return fmt.Errorf("nope") })
	if err == nil {
		t.Fatal("validation error must abort the batch")
	}
}

func TestSnapshotBootstrapAndMerge(t *testing.T) {
	a1, b1 := open(t), open(t)
	mustWrite(t, a1, createZone("example.com", a("www", "192.0.2.1"))...)
	// b has a local zone a doesn't know about.
	mustWrite(t, b1, createZone("other.com", a("x", "192.0.2.7"))...)
	snap, err := a1.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(snap) // must survive the wire
	var wire Snapshot
	_ = json.Unmarshal(raw, &wire)
	if _, err := b1.MergeSnapshot(&wire); err != nil {
		t.Fatal(err)
	}
	za, _, _ := a1.Zone("example.com")
	zb, ok, _ := b1.Zone("example.com")
	if !ok || !reflect.DeepEqual(za, zb) {
		t.Fatalf("snapshot view differs:\n a=%+v\n b=%+v", za, zb)
	}
	if _, ok, _ := b1.Zone("other.com"); !ok {
		t.Fatal("merge dropped a local-only zone")
	}
	// b can no longer serve a's early ops individually.
	if _, _, err := b1.OpsSince(map[string]int64{}, 10); err != ErrSnapshotRequired {
		t.Fatalf("want ErrSnapshotRequired, got %v", err)
	}
	// a pulls b's own ops normally, and both agree.
	pull(t, b1, a1)
	if !reflect.DeepEqual(zonesOf(t, a1), zonesOf(t, b1)) {
		t.Fatal("not converged after snapshot + pull")
	}
}

func TestCompaction(t *testing.T) {
	s := open(t)
	mustWrite(t, s, createZone("example.com", a("www", "192.0.2.1"))...)
	z, _, _ := s.Zone("example.com")
	mustWrite(t, s, Draft{Kind: KindRRset, Zone: "example.com", Generation: z.Generation, Name: "www", Type: "A", Payload: RRsetPayload{Deleted: true}})
	mustWrite(t, s, createZone("gone.com")...)
	g, _, _ := s.Zone("gone.com")
	mustWrite(t, s, Draft{Kind: KindZoneDelete, Zone: "gone.com", Generation: g.Generation, Payload: struct{}{}})
	before, _, _ := s.Zone("example.com")

	// Nothing acknowledged → nothing compacted.
	if n, _ := s.Compact(hlc.FromTime(t0.Add(time.Hour)), map[string]int64{}); n != 0 {
		t.Fatalf("compacted unacknowledged ops: %d", n)
	}
	n, err := s.Compact(hlc.FromTime(t0.Add(time.Hour)), map[string]int64{s.NodeID(): 100})
	if err != nil || n != 5 { // 2 create example.com + 1 tombstone + create/delete gone.com
		t.Fatalf("compact: %d %v", n, err)
	}
	after, _, _ := s.Zone("example.com")
	if after.Serial != before.Serial {
		t.Fatalf("compaction changed the serial %d → %d", before.Serial, after.Serial)
	}
	var rows int
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM rrsets WHERE deleted = 1`).Scan(&rows)
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM zones WHERE name = 'gone.com'`).Scan(&rows)
	if rows != 0 {
		t.Fatal("tombstones not purged")
	}
	if _, _, err := s.OpsSince(map[string]int64{}, 10); err != ErrSnapshotRequired {
		t.Fatalf("want ErrSnapshotRequired after compaction, got %v", err)
	}
}
