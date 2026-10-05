// Package keypat implements the key patterns of token grants (binvault spec
// §4.4, "Key patterns") and the {variable} templates of pipeline grants
// (§7.8, "Grants"); bucket tokens and pipeline tokens share the same grant
// model (§13.1).
//
// A pattern is literal text with an optional single trailing '*' that matches
// any suffix, '/' included; without the '*' it matches exactly one key. A
// literal '*' or '\' is written \* or \\. \{ and \} are also accepted (as '{'
// and '}'), so that a template stays a pattern once its variables are
// expanded. Any other backslash, a trailing lone backslash, and an unescaped
// '*' anywhere but the end are syntax errors.
//
// A template is a pattern that may also contain the variables {key}, {dir},
// {base}, {name} and {ext}. They are expanded for each triggering key with
// their values escaped, so a key containing '*' can never widen a grant.
package keypat

import (
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"
)

// Pattern is a parsed key pattern. The zero Pattern matches only the empty
// key, which never exists.
type Pattern struct {
	literal  string // unescaped
	wildcard bool   // a trailing '*'
}

// Parse parses a key pattern (§4.4). The empty string is rejected: a key is
// never empty, and "*" is the pattern for every key. Errors are plain errors
// for the admin API to report.
func Parse(s string) (Pattern, error) {
	if s == "" {
		return Pattern{}, errors.New("keypat: empty pattern")
	}
	var b strings.Builder
	b.Grow(len(s))
	for i := 0; i < len(s); i++ {
		switch c := s[i]; c {
		case '\\':
			if i+1 == len(s) {
				return Pattern{}, fmt.Errorf(`keypat: pattern %q ends in a lone '\' (write \\ for a literal '\')`, s)
			}
			if !escapable(s[i+1]) {
				return Pattern{}, fmt.Errorf(`keypat: pattern %q: invalid escape \%s (only \*, \\, \{ and \} are escapes)`, s, nextRune(s[i+1:]))
			}
			i++
			b.WriteByte(s[i])
		case '*':
			if i != len(s)-1 {
				return Pattern{}, fmt.Errorf(`keypat: pattern %q: '*' is allowed only at the end (write \* for a literal '*')`, s)
			}
			return Pattern{literal: b.String(), wildcard: true}, nil
		default:
			b.WriteByte(c)
		}
	}
	return Pattern{literal: b.String()}, nil
}

func escapable(c byte) bool { return c == '*' || c == '\\' || c == '{' || c == '}' }

func nextRune(s string) string {
	_, w := utf8.DecodeRuneInString(s)
	return s[:w]
}

// Match reports whether p covers key: equality for an exact pattern, a prefix
// match for a wildcard pattern.
func (p Pattern) Match(key string) bool {
	if p.wildcard {
		return strings.HasPrefix(key, p.literal)
	}
	return key == p.literal
}

// Prefix returns the literal part of p, unescaped: the whole key for an exact
// pattern, the text before the '*' for a wildcard pattern.
func (p Pattern) Prefix() string { return p.literal }

// HasWildcard reports whether p ends in '*'.
func (p Pattern) HasWildcard() bool { return p.wildcard }

// String returns p in canonical form: '*' and '\' escaped, nothing else, so
// Parse(p.String()) == p.
func (p Pattern) String() string {
	s := EscapeLiteral(p.literal)
	if p.wildcard {
		s += "*"
	}
	return s
}

// AllowsList reports whether a `list` grant with this pattern covers a listing
// with the given prefix: the request's prefix must start with the literal
// part of the pattern (§4.4). For an exact pattern that is the whole key, so
// only prefixes that start with it qualify; only "*" covers the empty prefix.
// The listing's results are still filtered to keys the grants match.
func (p Pattern) AllowsList(prefix string) bool {
	return strings.HasPrefix(prefix, p.literal)
}

// MatchAny reports whether some pattern covers key. No patterns cover nothing.
func MatchAny(patterns []Pattern, key string) bool {
	for _, p := range patterns {
		if p.Match(key) {
			return true
		}
	}
	return false
}

// EscapeLiteral escapes s so that it is matched literally inside a pattern:
// '*' becomes \* and '\' becomes \\.
func EscapeLiteral(s string) string {
	if !strings.ContainsAny(s, `*\`) {
		return s
	}
	var b strings.Builder
	b.Grow(len(s) + 4)
	for i := 0; i < len(s); i++ {
		if c := s[i]; c == '*' || c == '\\' {
			b.WriteByte('\\')
		}
		b.WriteByte(s[i])
	}
	return b.String()
}

// Template variables (§7.8).
var variables = map[string]bool{"key": true, "dir": true, "base": true, "name": true, "ext": true}

// sampleKey has a non-empty value for every variable.
const sampleKey = "photos/2026/a.b.png"

// ValidateTemplate checks a pipeline grant template (§7.8): known variables
// only, every '{' closed by a '}' (a literal brace is \{ or \}), valid escapes,
// '*' only at the end, and an expansion that parses as a pattern. A template
// without variables, such as "config/rules.json" or "*", is a plain pattern
// and valid. Errors are plain errors for the admin API to report.
func ValidateTemplate(tmpl string) error {
	parts, err := parseTemplate(tmpl)
	if err != nil {
		return err
	}
	expanded, _ := expandParts(parts, sampleKey)
	if _, err := Parse(expanded); err != nil {
		return fmt.Errorf("keypat: template %q: %w", tmpl, err)
	}
	return nil
}

// Expand expands a grant template for the triggering key and returns the
// resulting pattern in canonical form. For key "photos/2026/a.b.png":
//
//	{key}   photos/2026/a.b.png
//	{dir}   photos/2026 (everything before the last '/'; "" without a '/')
//	{base}  a.b.png     (everything after the last '/')
//	{name}  a.b         (base without its last extension)
//	{ext}   png         (the last extension, without the dot)
//
// A base without a dot, or whose only dots lead it (".bashrc"), has
// name = base and ext = "". Values are inserted escaped. For a key without a
// '/' the '/' right after {dir} is dropped, so "{dir}/{name}.webp" gives
// "a.webp" for "a.png"; a key such as "/a.png" keeps it ("/a.webp"), since
// its directory is the empty one before its '/'.
//
// ok is false when the grant must be dropped for this run: the pattern ends in
// '*' and a variable expanded to nothing (an empty {dir} in "thumbs/{dir}/*",
// an empty {base} in "derived/{base}*": what is left covers more than the key's
// own directory or name, up to the whole bucket), or the expansion is empty, or
// tmpl is invalid. A template that is literally "*" grants the whole bucket on
// purpose and expands to itself.
func Expand(tmpl, key string) (pattern string, ok bool) {
	parts, err := parseTemplate(tmpl)
	if err != nil {
		return "", false
	}
	expanded, empty := expandParts(parts, key)
	p, err := Parse(expanded)
	if err != nil {
		return "", false
	}
	if p.wildcard && empty {
		return "", false
	}
	return p.String(), true
}

// part is a piece of a template: static text (pattern syntax, escapes kept
// verbatim) or a variable.
type part struct {
	text string
	v    string // variable name, or "" for text
}

func parseTemplate(t string) ([]part, error) {
	if t == "" {
		return nil, errors.New("keypat: empty template")
	}
	var parts []part
	start := 0 // start of the pending text
	for i := 0; i < len(t); i++ {
		switch t[i] {
		case '\\':
			if i+1 == len(t) {
				return nil, fmt.Errorf(`keypat: template %q ends in a lone '\' (write \\ for a literal '\')`, t)
			}
			if !escapable(t[i+1]) {
				return nil, fmt.Errorf(`keypat: template %q: invalid escape \%s (only \*, \\, \{ and \} are escapes)`, t, nextRune(t[i+1:]))
			}
			i++
		case '*':
			if i != len(t)-1 {
				return nil, fmt.Errorf(`keypat: template %q: '*' is allowed only at the end (write \* for a literal '*')`, t)
			}
		case '{':
			end := strings.IndexByte(t[i+1:], '}')
			if end < 0 {
				return nil, fmt.Errorf(`keypat: template %q: '{' without '}' (write \{ for a literal '{')`, t)
			}
			name := t[i+1 : i+1+end]
			if !variables[name] {
				return nil, fmt.Errorf("keypat: template %q: unknown variable {%s} (known: {key} {dir} {base} {name} {ext})", t, name)
			}
			if start < i {
				parts = append(parts, part{text: t[start:i]})
			}
			parts = append(parts, part{v: name})
			i += 1 + end
			start = i + 1
		case '}':
			return nil, fmt.Errorf(`keypat: template %q: '}' without '{' (write \} for a literal '}')`, t)
		}
	}
	if start < len(t) {
		parts = append(parts, part{text: t[start:]})
	}
	return parts, nil
}

// expandParts substitutes the variables of parts for key; empty reports that
// some variable's value was the empty string.
func expandParts(parts []part, key string) (s string, empty bool) {
	v := splitKey(key)
	var b strings.Builder
	dropSlash := false
	for _, p := range parts {
		if p.v == "" {
			text := p.text
			if dropSlash {
				text = strings.TrimPrefix(text, "/")
			}
			b.WriteString(text)
			dropSlash = false
			continue
		}
		val := v.get(p.v)
		empty = empty || val == ""
		b.WriteString(EscapeLiteral(val))
		dropSlash = p.v == "dir" && !v.hasDir
	}
	return b.String(), empty
}

type keyVars struct {
	key, dir, base, name, ext string
	hasDir                    bool // the key contains a '/'
}

func splitKey(key string) keyVars {
	v := keyVars{key: key, base: key}
	if i := strings.LastIndexByte(key, '/'); i >= 0 {
		v.dir, v.base, v.hasDir = key[:i], key[i+1:], true
	}
	// The last extension, ignoring the dots that lead the base (".bashrc").
	lead := 0
	for lead < len(v.base) && v.base[lead] == '.' {
		lead++
	}
	v.name = v.base
	if i := strings.LastIndexByte(v.base[lead:], '.'); i >= 0 {
		v.name, v.ext = v.base[:lead+i], v.base[lead+i+1:]
	}
	return v
}

func (v keyVars) get(name string) string {
	switch name {
	case "key":
		return v.key
	case "dir":
		return v.dir
	case "base":
		return v.base
	case "name":
		return v.name
	case "ext":
		return v.ext
	}
	return ""
}
