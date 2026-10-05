package pipeline

import (
	"encoding/json"

	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/glob"
)

// Facts describe the object an event is about, for matching (spec §7.3).
type Facts struct {
	Key       string
	Operation string
	Size      int64
	// DeclaredType is the Content-Type of the write (the stored value for after
	// runs and deletes). SniffedType is the type detected from the first 512
	// bytes, "" when no bytes were read (then the declared type stands in for a
	// deleted event, and SniffUnknown is set for any other).
	DeclaredType string
	SniffedType  string
	// SniffUnknown: the bytes have not been read (a copy that is not staged yet, a
	// backfill, a copy that keeps the blob), so a condition on the sniffed type is
	// assumed to hold: asking whether a chain might run must never answer "no"
	// wrongly, and a gate on the sniffed type cannot be dodged by relabelling.
	SniffUnknown bool
}

// Matcher is a compiled Match filter.
type Matcher struct {
	keys    glob.Set
	exclude glob.Set
	types   []string
	sniffed bool
	ops     map[string]bool
	min     *int64
	max     *int64
}

// Compile prepares a filter for matching. The filter is validated when it is
// saved, so compilation cannot fail.
func (m Match) Compile() *Matcher {
	c := &Matcher{keys: glob.Set(m.Keys), exclude: glob.Set(m.ExcludeKeys), types: m.ContentType,
		sniffed: m.ContentTypeSource == "sniffed", min: m.MinSize, max: m.MaxSize}
	if len(m.Operations) > 0 {
		c.ops = make(map[string]bool, len(m.Operations))
		for _, o := range m.Operations {
			c.ops[o] = true
		}
	}
	return c
}

// compileJSON compiles a filter stored as JSON (an attachment's `match`).
func compileJSON(raw string) (*Matcher, Match) {
	var m Match
	if raw != "" {
		_ = json.Unmarshal([]byte(raw), &m)
	}
	return m.Compile(), m
}

// NeedsSniff reports whether matching looks at the sniffed content type.
func (c *Matcher) NeedsSniff() bool { return c != nil && c.sniffed && len(c.types) > 0 }

// Matches reports whether every condition present holds for the object.
func (c *Matcher) Matches(f Facts) bool {
	if c == nil {
		return true
	}
	if len(c.keys) > 0 && !c.keys.MatchAny(f.Key) {
		return false
	}
	if len(c.exclude) > 0 && c.exclude.MatchAny(f.Key) {
		return false
	}
	if len(c.types) > 0 && !(c.sniffed && f.SniffUnknown) {
		ct := f.DeclaredType
		if c.sniffed && f.SniffedType != "" {
			ct = f.SniffedType
		}
		if !engine.TypeAllowed(c.types, ct) {
			return false
		}
	}
	if c.min != nil && f.Size < *c.min {
		return false
	}
	if c.max != nil && f.Size > *c.max {
		return false
	}
	if c.ops != nil && !c.ops[f.Operation] {
		return false
	}
	return true
}

// matchBoth is the pipeline's filter AND the attachment's narrowing filter.
func matchBoth(a, b *Matcher, f Facts) bool { return a.Matches(f) && b.Matches(f) }
