// Package auth holds the principals of the data plane and what they may do
// (spec §4): grants and key patterns, bucket-token lookup with sealed secrets,
// access-key generation and brute-force throttling. SigV4 verification itself
// is in package sigv4; wiring them together happens in package s3.
package auth

import (
	"fmt"

	"github.com/kalevski/toolcase/binvault/internal/keypat"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// The seven actions of spec §4.4.
const (
	Read   = "read"
	List   = "list"
	Create = "create"
	Write  = "write"
	Tag    = "tag"
	Delete = "delete"
	Purge  = "purge"
)

// Actions lists the seven actions in a stable order.
var Actions = []string{Read, List, Create, Write, Tag, Delete, Purge}

type actionSet uint8

var actionBit = map[string]actionSet{
	Read: 1 << 0, List: 1 << 1, Create: 1 << 2, Write: 1 << 3, Tag: 1 << 4, Delete: 1 << 5, Purge: 1 << 6,
}

// ValidAction reports whether name is one of the seven actions.
func ValidAction(name string) bool { _, ok := actionBit[name]; return ok }

type grant struct {
	actions actionSet
	all     bool // no `keys`: every key
	pats    []keypat.Pattern
}

// Grants is a compiled grant list: a request is allowed when some grant covers
// its action and key.
type Grants struct {
	gs []grant
}

// CompileGrants validates and compiles stored grants (spec §4.3): at least one
// grant, each with a non-empty `actions` list of known actions, and `keys`
// either omitted (every key) or non-empty and well-formed.
func CompileGrants(in []meta.Grant) (Grants, error) {
	if len(in) == 0 {
		return Grants{}, fmt.Errorf("grants must not be empty")
	}
	var out Grants
	for i, g := range in {
		if len(g.Actions) == 0 {
			return Grants{}, fmt.Errorf("grants[%d].actions must not be empty", i)
		}
		var set actionSet
		for _, a := range g.Actions {
			bit, ok := actionBit[a]
			if !ok {
				return Grants{}, fmt.Errorf("grants[%d]: unknown action %q", i, a)
			}
			set |= bit
		}
		cg := grant{actions: set}
		if g.Keys == nil {
			cg.all = true
		} else {
			if len(g.Keys) == 0 {
				return Grants{}, fmt.Errorf("grants[%d].keys must not be empty (omit it for every key)", i)
			}
			for _, k := range g.Keys {
				p, err := keypat.Parse(k)
				if err != nil {
					return Grants{}, fmt.Errorf("grants[%d].keys: %w", i, err)
				}
				cg.pats = append(cg.pats, p)
			}
		}
		out.gs = append(out.gs, cg)
	}
	return out, nil
}

// CompilePatterns builds Grants from already-expanded pipeline grants
// (action list + pattern strings; pattern strings are parsed here).
func CompileExpanded(in []meta.Grant) (Grants, error) {
	if len(in) == 0 {
		return Grants{}, nil
	}
	return CompileGrants(in)
}

func (g grant) has(a string) bool {
	if g.actions&actionBit[a] != 0 {
		return true
	}
	// write implies create and tag (spec §4.4)
	if (a == Create || a == Tag) && g.actions&actionBit[Write] != 0 {
		return true
	}
	return false
}

// Can reports whether some grant allows the action on the key.
func (g Grants) Can(action, key string) bool {
	for _, gr := range g.gs {
		if !gr.has(action) {
			continue
		}
		if gr.all || keypat.MatchAny(gr.pats, key) {
			return true
		}
	}
	return false
}

// CanAny reports whether some grant holds the action for at least one key
// (bucket-level calls need any action on the bucket; spec §4.4).
func (g Grants) CanAnyAction() bool { return len(g.gs) > 0 }

// CanList reports whether a listing with this prefix is allowed: some `list`
// grant covers every key (no key patterns) or has a pattern whose literal part
// is a prefix of the request prefix (spec §4.4).
func (g Grants) CanList(prefix string) bool {
	for _, gr := range g.gs {
		if !gr.has(List) {
			continue
		}
		if gr.all {
			return true
		}
		for _, p := range gr.pats {
			if p.AllowsList(prefix) {
				return true
			}
		}
	}
	return false
}

// ListFilter returns the predicate that restricts listing results to keys the
// `list` grants cover (nil when a grant covers every key).
func (g Grants) ListFilter() func(key string) bool {
	for _, gr := range g.gs {
		if gr.has(List) && gr.all {
			return nil
		}
	}
	return func(key string) bool { return g.Can(List, key) }
}

// Has reports whether any grant lists the action at all (for any key).
func (g Grants) Has(action string) bool {
	for _, gr := range g.gs {
		if gr.has(action) {
			return true
		}
	}
	return false
}
