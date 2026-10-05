package sigv4

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"net/http"
	"sort"
	"strings"
	"time"
)

// Algorithm is the only signing algorithm accepted, in the Authorization
// header, in X-Amz-Algorithm and in the x-amz-algorithm field of a POST form.
const Algorithm = "AWS4-HMAC-SHA256"

// Values of x-amz-content-sha256 other than a hex SHA-256 (spec §5.8).
const (
	UnsignedPayload                 = "UNSIGNED-PAYLOAD"
	StreamingPayload                = "STREAMING-AWS4-HMAC-SHA256-PAYLOAD"
	StreamingPayloadTrailer         = "STREAMING-AWS4-HMAC-SHA256-PAYLOAD-TRAILER"
	StreamingUnsignedPayloadTrailer = "STREAMING-UNSIGNED-PAYLOAD-TRAILER"
)

// EmptySHA256 is the hex SHA-256 of an empty payload.
const EmptySHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

const (
	// TimeFormat is the ISO 8601 basic format of x-amz-date and X-Amz-Date.
	TimeFormat = "20060102T150405Z"
	// DateFormat is the date of a credential scope.
	DateFormat = "20060102"
	// DefaultClockSkew is used when Options.ClockSkew is not positive
	// (the default of BINVAULT_CLOCK_SKEW).
	DefaultClockSkew = 15 * time.Minute
	// MaxPresignExpires is the largest X-Amz-Expires, in seconds (7 days).
	MaxPresignExpires = 604800
)

const (
	service    = "s3"
	terminator = "aws4_request"
	// maxRegion bounds the region of a credential scope. Any region is
	// accepted (spec §4.5), but no real one is anywhere near this long.
	maxRegion = 256
	// maxAccessKeyID bounds an access key id before it reaches the lookup.
	maxAccessKeyID = 128
)

// Kind is how a request presents credentials (spec §4.5).
type Kind int

const (
	// None: no credentials. Anonymous, or a POST Object form whose policy
	// signature is checked with VerifyPostPolicy.
	None Kind = iota
	// Header: Authorization: AWS4-HMAC-SHA256 ….
	Header
	// Presigned: SigV4 query parameters (X-Amz-Algorithm, …).
	Presigned
	// Bearer: Authorization: Bearer <access_key_id>.<secret>, the binvault
	// extension for pipeline tokens (see ParseBearer).
	Bearer
)

// String names the kind for logs.
func (k Kind) String() string {
	switch k {
	case None:
		return "none"
	case Header:
		return "header"
	case Presigned:
		return "presigned"
	case Bearer:
		return "bearer"
	}
	return "unknown"
}

// StreamMode is the aws-chunked variant announced by x-amz-content-sha256.
type StreamMode int

const (
	// StreamNone: the body is not aws-chunked (hex hash or UNSIGNED-PAYLOAD).
	StreamNone StreamMode = iota
	// StreamSigned: STREAMING-AWS4-HMAC-SHA256-PAYLOAD.
	StreamSigned
	// StreamSignedTrailer: STREAMING-AWS4-HMAC-SHA256-PAYLOAD-TRAILER.
	StreamSignedTrailer
	// StreamUnsignedTrailer: STREAMING-UNSIGNED-PAYLOAD-TRAILER.
	StreamUnsignedTrailer
)

// String names the mode for logs.
func (m StreamMode) String() string {
	switch m {
	case StreamNone:
		return "none"
	case StreamSigned:
		return "signed"
	case StreamSignedTrailer:
		return "signed-trailer"
	case StreamUnsignedTrailer:
		return "unsigned-trailer"
	}
	return "unknown"
}

// payloadMode classifies an x-amz-content-sha256 value; ok is false for a
// value S3 rejects.
func payloadMode(v string) (m StreamMode, ok bool) {
	switch v {
	case UnsignedPayload:
		return StreamNone, true
	case StreamingPayload:
		return StreamSigned, true
	case StreamingPayloadTrailer:
		return StreamSignedTrailer, true
	case StreamingUnsignedPayloadTrailer:
		return StreamUnsignedTrailer, true
	}
	return StreamNone, isHex(v, 64)
}

// SecretLookup returns the secret of an access key id. ok is false when the
// key is unknown, expired or revoked, which fails as InvalidAccessKeyId.
type SecretLookup func(accessKeyID string) (secret string, ok bool)

// Options tune verification.
type Options struct {
	// ClockSkew is BINVAULT_CLOCK_SKEW; DefaultClockSkew when not positive.
	ClockSkew time.Duration
	// Now is the clock; time.Now when nil.
	Now func() time.Time
	// Cache, when set, keeps derived signing keys (spec §4.5).
	Cache *KeyCache
}

func (o Options) skew() time.Duration {
	if o.ClockSkew <= 0 {
		return DefaultClockSkew
	}
	return o.ClockSkew
}

func (o Options) now() time.Time {
	if o.Now != nil {
		return o.Now()
	}
	return time.Now()
}

// Result is a verified SigV4 request.
type Result struct {
	AccessKeyID string
	// Region is the region the client signed for; any region is accepted.
	Region string
	// Date is the yyyymmdd of the credential scope.
	Date string
	// AmzDate is the request time (x-amz-date, Date or X-Amz-Date), UTC.
	AmzDate time.Time
	// Signature is the request's hex signature, the seed of the chunk
	// signatures of a streaming payload.
	Signature string
	// SigningKey is the derived key, needed to verify a streaming payload.
	SigningKey []byte
	// PayloadHash is the payload hash that was signed: the
	// x-amz-content-sha256 value of a header-signed request (a hex SHA-256,
	// UNSIGNED-PAYLOAD or a STREAMING-* value), and for a presigned request
	// UNSIGNED-PAYLOAD unless the URL itself carries a signed hash. When it is
	// hex the caller must compare it with the received body (case-insensitively)
	// and answer XAmzContentSHA256Mismatch; callers must use this field and
	// never the raw header.
	PayloadHash string
	// Stream is derived from PayloadHash.
	Stream StreamMode
	// Presigned is true for the query form.
	Presigned bool
	// Expires is AmzDate + X-Amz-Expires, presigned requests only.
	Expires time.Time
	// SignedHeaders are the lower-case names of the signed headers.
	SignedHeaders []string
}

// scope is the credential scope without the access key id.
func (r *Result) scope() string {
	return r.Date + "/" + r.Region + "/" + service + "/" + terminator
}

// amzDate is AmzDate in the string-to-sign format.
func (r *Result) amzDate() string {
	return r.AmzDate.UTC().Format(TimeFormat)
}

// Detect classifies the credentials of r. It fails when r mixes header and
// query authentication, uses a scheme other than AWS4-HMAC-SHA256 or Bearer
// (Signature V2, Basic, …), or carries Signature V2 query parameters. The query
// is read from r.URL.RawQuery.
func Detect(r *http.Request) (Kind, error) {
	q := ""
	if r.URL != nil {
		q = r.URL.RawQuery
	}
	return detect(r, q)
}

func detect(r *http.Request, rawQuery string) (Kind, error) {
	kind := None
	vals := r.Header.Values("Authorization")
	switch {
	case len(vals) > 1:
		return None, formHeader.malformed("more than one Authorization header.")
	case len(vals) == 1:
		scheme, _, _ := strings.Cut(vals[0], " ")
		switch {
		case vals[0] == "":
			return None, formHeader.malformed("the Authorization header is empty.")
		case scheme == Algorithm:
			kind = Header
		case strings.EqualFold(scheme, "Bearer"):
			kind = Bearer
		default:
			return None, errUnsupportedAuth()
		}
	}
	v4, v2 := queryAuth(rawQuery)
	switch {
	case (v4 || v2) && kind != None:
		return None, errMixedAuth()
	case v2:
		return None, errUnsupportedAuth()
	case v4:
		return Presigned, nil
	}
	return kind, nil
}

// queryAuth reports whether a raw query carries SigV4 presign parameters, or
// Signature V2 ones. Names are decoded leniently: this only classifies.
func queryAuth(raw string) (v4, v2 bool) {
	var v2Key, v2Sig bool
	for raw != "" {
		var seg string
		seg, raw, _ = strings.Cut(raw, "&")
		name, _, _ := strings.Cut(seg, "=")
		if strings.IndexByte(name, '%') >= 0 || strings.IndexByte(name, '+') >= 0 {
			if d, err := unescape(name, true); err == nil {
				name = d
			}
		}
		switch name {
		case "X-Amz-Algorithm", "X-Amz-Credential", "X-Amz-Signature":
			v4 = true
		case "AWSAccessKeyId":
			v2Key = true
		case "Signature":
			v2Sig = true
		}
	}
	return v4, v2Key && v2Sig
}

// PeekAccessKey returns the access key id a request claims, without
// verifying anything, so the caller can find the secret or route the request
// (spec §8.4): the Credential of the Authorization header, the X-Amz-Credential
// query parameter, or the key id part of a Bearer token. It returns "" and no
// error for a request without credentials. A malformed credential is
// AuthorizationHeaderMalformed or AuthorizationQueryParametersError; a
// malformed bearer token is InvalidAccessKeyId, like an unknown key.
func PeekAccessKey(r *http.Request) (string, error) {
	q := ""
	if r.URL != nil {
		q = r.URL.RawQuery
	}
	kind, err := detect(r, q)
	if err != nil {
		return "", err
	}
	switch kind {
	case Header:
		a, err := parseAuthorization(r.Header.Get("Authorization"))
		if err != nil {
			return "", err
		}
		c, err := parseCredential(a.credential, formHeader)
		if err != nil {
			return "", err
		}
		return c.accessKeyID, nil
	case Presigned:
		ps, err := parseQuery(q)
		if err != nil {
			return "", errInvalidURI()
		}
		v, n := lookupParam(ps, "X-Amz-Credential")
		if n != 1 {
			return "", formQuery.malformed(msgPresignParams)
		}
		c, err := parseCredential(v, formQuery)
		if err != nil {
			return "", err
		}
		return c.accessKeyID, nil
	case Bearer:
		akid, _, ok := ParseBearer(r)
		if !ok {
			return "", errInvalidAccessKeyID("")
		}
		return akid, nil
	}
	return "", nil
}

// ParseBearer splits `Authorization: Bearer <access_key_id>.<secret>` at the
// first '.'. ok is false unless there is exactly one Authorization header
// with the Bearer scheme and a token of RFC 6750 characters with both parts
// non-empty. It judges nothing: which keys may use the bearer form (pipeline
// tokens only, spec §4.5) is the caller's decision.
func ParseBearer(r *http.Request) (accessKeyID, secret string, ok bool) {
	vals := r.Header.Values("Authorization")
	if len(vals) != 1 {
		return "", "", false
	}
	scheme, tok, found := strings.Cut(vals[0], " ")
	if !found || !strings.EqualFold(scheme, "Bearer") {
		return "", "", false
	}
	tok = strings.TrimLeft(tok, " ")
	for i := 0; i < len(tok); i++ {
		c := tok[i]
		if !(unreserved(c) || c == '+' || c == '/' || c == '=') {
			return "", "", false
		}
	}
	akid, sec, found := strings.Cut(tok, ".")
	if !found || akid == "" || sec == "" {
		return "", "", false
	}
	return akid, sec, true
}

// authz is a parsed Authorization header.
type authz struct{ credential, signedHeaders, signature string }

func parseAuthorization(h string) (authz, error) {
	var a authz
	rest, ok := strings.CutPrefix(h, Algorithm)
	if !ok || !strings.HasPrefix(rest, " ") {
		return a, formHeader.malformed("the authorization header must start with " + Algorithm + ".")
	}
	rest = strings.TrimLeft(rest, " ")
	for rest != "" {
		var part string
		part, rest, _ = strings.Cut(rest, ",")
		part = strings.Trim(part, " ")
		if part == "" {
			continue
		}
		k, v, ok := strings.Cut(part, "=")
		if !ok {
			return a, formHeader.malformedf("the authorization component %q is malformed.", part)
		}
		var dst *string
		switch k {
		case "Credential":
			dst = &a.credential
		case "SignedHeaders":
			dst = &a.signedHeaders
		case "Signature":
			dst = &a.signature
		default:
			return a, formHeader.malformedf("the authorization component %q is not recognised.", k)
		}
		if *dst != "" {
			return a, formHeader.malformedf("the authorization component %q is repeated.", k)
		}
		*dst = v
	}
	if a.credential == "" || a.signedHeaders == "" || a.signature == "" {
		return a, formHeader.malformed("the authorization header requires three components: " +
			"Credential, SignedHeaders, and Signature.")
	}
	return a, nil
}

// credential is a parsed `<akid>/<yyyymmdd>/<region>/s3/aws4_request`.
type credential struct{ accessKeyID, date, region string }

func (c credential) scope() string {
	return c.date + "/" + c.region + "/" + service + "/" + terminator
}

func parseCredential(v string, f form) (credential, error) {
	var c credential
	parts := strings.SplitN(v, "/", 6)
	if len(parts) != 5 {
		return c, f.malformed(credentialShape)
	}
	c.accessKeyID, c.date, c.region = parts[0], parts[1], parts[2]
	if !validAccessKeyID(c.accessKeyID) {
		return c, f.malformed(credentialShape)
	}
	if !validDate(c.date) {
		return c, f.malformedf("invalid credential date %q.", c.date)
	}
	if !validRegion(c.region) {
		return c, f.malformedf("the region %q is not valid.", c.region)
	}
	if parts[3] != service {
		return c, f.malformedf("incorrect service %q. This endpoint belongs to %q.", parts[3], service)
	}
	if parts[4] != terminator {
		return c, f.malformedf("incorrect terminal %q. This endpoint uses %q.", parts[4], terminator)
	}
	return c, nil
}

func validAccessKeyID(s string) bool {
	if s == "" || len(s) > maxAccessKeyID {
		return false
	}
	for i := 0; i < len(s); i++ {
		if !unreserved(s[i]) {
			return false
		}
	}
	return true
}

// validRegion accepts any region except an empty, overlong or
// control-character one (spec §4.5: any region is used as signed).
func validRegion(s string) bool {
	if s == "" || len(s) > maxRegion {
		return false
	}
	for i := 0; i < len(s); i++ {
		if c := s[i]; c < 0x20 || c == 0x7f {
			return false
		}
	}
	return true
}

func validDate(s string) bool {
	if len(s) != 8 {
		return false
	}
	for i := 0; i < 8; i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	_, err := time.Parse(DateFormat, s)
	return err == nil
}

// parseAmzDate parses the ISO 8601 basic format strictly.
func parseAmzDate(s string) (time.Time, bool) {
	if len(s) != 16 || s[8] != 'T' || s[15] != 'Z' {
		return time.Time{}, false
	}
	for i := 0; i < 15; i++ {
		if i != 8 && (s[i] < '0' || s[i] > '9') {
			return time.Time{}, false
		}
	}
	t, err := time.Parse(TimeFormat, s)
	if err != nil {
		return time.Time{}, false
	}
	return t.UTC(), true
}

// parseSignedHeaders splits a SignedHeaders list, kept in the order given
// (the order the client signed them in). Names must be valid, lower-case (as
// SigV4 specifies; accepting other cases would let the header be altered
// without breaking the signature), distinct, and include host.
func parseSignedHeaders(v string, f form) ([]string, set, error) {
	if v == "" {
		return nil, nil, f.malformed("SignedHeaders is empty.")
	}
	names := strings.Split(v, ";")
	seen := make(set, len(names))
	for _, n := range names {
		if !isToken(n) || strings.ToLower(n) != n {
			return nil, nil, f.malformedf("SignedHeaders contains an invalid header name %q (names are lower-case).", n)
		}
		if _, dup := seen[n]; dup {
			return nil, nil, f.malformedf("SignedHeaders lists %q more than once.", n)
		}
		seen[n] = struct{}{}
	}
	if !seen.has("host") {
		return nil, nil, f.malformed("SignedHeaders must include host.")
	}
	return names, seen, nil
}

// set is a set of header names.
type set map[string]struct{}

func (s set) has(name string) bool {
	_, ok := s[name]
	return ok
}

// unsignedAmzHeaders lists the x-amz-* request headers that are not signed:
// S3 rejects those (AccessDenied, HeadersNotSigned), which keeps a presigned
// URL holder from adding x-amz-copy-source, x-amz-tagging, x-amz-meta-* and
// the like. x-amz-cf-id is added by CloudFront in front of an origin; the
// caller may exempt more names (x-amz-content-sha256 on header-signed
// requests, where its value is the payload line of the canonical request).
func unsignedAmzHeaders(r *http.Request, signed set, exempt string) string {
	var missing []string
	for name := range r.Header {
		lower := strings.ToLower(name)
		if !strings.HasPrefix(lower, "x-amz-") || lower == "x-amz-cf-id" || lower == exempt {
			continue
		}
		if !signed.has(lower) {
			missing = append(missing, lower)
		}
	}
	if len(missing) == 0 {
		return ""
	}
	sort.Strings(missing)
	return strings.Join(missing, ",")
}

// lookupParam returns the value of a decoded query parameter and how many
// times it occurs.
func lookupParam(ps []param, name string) (value string, n int) {
	for _, p := range ps {
		if p.name == name {
			if n == 0 {
				value = p.value
			}
			n++
		}
	}
	return value, n
}

// Verify checks a header-signed or presigned request. rawPath and rawQuery
// are the path and query exactly as sent (SplitRequestURI(r.RequestURI)),
// never r.URL.Path, which is already decoded. The host signed is r.Host,
// port included as the client sent it.
//
// Checks run in the order of failure S3 uses: a malformed request or
// credential (AuthorizationHeaderMalformed, or for the query form
// AuthorizationQueryParametersError; InvalidRequest/InvalidArgument for a
// missing or invalid x-amz-content-sha256; AccessDenied for a missing date or
// an unsigned x-amz-* header), then the key (InvalidAccessKeyId), then time
// (RequestTimeTooSkewed; AccessDenied "Request has expired"), then the
// signature (SignatureDoesNotMatch). A signing key is cached in opt.Cache only
// after its signature verified.
func Verify(r *http.Request, rawPath, rawQuery string, lookup SecretLookup, opt Options) (*Result, error) {
	kind, err := detect(r, rawQuery)
	if err != nil {
		return nil, err
	}
	switch kind {
	case Header:
		return verifyHeader(r, rawPath, rawQuery, lookup, opt)
	case Presigned:
		return verifyPresigned(r, rawPath, rawQuery, lookup, opt)
	}
	return nil, errNotSigned()
}

// requestTime finds the request time of a header-signed request: x-amz-date
// (ISO 8601 basic) wins over Date (HTTP-date). It returns the lower-case name
// of the header used, which must be signed.
func requestTime(r *http.Request) (time.Time, string, error) {
	if vals := r.Header.Values("X-Amz-Date"); len(vals) > 0 {
		if len(vals) > 1 {
			return time.Time{}, "", errNoDate()
		}
		t, ok := parseAmzDate(vals[0])
		if !ok {
			return time.Time{}, "", errNoDate()
		}
		return t, "x-amz-date", nil
	}
	if vals := r.Header.Values("Date"); len(vals) == 1 {
		t, err := http.ParseTime(vals[0])
		if err != nil {
			return time.Time{}, "", errNoDate()
		}
		return t.UTC(), "date", nil
	}
	return time.Time{}, "", errNoDate()
}

func verifyHeader(r *http.Request, rawPath, rawQuery string, lookup SecretLookup, opt Options) (*Result, error) {
	a, err := parseAuthorization(r.Header.Get("Authorization"))
	if err != nil {
		return nil, err
	}
	cred, err := parseCredential(a.credential, formHeader)
	if err != nil {
		return nil, err
	}
	signed, signedSet, err := parseSignedHeaders(a.signedHeaders, formHeader)
	if err != nil {
		return nil, err
	}
	t, dateHeader, err := requestTime(r)
	if err != nil {
		return nil, err
	}
	if !signedSet.has(dateHeader) {
		return nil, formHeader.malformedf("SignedHeaders must include %s.", dateHeader)
	}
	if day := t.Format(DateFormat); cred.date != day {
		return nil, formHeader.malformedf("invalid credential date %q. This date is not the same as the request date %q.",
			cred.date, day)
	}
	hashes := r.Header.Values("X-Amz-Content-Sha256")
	if len(hashes) == 0 {
		return nil, errMissingContentSHA256()
	}
	mode, ok := payloadMode(hashes[0])
	if !ok || len(hashes) > 1 {
		return nil, errBadContentSHA256()
	}
	if names := unsignedAmzHeaders(r, signedSet, "x-amz-content-sha256"); names != "" {
		return nil, errHeadersNotSigned(names)
	}
	uri, err := canonicalURI(rawPath)
	if err != nil {
		return nil, errInvalidURI()
	}
	ps, err := parseQuery(rawQuery)
	if err != nil {
		return nil, errInvalidURI()
	}

	secret, ok := lookup(cred.accessKeyID)
	if !ok {
		return nil, errInvalidAccessKeyID(cred.accessKeyID)
	}

	now := opt.now()
	if d := now.Sub(t); d > opt.skew() || -d > opt.skew() {
		return nil, errSkewed(t.Format(TimeFormat), now, opt.skew())
	}

	creq := canonicalRequest(r, r.Host, r.Method, uri, canonicalQuery(ps, ""), signed, hashes[0])
	res := &Result{
		AccessKeyID:   cred.accessKeyID,
		Region:        cred.region,
		Date:          cred.date,
		AmzDate:       t,
		PayloadHash:   hashes[0],
		Stream:        mode,
		SignedHeaders: signed,
	}
	if err := checkSignature(res, secret, creq, a.signature, opt.Cache); err != nil {
		return nil, err
	}
	return res, nil
}

// presignParams are the parameters every presigned request must carry once.
var presignParams = [...]string{
	"X-Amz-Algorithm", "X-Amz-Credential", "X-Amz-Date",
	"X-Amz-Expires", "X-Amz-SignedHeaders", "X-Amz-Signature",
}

func verifyPresigned(r *http.Request, rawPath, rawQuery string, lookup SecretLookup, opt Options) (*Result, error) {
	ps, err := parseQuery(rawQuery)
	if err != nil {
		return nil, errInvalidURI()
	}
	var v [len(presignParams)]string
	for i, name := range presignParams {
		val, n := lookupParam(ps, name)
		if n == 0 || val == "" {
			return nil, formQuery.malformed(msgPresignParams)
		}
		if n > 1 {
			return nil, formQuery.malformedf("%s must be given only once.", name)
		}
		v[i] = val
	}
	algorithm, credStr, dateStr, expStr, signedStr, signature := v[0], v[1], v[2], v[3], v[4], v[5]
	if algorithm != Algorithm {
		return nil, formQuery.malformed(`X-Amz-Algorithm only supports "` + Algorithm + `"`)
	}
	cred, err := parseCredential(credStr, formQuery)
	if err != nil {
		return nil, err
	}
	t, ok := parseAmzDate(dateStr)
	if !ok {
		return nil, formQuery.malformed(`X-Amz-Date must be in the ISO8601 Long Format "yyyyMMdd'T'HHmmss'Z'"`)
	}
	if day := t.Format(DateFormat); cred.date != day {
		return nil, formQuery.malformedf("Invalid credential date %q. This date is not the same as X-Amz-Date: %q.",
			cred.date, day)
	}
	expires, ok := parseExpires(expStr)
	if !ok {
		return nil, formQuery.malformedf("X-Amz-Expires must be an integer between 1 and %d (seconds).", MaxPresignExpires)
	}
	signed, signedSet, err := parseSignedHeaders(signedStr, formQuery)
	if err != nil {
		return nil, err
	}

	// The payload is unsigned unless the URL carries a hash (a signer that
	// hoisted x-amz-content-sha256 into the query) or signs the header.
	payload := UnsignedPayload
	if val, n := lookupParam(ps, "X-Amz-Content-Sha256"); n > 0 {
		if n > 1 {
			return nil, errBadContentSHA256()
		}
		payload = val
	} else if signedSet.has("x-amz-content-sha256") {
		hashes := r.Header.Values("X-Amz-Content-Sha256")
		if len(hashes) != 1 {
			return nil, errBadContentSHA256()
		}
		payload = hashes[0]
	}
	mode, ok := payloadMode(payload)
	if !ok {
		return nil, errBadContentSHA256()
	}
	if names := unsignedAmzHeaders(r, signedSet, ""); names != "" {
		return nil, errHeadersNotSigned(names)
	}
	uri, err := canonicalURI(rawPath)
	if err != nil {
		return nil, errInvalidURI()
	}

	secret, ok := lookup(cred.accessKeyID)
	if !ok {
		return nil, errInvalidAccessKeyID(cred.accessKeyID)
	}

	// Valid from its signing date (up to the skew early) until its own expiry,
	// however long ago it was signed (spec §4.5, §5.9).
	now := opt.now()
	if t.Sub(now) > opt.skew() {
		return nil, errSkewed(dateStr, now, opt.skew())
	}
	expiresAt := t.Add(time.Duration(expires) * time.Second)
	if now.After(expiresAt) {
		return nil, errExpired(expires, expiresAt, now)
	}

	creq := canonicalRequest(r, r.Host, r.Method, uri, canonicalQuery(ps, "X-Amz-Signature"), signed, payload)
	res := &Result{
		AccessKeyID:   cred.accessKeyID,
		Region:        cred.region,
		Date:          cred.date,
		AmzDate:       t,
		PayloadHash:   payload,
		Stream:        mode,
		Presigned:     true,
		Expires:       expiresAt,
		SignedHeaders: signed,
	}
	if err := checkSignature(res, secret, creq, signature, opt.Cache); err != nil {
		return nil, err
	}
	return res, nil
}

// parseExpires parses X-Amz-Expires: plain decimal digits, 1..MaxPresignExpires.
func parseExpires(s string) (int64, bool) {
	if s == "" || len(s) > 7 {
		return 0, false
	}
	var n int64
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return 0, false
		}
		n = n*10 + int64(s[i]-'0')
	}
	return n, n >= 1 && n <= MaxPresignExpires
}

// checkSignature computes the signature of a canonical request, compares it
// in constant time with the one provided, and on success fills res.Signature
// and res.SigningKey and caches the key.
func checkSignature(res *Result, secret, creq, provided string, cache *KeyCache) error {
	sts := stringToSign(res.amzDate(), res.scope(), creq)
	key, cached := cache.get(res.AccessKeyID, secret, res.Date, res.Region)
	if !cached {
		key = deriveKey(secret, res.Date, res.Region)
	}
	sig := hmacHex(key, sts)
	if subtle.ConstantTimeCompare([]byte(sig), []byte(provided)) != 1 {
		return errSignature(res.AccessKeyID, sts, provided, creq)
	}
	if !cached {
		cache.add(res.AccessKeyID, secret, res.Date, res.Region, key)
	}
	res.Signature = sig
	res.SigningKey = append([]byte(nil), key...)
	return nil
}

// stringToSign is the SigV4 string to sign of a canonical request.
func stringToSign(amzDate, scope, creq string) string {
	h := sha256.Sum256([]byte(creq))
	return Algorithm + "\n" + amzDate + "\n" + scope + "\n" + hex.EncodeToString(h[:])
}

// deriveKey derives the SigV4 signing key of a secret for a date and region.
func deriveKey(secret, date, region string) []byte {
	k := hmacSum([]byte("AWS4"+secret), date)
	k = hmacSum(k, region)
	k = hmacSum(k, service)
	return hmacSum(k, terminator)
}

func hmacSum(key []byte, data string) []byte {
	m := hmac.New(sha256.New, key)
	m.Write([]byte(data))
	return m.Sum(nil)
}

func hmacHex(key []byte, data string) string {
	return hex.EncodeToString(hmacSum(key, data))
}

func sha256Hex(b []byte) string {
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}
