package sigv4

import (
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"
)

// This file holds the canonical forms of SigV4 (S3 flavour): URI encoding,
// the canonical URI, the canonical query string and canonical header values.

const upperhex = "0123456789ABCDEF"

var errBadEscape = errors.New("sigv4: invalid percent-encoding")

// unreserved reports whether c is an RFC 3986 unreserved character, the only
// bytes SigV4 leaves unescaped.
func unreserved(c byte) bool {
	return 'A' <= c && c <= 'Z' || 'a' <= c && c <= 'z' || '0' <= c && c <= '9' ||
		c == '-' || c == '_' || c == '.' || c == '~'
}

// uriEncode percent-encodes every byte of s except the unreserved characters
// (and '/', unless encodeSlash), with upper-case hex: the UriEncode function of
// the SigV4 documentation.
func uriEncode(s string, encodeSlash bool) string {
	n := 0
	for i := 0; i < len(s); i++ {
		if c := s[i]; !unreserved(c) && (c != '/' || encodeSlash) {
			n++
		}
	}
	if n == 0 {
		return s
	}
	b := make([]byte, 0, len(s)+2*n)
	for i := 0; i < len(s); i++ {
		c := s[i]
		if unreserved(c) || (c == '/' && !encodeSlash) {
			b = append(b, c)
			continue
		}
		b = append(b, '%', upperhex[c>>4], upperhex[c&15])
	}
	return string(b)
}

// EncodeS3Path encodes a decoded S3 path (or key) the canonical way: every
// byte except A-Z a-z 0-9 - _ . ~ and '/' becomes %XX with upper-case hex. It
// is a single encoding with no normalisation, so "//", "." and ".." segments
// survive unchanged. An empty input stays empty (the canonical URI of an empty
// path is "/").
func EncodeS3Path(decodedPath string) string {
	return uriEncode(decodedPath, false)
}

// DecodeS3Path percent-decodes a raw request path once. A '+' is a literal
// plus sign (it means a space only in a query). A malformed escape is an
// error; the S3 answer to it is InvalidURI.
func DecodeS3Path(rawPath string) (string, error) {
	return unescape(rawPath, false)
}

// unescape decodes %XX escapes; with plusSpace, '+' decodes to a space (query
// strings).
func unescape(s string, plusSpace bool) (string, error) {
	escapes, plus := 0, false
	for i := 0; i < len(s); i++ {
		switch s[i] {
		case '%':
			if i+2 >= len(s) || unhex(s[i+1]) < 0 || unhex(s[i+2]) < 0 {
				return "", errBadEscape
			}
			escapes++
			i += 2
		case '+':
			plus = plus || plusSpace
		}
	}
	if escapes == 0 && !plus {
		return s, nil
	}
	// Each escape shrinks three bytes to one; a '+' stays one byte.
	b := make([]byte, 0, len(s)-2*escapes)
	for i := 0; i < len(s); i++ {
		switch c := s[i]; {
		case c == '%':
			b = append(b, byte(unhex(s[i+1])<<4|unhex(s[i+2])))
			i += 2
		case c == '+' && plusSpace:
			b = append(b, ' ')
		default:
			b = append(b, c)
		}
	}
	return string(b), nil
}

func unhex(c byte) int {
	switch {
	case '0' <= c && c <= '9':
		return int(c - '0')
	case 'a' <= c && c <= 'f':
		return int(c-'a') + 10
	case 'A' <= c && c <= 'F':
		return int(c-'A') + 10
	}
	return -1
}

// canonicalURI is the S3 canonical URI of a raw request path: decoded once,
// encoded once, "/" for an empty path.
func canonicalURI(rawPath string) (string, error) {
	if rawPath == "" {
		return "/", nil
	}
	p, err := DecodeS3Path(rawPath)
	if err != nil {
		return "", err
	}
	return EncodeS3Path(p), nil
}

// SplitRequestURI splits a request-target as received (http.Request.RequestURI)
// into the raw path and raw query that Verify expects. The absolute form
// ("http://host/path?q", sent through proxies) is reduced to its path; the
// fragment, which clients never send, is not treated specially.
func SplitRequestURI(requestURI string) (rawPath, rawQuery string) {
	if i := strings.Index(requestURI, "://"); i > 0 && isScheme(requestURI[:i]) {
		rest := requestURI[i+3:]
		j := strings.IndexAny(rest, "/?")
		if j < 0 {
			return "", ""
		}
		requestURI = rest[j:]
	}
	rawPath, rawQuery, _ = strings.Cut(requestURI, "?")
	return rawPath, rawQuery
}

// isScheme reports whether s is an RFC 3986 scheme.
func isScheme(s string) bool {
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case 'a' <= c && c <= 'z' || 'A' <= c && c <= 'Z':
		case i > 0 && ('0' <= c && c <= '9' || c == '+' || c == '-' || c == '.'):
		default:
			return false
		}
	}
	return s != ""
}

// param is one decoded query parameter.
type param struct{ name, value string }

// parseQuery splits a raw query on '&' and decodes each name and value ('+'
// is a space). Empty segments ("a=1&&b=2") are skipped; a segment without '='
// is a name with an empty value.
func parseQuery(raw string) ([]param, error) {
	var ps []param
	for raw != "" {
		var seg string
		seg, raw, _ = strings.Cut(raw, "&")
		if seg == "" {
			continue
		}
		n, v, _ := strings.Cut(seg, "=")
		dn, err := unescape(n, true)
		if err != nil {
			return nil, err
		}
		dv, err := unescape(v, true)
		if err != nil {
			return nil, err
		}
		ps = append(ps, param{dn, dv})
	}
	return ps, nil
}

// canonicalQuery is the canonical query string of ps: names and values
// re-encoded with the unreserved rule (space is %20), sorted by encoded name
// and then encoded value, joined as name=value with '&'. Parameters named
// skip (X-Amz-Signature for presigned requests) are left out.
func canonicalQuery(ps []param, skip string) string {
	if len(ps) == 0 {
		return ""
	}
	enc := make([]param, 0, len(ps))
	for _, p := range ps {
		if skip != "" && p.name == skip {
			continue
		}
		enc = append(enc, param{uriEncode(p.name, true), uriEncode(p.value, true)})
	}
	sort.Slice(enc, func(i, j int) bool {
		if enc[i].name != enc[j].name {
			return enc[i].name < enc[j].name
		}
		return enc[i].value < enc[j].value
	})
	var b strings.Builder
	for i, p := range enc {
		if i > 0 {
			b.WriteByte('&')
		}
		b.WriteString(p.name)
		b.WriteByte('=')
		b.WriteString(p.value)
	}
	return b.String()
}

// isSpace is ASCII whitespace as SDK signers collapse it in header values.
func isSpace(c byte) bool {
	return c == ' ' || c == '\t' || c == '\n' || c == '\v' || c == '\f' || c == '\r'
}

// trimAll trims leading and trailing whitespace and collapses each internal
// run of whitespace into one space (the "Trimall" of SigV4, as botocore, the
// Java and JS SDKs and S3-compatible servers apply it).
func trimAll(v string) string {
	i, j := 0, len(v)
	for i < j && isSpace(v[i]) {
		i++
	}
	for j > i && isSpace(v[j-1]) {
		j--
	}
	v = v[i:j]
	clean := true
	for k := 0; k < len(v); k++ {
		if isSpace(v[k]) && (v[k] != ' ' || (k+1 < len(v) && isSpace(v[k+1]))) {
			clean = false
			break
		}
	}
	if clean {
		return v
	}
	b := make([]byte, 0, len(v))
	space := false
	for k := 0; k < len(v); k++ {
		if isSpace(v[k]) {
			space = true
			continue
		}
		if space {
			b = append(b, ' ')
			space = false
		}
		b = append(b, v[k])
	}
	return string(b)
}

// headerValue is the canonical value of one signed header: every value of
// the header trimmed and joined with ','. host is the request's Host; Go
// keeps Transfer-Encoding out of the header map, so it is read from
// r.TransferEncoding. A signed header that is absent has an empty value.
func headerValue(r *http.Request, host, name string) string {
	var vals []string
	switch name {
	case "host":
		vals = []string{host}
	case "transfer-encoding":
		vals = r.Header.Values(name)
		if len(vals) == 0 {
			vals = r.TransferEncoding
		}
	default:
		vals = r.Header.Values(name)
	}
	switch len(vals) {
	case 0:
		return ""
	case 1:
		return trimAll(vals[0])
	}
	parts := make([]string, len(vals))
	for i, v := range vals {
		parts[i] = trimAll(v)
	}
	return strings.Join(parts, ",")
}

// isToken reports whether s is a non-empty RFC 9110 token (a valid header
// field name).
func isToken(s string) bool {
	if s == "" {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if 'a' <= c && c <= 'z' || 'A' <= c && c <= 'Z' || '0' <= c && c <= '9' {
			continue
		}
		if !strings.ContainsRune("!#$%&'*+-.^_`|~", rune(c)) {
			return false
		}
	}
	return true
}

// canonicalRequest assembles the canonical request of SigV4.
func canonicalRequest(r *http.Request, host, method, uri, query string, signed []string, payloadHash string) string {
	var b strings.Builder
	b.Grow(256)
	b.WriteString(method)
	b.WriteByte('\n')
	b.WriteString(uri)
	b.WriteByte('\n')
	b.WriteString(query)
	b.WriteByte('\n')
	for _, name := range signed {
		b.WriteString(name)
		b.WriteByte(':')
		b.WriteString(headerValue(r, host, name))
		b.WriteByte('\n')
	}
	b.WriteByte('\n')
	b.WriteString(strings.Join(signed, ";"))
	b.WriteByte('\n')
	b.WriteString(payloadHash)
	return b.String()
}

// isHex reports whether s is exactly n lower- or upper-case hex digits.
func isHex(s string, n int) bool {
	if len(s) != n {
		return false
	}
	for i := 0; i < len(s); i++ {
		if unhex(s[i]) < 0 {
			return false
		}
	}
	return true
}

// isLowerHex64 reports whether s is a SigV4 signature: 64 lower-case hex
// digits.
func isLowerHex64(s string) bool {
	if len(s) != 64 {
		return false
	}
	for i := 0; i < len(s); i++ {
		if c := s[i]; !('0' <= c && c <= '9' || 'a' <= c && c <= 'f') {
			return false
		}
	}
	return true
}

// itoa is strconv.FormatInt for the few places that need it.
func itoa(n int64) string { return strconv.FormatInt(n, 10) }
