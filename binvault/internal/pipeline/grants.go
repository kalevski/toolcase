package pipeline

import (
	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/keypat"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// ExpandGrants expands a pipeline's grant templates for the triggering key
// (spec §7.8): every {variable} is replaced by its escaped value, so a key
// containing '*' can never widen a grant. A grant whose templates all expand to
// a bare "*" (an empty {dir} followed by "/*") is dropped for the run.
//
// With readOnly (a before delete chain, spec §7.8) only the read and list
// actions survive.
func ExpandGrants(templates []meta.Grant, key string, readOnly bool) []meta.Grant {
	var out []meta.Grant
	for _, g := range templates {
		actions := g.Actions
		if readOnly {
			actions = nil
			for _, a := range g.Actions {
				if a == auth.Read || a == auth.List {
					actions = append(actions, a)
				}
			}
			if len(actions) == 0 {
				continue
			}
		}
		eg := meta.Grant{Actions: append([]string(nil), actions...)}
		if g.Keys != nil {
			eg.Keys = []string{}
			for _, t := range g.Keys {
				if p, ok := keypat.Expand(t, key); ok {
					eg.Keys = append(eg.Keys, p)
				}
			}
			if len(eg.Keys) == 0 {
				continue // never widen a grant to every key
			}
		}
		out = append(out, eg)
	}
	return out
}
