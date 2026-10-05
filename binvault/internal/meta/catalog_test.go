package meta

import (
	"context"
	"reflect"
	"testing"
	"time"
)

func op(origin string, seq int64, hlc uint64, kind, key string) *CatalogOp {
	return &CatalogOp{Origin: origin, Seq: seq, HLC: hlc, V: 1, Kind: kind, Key: key, Payload: []byte(`{"n":` + string(rune('0'+seq%10)) + `}`)}
}

func reg(o *CatalogOp) *CatalogReg {
	return &CatalogReg{Key: o.Kind + "/" + o.Key, Kind: o.Kind, Name: o.Key, Payload: o.Payload, HLC: o.HLC, Origin: o.Origin, Seq: o.Seq}
}

func TestClusterMigration(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	if SchemaVersion() < 2 {
		t.Fatalf("schema version %d: the cluster tables are migration 2", SchemaVersion())
	}
	v, _ := d.Version(ctx)
	if v != SchemaVersion() {
		t.Fatalf("version %d want %d", v, SchemaVersion())
	}
	for _, table := range []string{"ops", "ops_vv", "ops_floor", "catalog", "peers", "peer_urls"} {
		var n int
		if err := d.Raw().QueryRowContext(ctx, `SELECT COUNT(*) FROM `+table).Scan(&n); err != nil {
			t.Errorf("table %s: %v", table, err)
		}
	}
}

// The winner rule is one SQL statement: whichever order two ops arrive in, the
// same one is stored, and a tie on hlc is broken by origin.
func TestCatalogUpsertWinnerRule(t *testing.T) {
	ctx := context.Background()
	a := op("a", 1, 100, "bucket", "x")
	b := op("b", 1, 100, "bucket", "x") // same hlc, higher origin
	c := op("c", 1, 99, "bucket", "x")  // older
	for _, order := range [][]*CatalogOp{{a, b, c}, {c, b, a}, {b, a, c}, {c, a, b}, {a, c, b}, {b, c, a}} {
		d := openTest(t)
		for _, o := range order {
			mustUpdate(t, d, func(tx *Tx) error { _, err := tx.CatalogUpsertReg(ctx, reg(o)); return err })
		}
		got, err := d.Read().CatalogGetReg(ctx, "bucket/x")
		if err != nil || got.Origin != "b" || got.HLC != 100 {
			t.Fatalf("order %v: winner %+v err %v", []string{order[0].Origin, order[1].Origin, order[2].Origin}, got, err)
		}
	}

	d := openTest(t)
	var applied []bool
	for _, o := range []*CatalogOp{a, a, c, b, b} {
		mustUpdate(t, d, func(tx *Tx) error {
			ok, err := tx.CatalogUpsertReg(ctx, reg(o))
			applied = append(applied, ok)
			return err
		})
	}
	if !reflect.DeepEqual(applied, []bool{true, false, false, true, false}) {
		t.Fatalf("applied flags %v: only a strictly better (hlc, origin) may replace the stored value", applied)
	}
	// A tombstone competes like any value.
	del := reg(op("a", 2, 200, "bucket", "x"))
	del.Deleted, del.Payload = true, []byte(`{"deleted":true}`)
	mustUpdate(t, d, func(tx *Tx) error { _, err := tx.CatalogUpsertReg(ctx, del); return err })
	got, _ := d.Read().CatalogGetReg(ctx, "bucket/x")
	if !got.Deleted || got.Seq != 2 {
		t.Fatalf("tombstone should win: %+v", got)
	}
	live, _ := d.Read().CatalogListRegs(ctx, "bucket", "", 10, false)
	all, _ := d.Read().CatalogListRegs(ctx, "bucket", "", 10, true)
	if len(live) != 0 || len(all) != 1 {
		t.Fatalf("live %d all %d", len(live), len(all))
	}
}

func TestCatalogAppendOpIdempotentAndVV(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	o := op("a", 1, 10, "bucket", "x")
	var first, second bool
	mustUpdate(t, d, func(tx *Tx) (err error) {
		if first, err = tx.CatalogAppendOp(ctx, o); err != nil {
			return err
		}
		second, err = tx.CatalogAppendOp(ctx, o)
		return err
	})
	if !first || second {
		t.Fatalf("first=%v second=%v: a duplicate op must be a no-op", first, second)
	}
	mustUpdate(t, d, func(tx *Tx) error {
		_, err := tx.CatalogAppendOp(ctx, op("a", 2, 11, "bucket", "x"))
		return err
	})
	vv, _ := d.Read().CatalogVV(ctx)
	if !reflect.DeepEqual(vv, map[string]int64{"a": 2}) {
		t.Fatalf("vv %v", vv)
	}
	got, err := d.Read().CatalogGetOp(ctx, "a", 2)
	if err != nil || got.ID() != "a:2" || got.HLC != 11 {
		t.Fatalf("op %+v %v", got, err)
	}
	if _, err := d.Read().CatalogGetOp(ctx, "a", 9); err != ErrNotFound {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
	ops, err := d.Read().CatalogOpRange(ctx, "a", 1, 10)
	if err != nil || len(ops) != 1 || ops[0].Seq != 2 {
		t.Fatalf("range after 1: %+v %v", ops, err)
	}
	// Raising never lowers.
	mustUpdate(t, d, func(tx *Tx) error { return tx.CatalogRaiseVV(ctx, "a", 1) })
	mustUpdate(t, d, func(tx *Tx) error { return tx.CatalogRaiseFloor(ctx, "a", 5) })
	mustUpdate(t, d, func(tx *Tx) error { return tx.CatalogRaiseFloor(ctx, "a", 3) })
	vv, _ = d.Read().CatalogVV(ctx)
	fl, _ := d.Read().CatalogFloors(ctx)
	if vv["a"] != 2 || fl["a"] != 5 {
		t.Fatalf("vv %v floor %v", vv, fl)
	}
}

func TestCatalogCompactAndPurge(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	mustUpdate(t, d, func(tx *Tx) error {
		for i := int64(1); i <= 5; i++ {
			if _, err := tx.CatalogAppendOp(ctx, op("a", i, uint64(i*10), "key", "k")); err != nil {
				return err
			}
		}
		return nil
	})
	var n int64
	// seq <= 4 and hlc < 35: seq 1..3 qualify.
	mustUpdate(t, d, func(tx *Tx) (err error) { n, err = tx.CatalogCompactOps(ctx, "a", 4, 35); return })
	if n != 3 {
		t.Fatalf("compacted %d, want 3", n)
	}
	fl, _ := d.Read().CatalogFloors(ctx)
	if fl["a"] != 3 {
		t.Fatalf("floor %v", fl)
	}
	left, _ := d.Read().CatalogOpRange(ctx, "a", 0, 10)
	if len(left) != 2 || left[0].Seq != 4 {
		t.Fatalf("left %+v", left)
	}
	mustUpdate(t, d, func(tx *Tx) (err error) { n, err = tx.CatalogCompactOps(ctx, "a", 0, 1<<60); return })
	if n != 0 {
		t.Fatalf("nothing was acknowledged, nothing may go: %d", n)
	}

	// Tombstone purge only removes the tombstone written by the named op.
	tomb := reg(op("a", 7, 70, "key", "gone"))
	tomb.Deleted = true
	mustUpdate(t, d, func(tx *Tx) error { _, err := tx.CatalogUpsertReg(ctx, tomb); return err })
	var ok bool
	mustUpdate(t, d, func(tx *Tx) (err error) { ok, err = tx.CatalogPurgeTombstone(ctx, "key/gone", "a", 6); return })
	if ok {
		t.Fatal("purged a tombstone written by another op")
	}
	mustUpdate(t, d, func(tx *Tx) (err error) { ok, err = tx.CatalogPurgeTombstone(ctx, "key/gone", "a", 7); return })
	if !ok {
		t.Fatal("tombstone not purged")
	}
	if _, err := d.Read().CatalogGetReg(ctx, "key/gone"); err != ErrNotFound {
		t.Fatalf("want ErrNotFound after purge, got %v", err)
	}
	// A live register is never purged.
	live := reg(op("a", 8, 80, "key", "live"))
	mustUpdate(t, d, func(tx *Tx) error { _, err := tx.CatalogUpsertReg(ctx, live); return err })
	mustUpdate(t, d, func(tx *Tx) (err error) { ok, err = tx.CatalogPurgeTombstone(ctx, "key/live", "a", 8); return })
	if ok {
		t.Fatal("purged a live register")
	}
}

func TestCatalogAuxIndexAndStats(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	mustUpdate(t, d, func(tx *Tx) error {
		for i, home := range []string{"n1", "n2", "n1"} {
			r := reg(op("a", int64(i+1), uint64(i+1), "bucket", string(rune('x'+i))))
			r.Aux = home
			if _, err := tx.CatalogUpsertReg(ctx, r); err != nil {
				return err
			}
		}
		gone := reg(op("a", 4, 4, "bucket", "dead"))
		gone.Aux, gone.Deleted = "n1", true
		_, err := tx.CatalogUpsertReg(ctx, gone)
		return err
	})
	q := d.Read()
	if n, _ := q.CatalogCountByAux(ctx, "bucket", "n1"); n != 2 {
		t.Fatalf("n1 homes %d buckets, want 2 (tombstones do not count)", n)
	}
	regs, _ := q.CatalogRegsByAux(ctx, "bucket", "n2")
	if len(regs) != 1 || regs[0].Name != "y" {
		t.Fatalf("n2: %+v", regs)
	}
	st, err := q.CatalogStats(ctx)
	if err != nil || st.Registers != 3 || st.Tombstones != 1 || st.MaxHLC != 4 {
		t.Fatalf("stats %+v %v", st, err)
	}
	if hl, _ := q.CatalogMaxHLC(ctx); hl != 4 {
		t.Fatalf("max hlc %d", hl)
	}
}

// ReadSnapshot gives one consistent view: a commit that lands in the middle is
// invisible inside it and visible right after.
func TestReadSnapshotIsConsistent(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	mustUpdate(t, d, func(tx *Tx) error { _, err := tx.CatalogAppendOp(ctx, op("a", 1, 1, "key", "k")); return err })
	err := d.ReadSnapshot(ctx, func(q Q) error {
		before, err := q.CatalogVV(ctx)
		if err != nil {
			return err
		}
		mustUpdate(t, d, func(tx *Tx) error { _, err := tx.CatalogAppendOp(ctx, op("a", 2, 2, "key", "k")); return err })
		after, err := q.CatalogVV(ctx)
		if err != nil {
			return err
		}
		if !reflect.DeepEqual(before, after) {
			t.Errorf("snapshot moved under the reader: %v -> %v", before, after)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	vv, _ := d.Read().CatalogVV(ctx)
	if vv["a"] != 2 {
		t.Fatalf("vv %v", vv)
	}
}

func TestPeerRows(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	t0 := time.Date(2026, 10, 2, 12, 0, 0, 0, time.UTC)
	mustUpdate(t, d, func(tx *Tx) error {
		if err := tx.UpsertPeer(ctx, "n1", "alpha", t0); err != nil {
			return err
		}
		if err := tx.UpsertPeer(ctx, "n1", "alpha2", t0.Add(time.Hour)); err != nil { // renamed: first_seen is kept
			return err
		}
		if err := tx.UpsertPeer(ctx, "n2", "beta", t0.Add(time.Minute)); err != nil {
			return err
		}
		if err := tx.SetPeerURL(ctx, "http://a", "n1"); err != nil {
			return err
		}
		if err := tx.SetPeerURL(ctx, "http://a", "n2"); err != nil {
			return err
		}
		return tx.SetPeerRetired(ctx, "n2", true, "redeployed", t0.Add(2*time.Minute))
	})
	peers, err := d.Read().ListPeers(ctx)
	if err != nil || len(peers) != 2 {
		t.Fatalf("peers %+v %v", peers, err)
	}
	if peers[0].NodeID != "n1" || peers[0].Name != "alpha2" || !peers[0].FirstSeen.Equal(t0) || peers[0].Retired {
		t.Fatalf("n1: %+v", peers[0])
	}
	if !peers[1].Retired || peers[1].RetiredWhy != "redeployed" || peers[1].RetiredAt == nil {
		t.Fatalf("n2: %+v", peers[1])
	}
	urls, _ := d.Read().PeerURLs(ctx)
	if !reflect.DeepEqual(urls, map[string]string{"http://a": "n2"}) {
		t.Fatalf("urls %v", urls)
	}
	// Retiring an id never seen before records it; reviving clears the flags.
	mustUpdate(t, d, func(tx *Tx) error { return tx.SetPeerRetired(ctx, "n3", true, "removed", t0) })
	mustUpdate(t, d, func(tx *Tx) error { return tx.SetPeerRetired(ctx, "n2", false, "", t0) })
	peers, _ = d.Read().ListPeers(ctx)
	byID := map[string]PeerRow{}
	for _, p := range peers {
		byID[p.NodeID] = p
	}
	if !byID["n3"].Retired || byID["n2"].Retired || byID["n2"].RetiredAt != nil {
		t.Fatalf("after retire/revive: %+v", byID)
	}
}

// Two ops of one origin with the same hlc cannot come from an honest node, but a
// faulty peer must not make the winner depend on arrival order: the seq breaks
// the tie, so the rule is a total order (spec §8.5).
func TestCatalogWinnerRuleIsTotal(t *testing.T) {
	ctx := context.Background()
	lo, hi := op("a", 1, 100, "bucket", "x"), op("a", 2, 100, "bucket", "x")
	for _, order := range [][]*CatalogOp{{lo, hi}, {hi, lo}} {
		d := openTest(t)
		for _, o := range order {
			mustUpdate(t, d, func(tx *Tx) error { _, err := tx.CatalogUpsertReg(ctx, reg(o)); return err })
		}
		got, err := d.Read().CatalogGetReg(ctx, "bucket/x")
		if err != nil || got.Seq != 2 {
			t.Fatalf("order %d,%d: winner seq %d %v", order[0].Seq, order[1].Seq, got.Seq, err)
		}
	}
	if !CatalogWins(5, "a", 2, 5, "a", 1) || CatalogWins(5, "a", 1, 5, "a", 2) || CatalogWins(5, "a", 1, 5, "a", 1) {
		t.Fatal("CatalogWins")
	}
	if !CatalogWins(6, "a", 1, 5, "z", 9) || !CatalogWins(5, "b", 1, 5, "a", 9) {
		t.Fatal("CatalogWins: hlc first, then origin")
	}
}

func TestCatalogPageRegsWalksTheWholeCatalog(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	mustUpdate(t, d, func(tx *Tx) error {
		for i := 0; i < 25; i++ {
			kind := []string{"bucket", "key", "pipeline"}[i%3]
			r := reg(op("a", int64(i+1), uint64(i+1), kind, "n"+string(rune('a'+i))))
			r.Deleted = i%4 == 0 // tombstones are part of a snapshot
			if _, err := tx.CatalogUpsertReg(ctx, r); err != nil {
				return err
			}
		}
		return nil
	})
	var seen []string
	after := ""
	for {
		page, err := d.Read().CatalogPageRegs(ctx, after, 7)
		if err != nil {
			t.Fatal(err)
		}
		for _, r := range page {
			seen = append(seen, r.Key)
			after = r.Key
		}
		if len(page) < 7 {
			break
		}
	}
	all, _ := d.Read().CatalogAllRegs(ctx)
	if len(seen) != 25 || len(all) != 25 {
		t.Fatalf("paged %d, all %d", len(seen), len(all))
	}
	for i := range all {
		if all[i].Key != seen[i] {
			t.Fatalf("page order differs at %d: %s vs %s", i, seen[i], all[i].Key)
		}
	}
}
