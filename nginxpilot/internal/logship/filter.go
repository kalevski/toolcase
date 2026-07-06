// Package logship is the log shipping core: it parses JSON access-log lines
// into entries, filters them per destination, buffers them in bounded ring
// buffers, and ships batches to stdout / file / generic HTTP / Loki sinks.
//
// The package is deliberately pure stdlib and imports nothing from the rest of
// the daemon, so the filter grammar and shipping semantics can be reused (or
// copied, with this test suite) by other collectors (quaykeeper/client-go).
//
// Shipping is best-effort with an at-least-once contract: a batch whose
// delivery times out may be retried after the destination already stored it,
// so consumers must tolerate replays. A broken destination only ever
// accumulates counters — it can never block the intake or the daemon.
package logship

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// Filter field kinds — how a field's matcher list is interpreted.
const (
	fieldGlob      = "glob"       // exact / '*' glob / leading '!' negation
	fieldGlobNoSep = "glob-nosep" // glob where '*' does not cross '/'
	fieldStatus    = "status"     // exact "404", class "4xx", comparison ">=500"
	fieldSet       = "set"        // exact match, case-insensitive
)

// fieldSpec describes one filterable field: its matcher kind and whether
// matching is case-insensitive.
type fieldSpec struct {
	kind        string
	insensitive bool
}

// FieldsAccess is the filter profile for nginx access-log entries.
var FieldsAccess = map[string]fieldSpec{
	"host":          {fieldGlob, true},
	"resource":      {fieldGlob, true},
	"path":          {fieldGlobNoSep, false},
	"user_agent":    {fieldGlob, false},
	"status":        {fieldStatus, false},
	"method":        {fieldSet, true},
	"scheme":        {fieldSet, true},
	"resource_type": {fieldSet, true},
}

// FieldsApp is the filter profile for application-log entries (client-go).
var FieldsApp = map[string]fieldSpec{
	"level":  {fieldSet, true},
	"stream": {fieldSet, true},
	"raw":    {fieldGlob, false},
}

// Filter is a compiled multi-field filter: AND across fields, OR within a
// field's positive matchers, with '!' matchers subtractive. A nil *Filter
// matches everything.
type Filter struct {
	fields []fieldFilter
}

type fieldFilter struct {
	name     string
	spec     fieldSpec
	positive []matcher
	negative []matcher // from '!' matchers (glob kinds only)
}

type matcher struct {
	// glob matchers
	segments []string // literal segments split on unescaped '*'
	crossSep bool     // '*' may cross '/'
	// status matchers
	op   string // "=", "class", ">=", "<=", ">", "<"
	code int
	// set matchers
	literal string
}

// CompileFilter parses a declarative filter (field → matcher list) against a
// field profile. An unknown field name, an empty matcher list, or a malformed
// matcher is an error — filters are validated at config-parse time.
func CompileFilter(raw map[string][]string, profile map[string]fieldSpec) (*Filter, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	f := &Filter{}
	// Deterministic compile order so error messages are stable.
	names := make([]string, 0, len(raw))
	for name := range raw {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		spec, known := profile[name]
		if !known {
			return nil, fmt.Errorf("filter field %q is not filterable (known fields: %s)", name, strings.Join(profileFields(profile), ", "))
		}
		list := raw[name]
		if len(list) == 0 {
			return nil, fmt.Errorf("filter field %q: matcher list must not be empty (omit the field to match everything)", name)
		}
		ff := fieldFilter{name: name, spec: spec}
		for _, m := range list {
			if m == "" {
				return nil, fmt.Errorf("filter field %q: empty matcher", name)
			}
			switch spec.kind {
			case fieldStatus:
				sm, err := compileStatusMatcher(m)
				if err != nil {
					return nil, fmt.Errorf("filter field %q: %w", name, err)
				}
				ff.positive = append(ff.positive, sm)
			case fieldSet:
				lit := m
				if spec.insensitive {
					lit = strings.ToLower(lit)
				}
				ff.positive = append(ff.positive, matcher{literal: lit})
			default: // glob kinds
				pat, negated := m, false
				if strings.HasPrefix(pat, "!") {
					negated, pat = true, pat[1:]
					if pat == "" {
						return nil, fmt.Errorf("filter field %q: %q: '!' needs a pattern", name, m)
					}
				} else if strings.HasPrefix(pat, `\!`) {
					pat = pat[1:] // escaped literal '!'
				}
				gm, err := compileGlob(pat, spec.kind == fieldGlob, spec.insensitive)
				if err != nil {
					return nil, fmt.Errorf("filter field %q: %q: %w", name, m, err)
				}
				if negated {
					ff.negative = append(ff.negative, gm)
				} else {
					ff.positive = append(ff.positive, gm)
				}
			}
		}
		f.fields = append(f.fields, ff)
	}
	return f, nil
}

func profileFields(profile map[string]fieldSpec) []string {
	out := make([]string, 0, len(profile))
	for name := range profile {
		out = append(out, name)
	}
	sort.Strings(out)
	return out
}

// compileGlob splits a pattern on unescaped '*' into literal segments.
// '\*', '\!' and '\\' escape; any other backslash sequence is an error so a
// typo can't silently become a literal backslash.
func compileGlob(pattern string, crossSep, insensitive bool) (matcher, error) {
	var segs []string
	var cur strings.Builder
	for i := 0; i < len(pattern); i++ {
		c := pattern[i]
		switch c {
		case '\\':
			if i+1 >= len(pattern) {
				return matcher{}, fmt.Errorf(`trailing '\'`)
			}
			next := pattern[i+1]
			if next != '*' && next != '!' && next != '\\' {
				return matcher{}, fmt.Errorf(`unknown escape '\%c' (only \*, \! and \\ are escapes)`, next)
			}
			cur.WriteByte(next)
			i++
		case '*':
			segs = append(segs, cur.String())
			cur.Reset()
		default:
			cur.WriteByte(c)
		}
	}
	segs = append(segs, cur.String())
	if insensitive {
		for i := range segs {
			segs[i] = strings.ToLower(segs[i])
		}
	}
	return matcher{segments: segs, crossSep: crossSep}, nil
}

// compileStatusMatcher parses "404", "4xx", ">=500", "<400", ">499", "<=599".
func compileStatusMatcher(m string) (matcher, error) {
	if len(m) == 3 && m[0] >= '1' && m[0] <= '5' && m[1:] == "xx" {
		return matcher{op: "class", code: int(m[0]-'0') * 100}, nil
	}
	for _, op := range []string{">=", "<=", ">", "<"} {
		if rest, ok := strings.CutPrefix(m, op); ok {
			code, err := strconv.Atoi(rest)
			if err != nil || code < 100 || code > 599 {
				return matcher{}, fmt.Errorf("%q: comparison needs a status code 100..599", m)
			}
			return matcher{op: op, code: code}, nil
		}
	}
	code, err := strconv.Atoi(m)
	if err != nil || code < 100 || code > 599 {
		return matcher{}, fmt.Errorf("%q: must be an exact code (\"404\"), a class (\"4xx\") or a comparison (\">=500\")", m)
	}
	return matcher{op: "=", code: code}, nil
}

// Match reports whether an entry passes the filter. Semantics per field:
// match any positive matcher AND no negative matcher; a field with only
// negative matchers means "everything except". A field the entry does not
// carry (empty value / zero status) fails any positive requirement.
func (f *Filter) Match(e *Entry) bool {
	if f == nil {
		return true
	}
	for i := range f.fields {
		if !f.fields[i].match(e) {
			return false
		}
	}
	return true
}

func (ff *fieldFilter) match(e *Entry) bool {
	if ff.spec.kind == fieldStatus {
		status := e.F.Status
		for _, m := range ff.positive {
			if m.matchStatus(status) {
				return true
			}
		}
		return false
	}

	val, _ := e.Field(ff.name)
	if ff.spec.insensitive {
		val = strings.ToLower(val)
	}
	for _, m := range ff.negative {
		if m.matchString(val) {
			return false
		}
	}
	if len(ff.positive) == 0 {
		return true // only negatives = everything except
	}
	for _, m := range ff.positive {
		if m.matchString(val) {
			return true
		}
	}
	return false
}

func (m *matcher) matchStatus(status int) bool {
	switch m.op {
	case "=":
		return status == m.code
	case "class":
		return status >= m.code && status < m.code+100
	case ">=":
		return status >= m.code
	case "<=":
		return status <= m.code
	case ">":
		return status > m.code
	case "<":
		return status < m.code
	}
	return false
}

func (m *matcher) matchString(s string) bool {
	if m.literal != "" || len(m.segments) == 0 {
		return s == m.literal
	}
	return matchSegments(m.segments, s, m.crossSep)
}

// matchSegments matches literal segments joined by '*' wildcards against s.
// With crossSep false a wildcard must not skip over '/'.
func matchSegments(segs []string, s string, crossSep bool) bool {
	if len(segs) == 1 {
		return s == segs[0]
	}
	// Anchored prefix.
	if !strings.HasPrefix(s, segs[0]) {
		return false
	}
	s = s[len(segs[0]):]
	// Anchored suffix.
	last := segs[len(segs)-1]
	if !strings.HasSuffix(s, last) {
		return false
	}
	tail := s[:len(s)-len(last)]

	// Middle segments greedily left-to-right; the spans a '*' absorbs must not
	// contain '/' when crossSep is false.
	pos := 0
	for _, seg := range segs[1 : len(segs)-1] {
		idx := strings.Index(tail[pos:], seg)
		if idx < 0 {
			return false
		}
		if !crossSep && strings.Contains(tail[pos:pos+idx], "/") {
			return false
		}
		pos += idx + len(seg)
	}
	if !crossSep && strings.Contains(tail[pos:], "/") {
		return false
	}
	return true
}
