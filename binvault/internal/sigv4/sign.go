package sigv4

import (
	"bytes"
	"errors"
	"net/http"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"
)

// The helpers in this file produce exactly what SDKs send, so that other
// packages can build signed requests and bodies in their tests. They share the
// canonicalisation code with verification; the vectors in this package's
// tests pin both to AWS's own results.

// Sign signs r in the header form, as an SDK would. It sets x-amz-date (now,
// in UTC) and x-amz-content-sha256 (payloadHash, used verbatim: a hex
// SHA-256, UNSIGNED-PAYLOAD or a STREAMING-* value) and then Authorization.
// The signed headers are host, x-amz-content-sha256 and x-amz-date plus the
// lower-case names in extraSigned, whose values are taken from r.Header. The
// host signed is r.Host, or r.URL.Host when that is empty. Signing
// content-length fills a missing Content-Length header from r.ContentLength,
// matching what net/http will send. The canonical URI is r.URL.EscapedPath()
// and the canonical query comes from r.URL.RawQuery, both as they go on the
// wire.
//
// The Result carries the seed signature and signing key that EncodeStream
// needs for an aws-chunked body.
func Sign(r *http.Request, accessKeyID, secret, region string, now time.Time, payloadHash string, extraSigned ...string) (*Result, error) {
	if r == nil || r.URL == nil {
		return nil, errors.New("sigv4: Sign needs a request with a URL")
	}
	host := r.Host
	if host == "" {
		host = r.URL.Host
	}
	if host == "" {
		return nil, errors.New("sigv4: Sign needs r.Host or r.URL.Host")
	}
	if payloadHash == "" {
		return nil, errors.New("sigv4: Sign needs a payload hash")
	}
	if r.Header == nil {
		r.Header = make(http.Header)
	}
	t := now.UTC().Truncate(time.Second)
	amzDate, date := t.Format(TimeFormat), t.Format(DateFormat)
	scope := date + "/" + region + "/" + service + "/" + terminator
	r.Header.Set("X-Amz-Date", amzDate)
	r.Header.Set("X-Amz-Content-Sha256", payloadHash)

	names := signedNames(extraSigned, "host", "x-amz-content-sha256", "x-amz-date")
	if slices.Contains(names, "content-length") && len(r.Header.Values("Content-Length")) == 0 {
		if r.ContentLength > 0 || r.ContentLength == 0 && r.Method != http.MethodGet && r.Method != http.MethodHead {
			r.Header.Set("Content-Length", strconv.FormatInt(r.ContentLength, 10))
		}
	}
	uri, err := canonicalURI(r.URL.EscapedPath())
	if err != nil {
		return nil, err
	}
	ps, err := parseQuery(r.URL.RawQuery)
	if err != nil {
		return nil, err
	}
	creq := canonicalRequest(r, host, r.Method, uri, canonicalQuery(ps, ""), names, payloadHash)
	key := deriveKey(secret, date, region)
	sig := hmacHex(key, stringToSign(amzDate, scope, creq))
	r.Header.Set("Authorization", Algorithm+" Credential="+accessKeyID+"/"+scope+
		", SignedHeaders="+strings.Join(names, ";")+", Signature="+sig)
	mode, _ := payloadMode(payloadHash)
	return &Result{
		AccessKeyID:   accessKeyID,
		Region:        region,
		Date:          date,
		AmzDate:       t,
		Signature:     sig,
		SigningKey:    key,
		PayloadHash:   payloadHash,
		Stream:        mode,
		SignedHeaders: names,
	}, nil
}

// signedNames merges base and extra header names: lower-cased, sorted,
// without duplicates or empty names.
func signedNames(extra []string, base ...string) []string {
	names := append([]string(nil), base...)
	for _, n := range extra {
		if n = strings.ToLower(strings.TrimSpace(n)); n != "" {
			names = append(names, n)
		}
	}
	sort.Strings(names)
	out := names[:0]
	for i, n := range names {
		if i == 0 || n != names[i-1] {
			out = append(out, n)
		}
	}
	return out
}

// Presign returns r's URL with the SigV4 query parameters added, as
// generate_presigned_url or getSignedUrl would: signed for host only, with
// UNSIGNED-PAYLOAD (or the value of an X-Amz-Content-Sha256 parameter already
// in r's query), valid for expires (whole seconds, 1..604800) from now.
// The host signed is r.Host, or r.URL.Host when that is empty; the returned
// URL is absolute (its host defaults to the signed host and its scheme to
// http).
func Presign(r *http.Request, accessKeyID, secret, region string, now time.Time, expires time.Duration) (string, error) {
	if r == nil || r.URL == nil {
		return "", errors.New("sigv4: Presign needs a request with a URL")
	}
	secs := int64(expires / time.Second)
	if expires%time.Second != 0 || secs < 1 || secs > MaxPresignExpires {
		return "", errors.New("sigv4: presign expiry must be whole seconds between 1 and 604800")
	}
	host := r.Host
	if host == "" {
		host = r.URL.Host
	}
	if host == "" {
		return "", errors.New("sigv4: Presign needs r.Host or r.URL.Host")
	}
	t := now.UTC()
	amzDate, date := t.Format(TimeFormat), t.Format(DateFormat)
	scope := date + "/" + region + "/" + service + "/" + terminator
	q := r.URL.RawQuery
	if q != "" {
		q += "&"
	}
	q += "X-Amz-Algorithm=" + Algorithm +
		"&X-Amz-Credential=" + uriEncode(accessKeyID+"/"+scope, true) +
		"&X-Amz-Date=" + amzDate +
		"&X-Amz-Expires=" + itoa(secs) +
		"&X-Amz-SignedHeaders=host"
	ps, err := parseQuery(q)
	if err != nil {
		return "", err
	}
	uri, err := canonicalURI(r.URL.EscapedPath())
	if err != nil {
		return "", err
	}
	payload := UnsignedPayload
	if v, n := lookupParam(ps, "X-Amz-Content-Sha256"); n == 1 {
		payload = v // a URL that pins its body's hash
	}
	creq := canonicalRequest(r, host, r.Method, uri, canonicalQuery(ps, "X-Amz-Signature"), []string{"host"}, payload)
	sig := hmacHex(deriveKey(secret, date, region), stringToSign(amzDate, scope, creq))
	u := *r.URL
	if u.Host == "" {
		u.Host = host
	}
	if u.Scheme == "" {
		u.Scheme = "http"
	}
	u.RawQuery = q + "&X-Amz-Signature=" + sig
	return u.String(), nil
}

// EncodeStream builds an aws-chunked body carrying payload in chunks of
// chunkSize bytes (64 KiB when <= 0), in the given mode, chained from the
// seed signature and signing key of res (from Sign; unused for
// StreamUnsignedTrailer). trailer holds the trailer headers of the trailer
// modes, such as {"x-amz-checksum-crc32": {"..."}}; names are lower-cased and
// written in sorted order, a name's values joined with ','. trailer is
// ignored for StreamSigned, and StreamNone returns a copy of payload. The
// request itself must announce the mode (x-amz-content-sha256), the
// x-amz-trailer names and x-amz-decoded-content-length.
func EncodeStream(res *Result, mode StreamMode, payload []byte, chunkSize int, trailer http.Header) []byte {
	if mode == StreamNone {
		return append([]byte(nil), payload...)
	}
	if res == nil {
		res = &Result{}
	}
	if chunkSize <= 0 {
		chunkSize = 64 << 10
	}
	signed := mode == StreamSigned || mode == StreamSignedTrailer
	amzDate, scope, prev := res.amzDate(), res.scope(), res.Signature
	var b bytes.Buffer
	b.Grow(len(payload) + (len(payload)/chunkSize+2)*96 + 256)
	chunk := func(data []byte) {
		b.WriteString(strconv.FormatInt(int64(len(data)), 16))
		if signed {
			prev = hmacHex(res.SigningKey, chunkAlgorithm+"\n"+amzDate+"\n"+scope+"\n"+prev+"\n"+
				EmptySHA256+"\n"+sha256Hex(data))
			b.WriteString(";chunk-signature=")
			b.WriteString(prev)
		}
		b.WriteString("\r\n")
		if len(data) > 0 {
			b.Write(data)
			b.WriteString("\r\n")
		}
	}
	for off := 0; off < len(payload); off += chunkSize {
		chunk(payload[off:min(off+chunkSize, len(payload))])
	}
	chunk(nil)
	if mode != StreamSigned {
		fields := trailerFields(trailer)
		for _, f := range fields {
			b.WriteString(f.name + ":" + f.value + "\r\n")
		}
		if mode == StreamSignedTrailer {
			sig := hmacHex(res.SigningKey, trailerStringToSign(amzDate, scope, prev, fields))
			b.WriteString(trailerSigName + ":" + sig + "\r\n")
		}
	}
	b.WriteString("\r\n")
	return b.Bytes()
}

// trailerFields flattens trailer headers to one sorted field per lower-case
// name.
func trailerFields(h http.Header) []trailerField {
	byName := map[string][]string{}
	for k, vs := range h {
		k = strings.ToLower(k)
		if k == trailerSigName {
			continue
		}
		byName[k] = append(byName[k], vs...)
	}
	fields := make([]trailerField, 0, len(byName))
	for k, vs := range byName {
		fields = append(fields, trailerField{k, strings.Join(vs, ",")})
	}
	sort.Slice(fields, func(i, j int) bool { return fields[i].name < fields[j].name })
	return fields
}

// SignPostPolicy signs a base64 POST Object policy and returns the
// x-amz-credential, x-amz-date and x-amz-signature form fields (the form also
// needs x-amz-algorithm set to Algorithm).
func SignPostPolicy(policyB64, accessKeyID, secret, region string, now time.Time) (credential, amzDate, signature string) {
	t := now.UTC()
	amzDate = t.Format(TimeFormat)
	date := t.Format(DateFormat)
	credential = accessKeyID + "/" + date + "/" + region + "/" + service + "/" + terminator
	signature = hmacHex(deriveKey(secret, date, region), policyB64)
	return credential, amzDate, signature
}
