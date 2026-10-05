package s3xml

import "strings"

const upperHex = "0123456789ABCDEF"

// EncodeKey returns key as S3 writes it in a listing requested with
// encoding-type=url, or key unchanged when urlEncode is false. It applies to
// Key, Prefix, Delimiter, Marker, NextMarker, StartAfter, KeyMarker and
// NextKeyMarker values and to common prefixes, never to continuation tokens or
// version ids.
//
// The bytes left alone are those S3 leaves alone: A-Z a-z 0-9 - _ . * and /.
// Every other byte, including '~', '+', '%', controls and each byte of a
// multi-byte UTF-8 sequence, becomes %XX (upper-case hex). Space is %20 rather
// than the '+' a form encoder would write, so the result decodes the same with
// botocore's unquote_plus, Go's url.QueryUnescape and url.PathUnescape, and
// JavaScript's decodeURIComponent. The result is plain ASCII and always valid
// XML.
func EncodeKey(key string, urlEncode bool) string {
	if !urlEncode {
		return key
	}
	n := 0
	for i := 0; i < len(key); i++ {
		if keyEscapes(key[i]) {
			n++
		}
	}
	if n == 0 {
		return key
	}
	b := make([]byte, 0, len(key)+2*n)
	for i := 0; i < len(key); i++ {
		c := key[i]
		if keyEscapes(c) {
			b = append(b, '%', upperHex[c>>4], upperHex[c&15])
		} else {
			b = append(b, c)
		}
	}
	return string(b)
}

func keyEscapes(c byte) bool {
	switch {
	case 'A' <= c && c <= 'Z', 'a' <= c && c <= 'z', '0' <= c && c <= '9':
		return false
	}
	switch c {
	case '-', '_', '.', '*', '/':
		return false
	}
	return true
}

// ETagQuoted returns the entity tag in its quoted wire form ("<hex>" or
// "<hex>-<N>" for a multipart object). An already quoted or weak (W/"…") tag
// is returned unchanged.
func ETagQuoted(etag string) string {
	if len(etag) >= 2 && etag[0] == '"' && etag[len(etag)-1] == '"' {
		return etag
	}
	if len(etag) >= 4 && strings.HasPrefix(etag, `W/"`) && etag[len(etag)-1] == '"' {
		return etag
	}
	return `"` + etag + `"`
}

// ETagUnquoted strips surrounding whitespace and one pair of double quotes, so
// the part ETags of a CompleteMultipartUpload body (sent quoted by most SDKs,
// bare by some) compare equal to the stored MD5 hex.
func ETagUnquoted(etag string) string {
	etag = strings.TrimSpace(etag)
	if len(etag) >= 2 && etag[0] == '"' && etag[len(etag)-1] == '"' {
		return etag[1 : len(etag)-1]
	}
	return etag
}
