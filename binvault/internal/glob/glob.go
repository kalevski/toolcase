// Package glob matches object keys against the glob patterns of pipeline
// filters, `match.keys` and `match.exclude_keys` (binvault spec §7.3; the
// definition format is §7.2, and §7.11 recommends excluding a pipeline's own
// output prefix).
//
// A pattern is matched against the whole key, byte-exact and case-sensitive
// (keys are never normalised, §3.7), with '/' as the only separator:
//
//	`*`      any run of characters except '/'
//	`**`     any run of characters, '/' included: "a**b" matches "a/x/b"
//	`**/`    at the start of the pattern or right after a '/': zero or more
//	         whole segments, so "**/*.jpg" also matches the top-level "a.jpg"
//	         and "a/**/b" also matches "a/b"
//	`?`      one character (one UTF-8 rune) except '/'
//	`[...]`  one character from a class: [abc], [a-z], or negated [!a-z] /
//	         [^a-z]; a class never matches '/'
//	`{a,b}`  alternatives, which may nest and contain any of the above; they
//	         are expanded textually before matching
//	`\c`     the character c itself
//
// A trailing "/**" covers everything below a prefix but not the prefix
// itself: "uploads/**" matches "uploads/" and "uploads/a/b", not "uploads".
//
// The syntax is doublestar's (github.com/bmatcuk/doublestar/v4), which also
// validates it, but matching is implemented here: doublestar.Match reads a
// "**" that is not a whole segment as "*", lets "x/**" match "x" but not
// "x/**/*" match "x/", and lets a class match '/', all of which differ from
// §7.3.
//
// Matching is linear in the key for each alternative (a set of reachable key
// positions is advanced token by token), so no pattern can backtrack
// exponentially.
package glob

import (
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/bmatcuk/doublestar/v4"
)

const (
	// maxLen is the longest pattern accepted, in bytes: the longest key (§3.8).
	maxLen = 1024
	// maxAlternatives bounds the brace expansion of one pattern.
	maxAlternatives = 256
)

var errTooMany = fmt.Errorf("more than %d alternatives once braces are expanded", maxAlternatives)

// Valid reports whether pattern is a well-formed glob. On top of
// doublestar.ValidatePattern (escapes complete, classes closed and non-empty,
// braces balanced) it requires a non-empty, valid UTF-8 pattern of at most
// 1024 bytes without NUL, ranges in ascending order, no '/' inside a class
// (a class never matches it), and at most 256 alternatives after brace
// expansion. Errors are plain errors for the admin API to report.
func Valid(pattern string) error {
	_, err := compile(pattern)
	return err
}

// Match reports whether name, a full object key, matches pattern. An invalid
// pattern matches nothing; check patterns with Valid when they are saved.
func Match(pattern, name string) bool {
	alts, err := compile(pattern)
	if err != nil {
		return false
	}
	cur := make([]bool, len(name)+1)
	next := make([]bool, len(name)+1)
	for _, toks := range alts {
		if matchTokens(toks, name, cur, next) {
			return true
		}
	}
	return false
}

// Set is a list of patterns, such as `match.keys` or `match.exclude_keys`.
type Set []string

// MatchAny reports whether name matches at least one pattern of s. An empty
// Set matches nothing: callers decide what an absent filter means (for
// `keys`, every key; for `exclude_keys`, none).
func (s Set) MatchAny(name string) bool {
	for _, p := range s {
		if Match(p, name) {
			return true
		}
	}
	return false
}

// Valid returns the error of the first invalid pattern in s, or nil. An empty
// Set is valid.
func (s Set) Valid() error {
	for _, p := range s {
		if err := Valid(p); err != nil {
			return err
		}
	}
	return nil
}

type kind uint8

const (
	kLit      kind = iota // literal text
	kOne                  // ?
	kClass                // [...]
	kStar                 // * — any run without '/'
	kAny                  // ** — any run, '/' included
	kSegments             // **/ at a segment start — "" or any run ending in '/'
)

type token struct {
	kind kind
	lit  string // kLit
	cls  class  // kClass
}

type runeRange struct{ lo, hi rune }

type class struct {
	negated bool
	ranges  []runeRange
}

func (c *class) matches(r rune) bool {
	if r == '/' {
		return false
	}
	for _, rg := range c.ranges {
		if rg.lo <= r && r <= rg.hi {
			return !c.negated
		}
	}
	return c.negated
}

// compile validates pattern and returns its brace-free alternatives as token
// lists.
func compile(pattern string) ([][]token, error) {
	alts, err := parse(pattern)
	if err != nil {
		return nil, fmt.Errorf("glob: invalid pattern %q: %w", pattern, err)
	}
	return alts, nil
}

func parse(p string) ([][]token, error) {
	switch {
	case p == "":
		return nil, errors.New("empty pattern")
	case len(p) > maxLen:
		return nil, fmt.Errorf("longer than %d bytes", maxLen)
	case !utf8.ValidString(p):
		return nil, errors.New("not valid UTF-8")
	case strings.IndexByte(p, 0) >= 0:
		return nil, errors.New("contains NUL")
	}
	texts, err := expand(p)
	if err != nil {
		return nil, err
	}
	// Our parser is at least as strict; this keeps the two in agreement.
	if !doublestar.ValidatePattern(p) {
		return nil, errors.New("malformed pattern")
	}
	alts := make([][]token, 0, len(texts))
	for _, t := range texts {
		toks, err := tokenize(t)
		if err != nil {
			return nil, err
		}
		alts = append(alts, toks)
	}
	return alts, nil
}

// expand expands the {…} alternatives of p textually; escapes and classes are
// copied as they are (a brace inside them is not an alternative).
func expand(p string) ([]string, error) {
	alts, _, err := expandSeq(p, 0, false)
	return alts, err
}

// expandSeq expands p from i to its end or, inside a group, to the ',' or '}'
// that ends the current alternative, whose index it returns.
func expandSeq(p string, i int, inGroup bool) ([]string, int, error) {
	alts := []string{""}
	start := i // start of the literal run not yet appended to alts
	flush := func(end int) {
		if end > start {
			for k := range alts {
				alts[k] += p[start:end]
			}
		}
	}
	for i < len(p) {
		switch p[i] {
		case '\\':
			if i+1 == len(p) {
				return nil, 0, errors.New(`trailing '\'`)
			}
			_, w := utf8.DecodeRuneInString(p[i+1:])
			i += 1 + w
		case '[':
			end, err := classEnd(p, i)
			if err != nil {
				return nil, 0, err
			}
			i = end
		case '{':
			flush(i)
			group, next, err := expandGroup(p, i+1)
			if err != nil {
				return nil, 0, err
			}
			if len(alts)*len(group) > maxAlternatives {
				return nil, 0, errTooMany
			}
			prod := make([]string, 0, len(alts)*len(group))
			for _, a := range alts {
				for _, g := range group {
					prod = append(prod, a+g)
				}
			}
			alts, i, start = prod, next, next
		case ',':
			if inGroup {
				flush(i)
				return alts, i, nil
			}
			i++ // a literal comma outside braces
		case '}':
			if !inGroup {
				return nil, 0, errors.New("'}' without '{'")
			}
			flush(i)
			return alts, i, nil
		default:
			i++
		}
	}
	if inGroup {
		return nil, 0, errors.New("'{' without '}'")
	}
	flush(i)
	return alts, i, nil
}

// expandGroup expands the alternatives of the group whose '{' precedes p[i]
// and returns the index just past its '}'.
func expandGroup(p string, i int) ([]string, int, error) {
	var out []string
	for {
		alts, end, err := expandSeq(p, i, true)
		if err != nil {
			return nil, 0, err
		}
		if out = append(out, alts...); len(out) > maxAlternatives {
			return nil, 0, errTooMany
		}
		if p[end] == '}' {
			return out, end + 1, nil
		}
		i = end + 1 // past ','
	}
}

// classEnd returns the index just past the class that opens at p[i] == '['.
func classEnd(p string, i int) (int, error) {
	j := i + 1
	if j < len(p) && (p[j] == '!' || p[j] == '^') {
		j++
	}
	if j < len(p) && p[j] == ']' {
		return 0, errors.New(`empty character class (write \] for a literal ']')`)
	}
	for j < len(p) {
		switch p[j] {
		case '\\':
			j += 2
		case ']':
			return j + 1, nil
		default:
			j++
		}
	}
	return 0, errors.New("'[' without ']'")
}

// tokenize turns one brace-free alternative into tokens. expand has already
// checked that escapes are complete and classes closed.
func tokenize(s string) ([]token, error) {
	var toks []token
	var lit []byte // pending literal, unescaped
	flush := func() {
		if len(lit) > 0 {
			toks = append(toks, token{kind: kLit, lit: string(lit)})
			lit = lit[:0]
		}
	}
	for i := 0; i < len(s); {
		switch c := s[i]; c {
		case '\\':
			_, w := utf8.DecodeRuneInString(s[i+1:])
			lit = append(lit, s[i+1:i+1+w]...)
			i += 1 + w
		case '?':
			flush()
			toks = append(toks, token{kind: kOne})
			i++
		case '[':
			flush()
			cls, end, err := parseClass(s, i)
			if err != nil {
				return nil, err
			}
			toks = append(toks, token{kind: kClass, cls: cls})
			i = end
		case '*':
			j := i
			for j < len(s) && s[j] == '*' {
				j++
			}
			if j-i == 1 {
				flush()
				toks = append(toks, token{kind: kStar})
				i = j
				break
			}
			// A run of two or more stars is "**". It stands for whole
			// segments when it starts a segment and a '/' follows it.
			segStart := len(lit) > 0 && lit[len(lit)-1] == '/' ||
				len(lit) == 0 && (len(toks) == 0 || toks[len(toks)-1].kind == kSegments)
			flush()
			slash := 0
			switch {
			case j < len(s) && s[j] == '/':
				slash = 1
			case j+1 < len(s) && s[j] == '\\' && s[j+1] == '/':
				slash = 2
			}
			if segStart && slash > 0 {
				toks = append(toks, token{kind: kSegments})
				i = j + slash
				break
			}
			toks = append(toks, token{kind: kAny})
			i = j
		default:
			lit = append(lit, c)
			i++
		}
	}
	flush()
	return toks, nil
}

// parseClass parses the class that opens at s[i] == '[' and returns it with
// the index just past its ']'. A '-' between two characters makes a range; a
// '-' first or last is literal.
func parseClass(s string, i int) (class, int, error) {
	var c class
	j := i + 1
	if s[j] == '!' || s[j] == '^' {
		c.negated = true
		j++
	}
	for s[j] != ']' || len(c.ranges) == 0 {
		var lo, hi rune
		lo, j = classRune(s, j)
		hi = lo
		if s[j] == '-' && s[j+1] != ']' {
			hi, j = classRune(s, j+1)
			if hi < lo {
				return class{}, 0, fmt.Errorf("character range %q-%q is reversed", lo, hi)
			}
		}
		if lo == '/' || hi == '/' {
			return class{}, 0, errors.New("a character class never matches '/'")
		}
		c.ranges = append(c.ranges, runeRange{lo, hi})
	}
	return c, j + 1, nil
}

func classRune(s string, j int) (rune, int) {
	if s[j] == '\\' {
		j++
	}
	r, w := utf8.DecodeRuneInString(s[j:])
	return r, j + w
}

// matchTokens reports whether toks match all of name. cur and next are
// scratch sets of reachable positions, len(name)+1 long.
func matchTokens(toks []token, name string, cur, next []bool) bool {
	clear(cur)
	cur[0] = true
	for _, t := range toks {
		clear(next)
		if !step(t, name, cur, next) {
			return false
		}
		cur, next = next, cur
	}
	return cur[len(name)]
}

// step marks in next every position of name reachable from a position in
// cur by consuming t, and reports whether there is any.
func step(t token, name string, cur, next []bool) bool {
	n := len(name)
	found := false
	mark := func(i int) { next[i], found = true, true }
	switch t.kind {
	case kLit:
		for i := 0; i+len(t.lit) <= n; i++ {
			if cur[i] && name[i:i+len(t.lit)] == t.lit {
				mark(i + len(t.lit))
			}
		}
	case kOne, kClass:
		for i := 0; i < n; i++ {
			if !cur[i] {
				continue
			}
			r, w := utf8.DecodeRuneInString(name[i:])
			if r == '/' || t.kind == kClass && !t.cls.matches(r) {
				continue
			}
			mark(i + w)
		}
	case kStar, kAny, kSegments:
		on := false // some earlier position in cur can reach this one
		for i := 0; ; {
			if cur[i] {
				on = true
				if t.kind == kSegments {
					mark(i) // zero segments
				}
			}
			if on && t.kind != kSegments {
				mark(i)
			}
			if i == n {
				break
			}
			r, w := utf8.DecodeRuneInString(name[i:])
			if r == '/' {
				switch t.kind {
				case kStar:
					on = false // '*' cannot cross a separator
				case kSegments:
					if on {
						mark(i + w) // a run ending in '/'
					}
				}
			}
			i += w
		}
	}
	return found
}
