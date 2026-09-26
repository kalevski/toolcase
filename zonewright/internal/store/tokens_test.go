package store

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/hlc"
)

func tokenDraft(name, hash string, zones ...string) Draft {
	return Draft{Kind: KindToken, Name: name, Payload: TokenPayload{Hash: hash, Scope: "acme", Zones: zones, Created: "2026-09-26T10:00:00Z"}}
}

var (
	hashA = strings.Repeat("a", 64)
	hashB = strings.Repeat("b", 64)
)

func TestTokensReplicateAndDoNotTouchSerials(t *testing.T) {
	n1, n2 := open(t), open(t)
	mustWrite(t, n1, createZone("example.com", a("www", "192.0.2.1"))...)
	pull(t, n1, n2)
	before, _, _ := n1.Zone("example.com")

	mustWrite(t, n1, tokenDraft("edge-fra", hashA, "example.com"))
	if after, _, _ := n1.Zone("example.com"); after.Serial != before.Serial {
		t.Fatalf("a token op bumped the zone serial %d → %d", before.Serial, after.Serial)
	}
	var counters int
	_ = n1.db.QueryRow(`SELECT COUNT(*) FROM counters WHERE zone = ''`).Scan(&counters)
	if counters != 0 {
		t.Fatal("a token op created a serial counter")
	}

	vv, _ := n2.VV()
	ops, _, _ := n1.OpsSince(vv, 100)
	res, err := n2.ApplyRemote(ops, time.Hour, nil)
	if err != nil || res.Applied != 1 || len(res.Touched) != 0 {
		t.Fatalf("apply token op: %+v %v (a token must not mark any zone touched)", res, err)
	}
	got, ok, _ := n2.TokenByHash(hashA)
	if !ok || got.Name != "edge-fra" || !reflect.DeepEqual(got.Zones, []string{"example.com"}) {
		t.Fatalf("replicated token: %+v %v", got, ok)
	}

	// Rotation on n2, a concurrent zone-list change on n1: the later op wins
	// on both nodes.
	mustWrite(t, n2, tokenDraft("edge-fra", hashB, "example.com"))
	mustWrite(t, n1, tokenDraft("edge-fra", hashA, "example.com", "example.org"))
	pull(t, n1, n2)
	pull(t, n2, n1)
	t1, _ := n1.Tokens()
	t2, _ := n2.Tokens()
	if !reflect.DeepEqual(t1, t2) || len(t1) != 1 {
		t.Fatalf("not converged:\n n1=%+v\n n2=%+v", t1, t2)
	}

	// Delete: the hash no longer resolves anywhere.
	cur := t1[0].Hash
	mustWrite(t, n1, Draft{Kind: KindToken, Name: "edge-fra", Payload: TokenPayload{Deleted: true}})
	pull(t, n1, n2)
	for _, n := range []*Store{n1, n2} {
		if _, ok, _ := n.TokenByHash(cur); ok {
			t.Fatal("deleted token still resolves")
		}
		if list, _ := n.Tokens(); len(list) != 0 {
			t.Fatalf("deleted token still listed: %+v", list)
		}
	}
}

func TestTokensInSnapshotAndCompaction(t *testing.T) {
	n1, n2 := open(t), open(t)
	mustWrite(t, n1, tokenDraft("keep", hashA))
	mustWrite(t, n1, tokenDraft("gone", hashB))
	mustWrite(t, n1, Draft{Kind: KindToken, Name: "gone", Payload: TokenPayload{Deleted: true}})

	snap, err := n1.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(snap)
	var wire Snapshot
	_ = json.Unmarshal(raw, &wire)
	if len(wire.Tokens) != 2 {
		t.Fatalf("snapshot tokens: %+v", wire.Tokens)
	}
	if _, err := n2.MergeSnapshot(&wire); err != nil {
		t.Fatal(err)
	}
	if got, ok, _ := n2.TokenByHash(hashA); !ok || got.Name != "keep" {
		t.Fatalf("token lost in snapshot: %+v %v", got, ok)
	}
	if _, ok, _ := n2.TokenByHash(hashB); ok {
		t.Fatal("deleted token revived by snapshot")
	}

	if _, err := n1.Compact(hlc.FromTime(t0.Add(time.Hour)), map[string]int64{n1.NodeID(): 100}); err != nil {
		t.Fatal(err)
	}
	var rows int
	_ = n1.db.QueryRow(`SELECT COUNT(*) FROM tokens WHERE name = 'gone'`).Scan(&rows)
	if rows != 0 {
		t.Fatal("token tombstone not purged by compaction")
	}
	if _, ok, _ := n1.TokenByHash(hashA); !ok {
		t.Fatal("compaction dropped a live token")
	}
}
