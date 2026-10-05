// Package httpcond evaluates conditional requests (spec §5.5, RFC 9110 §13)
// and parses Range headers (spec §5.4.2) with S3's behaviour.
package httpcond

import (
	"net/http"
	"strconv"
	"strings"
	"time"
)

// Result is the outcome of a precondition check.
type Result int

const (
	// Proceed means the request may run.
	Proceed Result = iota
	// NotModified is a 304 (GET/HEAD only).
	NotModified
	// Failed is a 412.
	Failed
)

// ParseETagList parses an If-Match / If-None-Match value into bare ETags
// (quotes and a weak prefix removed). "*" is returned as "*".
func ParseETagList(v string) []string {
	var out []string
	for _, p := range strings.Split(v, ",") {
		p = strings.TrimSpace(p)
		p = strings.TrimPrefix(p, "W/")
		if len(p) >= 2 && p[0] == '"' && p[len(p)-1] == '"' {
			p = p[1 : len(p)-1]
		}
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func anyMatch(list []string, etag string) bool {
	for _, c := range list {
		if c == "*" || c == etag {
			return true
		}
	}
	return false
}

// parseDate parses an HTTP-date header (three formats, RFC 9110 §5.6.7).
func parseDate(v string) (time.Time, bool) {
	t, err := http.ParseTime(v)
	return t, err == nil
}

// Evaluate checks the If-* headers of a GET or HEAD against an object with the
// given ETag (no quotes) and modification time, in RFC 9110 §13.2.2 order.
func Evaluate(h http.Header, etag string, modified time.Time) Result {
	mod := modified.UTC().Truncate(time.Second)
	if v := h.Get("If-Match"); v != "" {
		if !anyMatch(ParseETagList(v), etag) {
			return Failed
		}
	} else if v := h.Get("If-Unmodified-Since"); v != "" {
		if t, ok := parseDate(v); ok && mod.After(t) {
			return Failed
		}
	}
	if v := h.Get("If-None-Match"); v != "" {
		if anyMatch(ParseETagList(v), etag) {
			return NotModified
		}
	} else if v := h.Get("If-Modified-Since"); v != "" {
		if t, ok := parseDate(v); ok && !mod.After(t) {
			return NotModified
		}
	}
	return Proceed
}

// EvaluateCopy checks the x-amz-copy-source-if-* headers; a failed condition is
// a 412 (including a matching If-None-Match), as S3 answers (spec §5.5). The
// precedence is RFC 9110's, which S3 follows: If-Match decides over
// If-Unmodified-Since, and If-None-Match over If-Modified-Since.
func EvaluateCopy(h http.Header, etag string, modified time.Time) bool {
	mod := modified.UTC().Truncate(time.Second)
	if v := h.Get("x-amz-copy-source-if-match"); v != "" {
		if !anyMatch(ParseETagList(v), etag) {
			return false
		}
	} else if v := h.Get("x-amz-copy-source-if-unmodified-since"); v != "" {
		if t, ok := parseDate(v); ok && mod.After(t) {
			return false
		}
	}
	if v := h.Get("x-amz-copy-source-if-none-match"); v != "" {
		if anyMatch(ParseETagList(v), etag) {
			return false
		}
	} else if v := h.Get("x-amz-copy-source-if-modified-since"); v != "" {
		if t, ok := parseDate(v); ok && !mod.After(t) {
			return false
		}
	}
	return true
}

// RangeResult is the outcome of ParseRange.
type RangeResult int

const (
	// Whole: serve the full object with 200 (no Range, a malformed Range, or
	// several ranges, which S3 ignores).
	Whole RangeResult = iota
	// Partial: serve [Start, Start+Length) with 206.
	Partial
	// Unsatisfiable: 416 InvalidRange.
	Unsatisfiable
)

// Range is a satisfiable single byte range.
type Range struct {
	Start, Length int64
}

// End is the last byte position (inclusive).
func (r Range) End() int64 { return r.Start + r.Length - 1 }

// ParseRange interprets a Range header against an object of size bytes.
func ParseRange(header string, size int64) (Range, RangeResult) {
	whole := Range{0, size}
	header = strings.TrimSpace(header)
	if header == "" {
		return whole, Whole
	}
	const unit = "bytes="
	if len(header) < len(unit) || !strings.EqualFold(header[:len(unit)], unit) {
		return whole, Whole
	}
	spec := strings.TrimSpace(header[len(unit):])
	if spec == "" || strings.Contains(spec, ",") {
		return whole, Whole // several ranges: S3 returns the whole object
	}
	dash := strings.IndexByte(spec, '-')
	if dash < 0 {
		return whole, Whole
	}
	a, b := strings.TrimSpace(spec[:dash]), strings.TrimSpace(spec[dash+1:])
	switch {
	case a == "" && b == "": // "bytes=-"
		return whole, Whole
	case a == "": // suffix: last n bytes
		n, err := strconv.ParseInt(b, 10, 64)
		if err != nil || n < 0 {
			return whole, Whole
		}
		if n == 0 || size == 0 {
			return Range{}, Unsatisfiable
		}
		if n > size {
			n = size
		}
		return Range{size - n, n}, Partial
	default:
		start, err := strconv.ParseInt(a, 10, 64)
		if err != nil || start < 0 {
			return whole, Whole
		}
		end := int64(-1)
		if b != "" {
			end, err = strconv.ParseInt(b, 10, 64)
			if err != nil || end < start {
				return whole, Whole // invalid: ignored
			}
		}
		if start >= size {
			return Range{}, Unsatisfiable
		}
		if end < 0 || end >= size {
			end = size - 1
		}
		return Range{start, end - start + 1}, Partial
	}
}

// ParseCopyRange parses x-amz-copy-source-range ("bytes=a-b", both ends
// required) against a source of size bytes. ok=false means invalid (the caller
// answers InvalidArgument / InvalidRange).
func ParseCopyRange(v string, size int64) (Range, bool) {
	v = strings.TrimSpace(v)
	if !strings.HasPrefix(v, "bytes=") {
		return Range{}, false
	}
	parts := strings.SplitN(v[len("bytes="):], "-", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return Range{}, false
	}
	a, err1 := strconv.ParseInt(parts[0], 10, 64)
	b, err2 := strconv.ParseInt(parts[1], 10, 64)
	if err1 != nil || err2 != nil || a < 0 || b < a || a >= size {
		return Range{}, false
	}
	if b >= size {
		b = size - 1
	}
	return Range{a, b - a + 1}, true
}
