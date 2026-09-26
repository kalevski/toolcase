package manager

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/zonewright/internal/store"
)

func TestValidateTokenOp(t *testing.T) {
	good := store.TokenPayload{Hash: strings.Repeat("0f", 32), Scope: "acme", Zones: []string{"example.com"}, Created: "2026-09-26T10:00:00Z"}
	op := func(name string, p any, mutate func(*store.Op)) *store.Op {
		raw, _ := json.Marshal(p)
		o := &store.Op{Kind: store.KindToken, Name: name, Payload: raw}
		if mutate != nil {
			mutate(o)
		}
		return o
	}
	if err := ValidateOp(op("edge-fra", good, nil)); err != nil {
		t.Fatalf("valid token op: %v", err)
	}
	if err := ValidateOp(op("edge-fra", store.TokenPayload{Deleted: true}, nil)); err != nil {
		t.Fatalf("valid tombstone: %v", err)
	}
	bad := map[string]*store.Op{
		"bad name":            op("Edge FRA", good, nil),
		"zone set":            op("edge-fra", good, func(o *store.Op) { o.Zone = "example.com" }),
		"type set":            op("edge-fra", good, func(o *store.Op) { o.Type = "TXT" }),
		"short hash":          op("edge-fra", store.TokenPayload{Hash: "abc", Scope: "acme", Created: good.Created}, nil),
		"upper-case hash":     op("edge-fra", store.TokenPayload{Hash: strings.Repeat("0F", 32), Scope: "acme", Created: good.Created}, nil),
		"unknown scope":       op("edge-fra", store.TokenPayload{Hash: good.Hash, Scope: "admin", Created: good.Created}, nil),
		"non-canonical zone":  op("edge-fra", store.TokenPayload{Hash: good.Hash, Scope: "acme", Zones: []string{"Example.COM."}, Created: good.Created}, nil),
		"bad created":         op("edge-fra", store.TokenPayload{Hash: good.Hash, Scope: "acme", Created: "yesterday"}, nil),
		"tombstone with hash": op("edge-fra", store.TokenPayload{Deleted: true, Hash: good.Hash}, nil),
		"zones and all_zones": op("edge-fra", store.TokenPayload{Hash: good.Hash, Scope: "acme", Zones: []string{"example.com"}, AllZones: true, Created: good.Created}, nil),
		"tombstone all_zones": op("edge-fra", store.TokenPayload{Deleted: true, AllZones: true}, nil),
		"unknown field":       op("edge-fra", map[string]any{"hash": good.Hash, "scope": "acme", "created": good.Created, "admin": true}, nil),
	}
	for name, o := range bad {
		if err := ValidateOp(o); err == nil {
			t.Errorf("%s: expected rejection", name)
		}
	}
}
