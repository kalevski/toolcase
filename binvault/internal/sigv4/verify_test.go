package sigv4

import (
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

var tnow = time.Date(2025, 1, 15, 12, 34, 56, 0, time.UTC)

const testScope = "20250115/us-east-1/s3/aws4_request"

// signed returns a server-side request signed with Sign at ts; the extra
// headers (name, value pairs) are signed too.
func signed(t *testing.T, method, uri, akid, secret, region string, ts time.Time, payload string, headers ...string) *http.Request {
	t.Helper()
	r := serverRequest(method, "bucket.localhost:9000", uri, headers...)
	var extra []string
	for i := 0; i+1 < len(headers); i += 2 {
		extra = append(extra, strings.ToLower(headers[i]))
	}
	if _, err := Sign(r, akid, secret, region, ts, payload, extra...); err != nil {
		t.Fatal(err)
	}
	return r
}

// noLookup fails the test if verification gets as far as the key lookup.
func noLookup(t *testing.T) SecretLookup {
	return func(string) (string, bool) {
		t.Helper()
		t.Fatal("the key was looked up before the request was found malformed")
		return "", false
	}
}

// withURI returns a copy of r with another request-target (same headers).
func withURI(r *http.Request, uri string) *http.Request {
	c := serverRequest(r.Method, r.Host, uri)
	c.Header = r.Header.Clone()
	return c
}

func TestVerifyHeaderRoundTrip(t *testing.T) {
	regions := []string{"us-east-1", "auto", "garage", "eu-weird_region.9", "région", strings.Repeat("r", 200)}
	keys := []string{
		"plain.txt", "dir with space/file name.txt", "ünïcødé/日本語/😀", "a+b c", "100%", "tilde~star*",
		"//double//slash", "../dot/./segments/..", "trailing/", "?#[]@!$&'()*+,;=", "\x7f\x01ctl",
	}
	for _, region := range regions {
		for _, key := range keys {
			canonical := "/bucket/" + EncodeS3Path(key)
			r := signed(t, "PUT", canonical, bvAKID, bvSecret, region, tnow, UnsignedPayload)
			res, err := verify(r, awsKeys, at(tnow))
			if err != nil {
				t.Fatalf("region %q key %q: %v", region, key, err)
			}
			if res.Region != region || res.AccessKeyID != bvAKID || res.PayloadHash != UnsignedPayload || res.Date != "20250115" {
				t.Fatalf("result %+v", res)
			}
			// Another wire spelling of the same key verifies too, while a
			// normalised path does not: no dot-segment removal, "//" kept.
			alt := "/bucket/" + strings.ReplaceAll(url.PathEscape(key), "~", "%7e")
			if _, err := verify(withURI(r, alt), awsKeys, at(tnow)); err != nil {
				t.Fatalf("key %q sent as %q: %v", key, alt, err)
			}
		}
	}
	r := signed(t, "GET", "/bucket//x/../y", bvAKID, bvSecret, "us-east-1", tnow, EmptySHA256)
	wantCode(t, mustErr(verify(r, awsKeys, at(tnow))), "")
	_, err := verify(withURI(r, "/bucket/y"), awsKeys, at(tnow))
	wantCode(t, err, "SignatureDoesNotMatch")
	_, err = verify(withURI(r, "/bucket/x/../y"), awsKeys, at(tnow))
	wantCode(t, err, "SignatureDoesNotMatch")
}

func mustErr(_ *Result, err error) error { return err }

func TestVerifyHeaderQuery(t *testing.T) {
	queries := []string{
		"prefix=a+b&list-type=2",
		"a=2&a=1&a=1&b=&c&d=%2B&e=%20",
		"uploads",
		"versionId=3%2FL4kq%2BrmSpX&response-content-disposition=attachment%3B%20filename%3D%22x%20y%22",
		"&&x=1&",
		"%E2%9C%93=%E2%9C%93&~=~",
	}
	for _, q := range queries {
		r := signed(t, "GET", "/bucket?"+q, bvAKID, bvSecret, "auto", tnow, EmptySHA256)
		if _, err := verify(r, awsKeys, at(tnow)); err != nil {
			t.Fatalf("query %q: %v", q, err)
		}
	}
	// '+' is a space: these spell the same query.
	r := signed(t, "GET", "/bucket?prefix=a+b", bvAKID, bvSecret, "auto", tnow, EmptySHA256)
	for _, q := range []string{"prefix=a%20b", "prefix=a%20b&", "prefix=a+b"} {
		if _, err := verify(withURI(r, "/bucket?"+q), awsKeys, at(tnow)); err != nil {
			t.Fatalf("%q: %v", q, err)
		}
	}
	for _, q := range []string{"prefix=a%2Bb", "prefix=ab", "prefix=a+b&extra", ""} {
		_, err := verify(withURI(r, "/bucket?"+q), awsKeys, at(tnow))
		wantCode(t, err, "SignatureDoesNotMatch")
	}
}

func TestVerifyHeaderFailures(t *testing.T) {
	r := signed(t, "PUT", "/bucket/k", bvAKID, "wrong-secret", "us-east-1", tnow, UnsignedPayload)
	e := wantCode(t, mustErr(verify(r, awsKeys, at(tnow))), "SignatureDoesNotMatch")
	if e.Status != 403 || !strings.HasPrefix(e.Extra["CanonicalRequest"], "PUT\n/bucket/k\n") ||
		!strings.HasPrefix(e.Extra["StringToSign"], Algorithm+"\n20250115T123456Z\n"+testScope+"\n") ||
		e.Extra["AWSAccessKeyId"] != bvAKID {
		t.Fatalf("error %+v", e)
	}

	r = signed(t, "PUT", "/bucket/k", "BVKUNKNOWNUNKNOWNUNK", bvSecret, "us-east-1", tnow, UnsignedPayload)
	if e := wantCode(t, mustErr(verify(r, awsKeys, at(tnow))), "InvalidAccessKeyId"); e.Status != 403 {
		t.Fatal(e)
	}

	// Tampering with anything signed.
	base := func() *http.Request {
		return signed(t, "PUT", "/bucket/k?x=1", bvAKID, bvSecret, "us-east-1", tnow, EmptySHA256,
			"Content-Type", "text/plain", "X-Amz-Meta-A", "1")
	}
	tamper := map[string]func(r *http.Request) *http.Request{
		"method":  func(r *http.Request) *http.Request { r.Method = "POST"; return r },
		"host":    func(r *http.Request) *http.Request { r.Host = "other:9000"; return r },
		"path":    func(r *http.Request) *http.Request { return withURI(r, "/bucket/K?x=1") },
		"query":   func(r *http.Request) *http.Request { return withURI(r, "/bucket/k?x=2") },
		"header":  func(r *http.Request) *http.Request { r.Header.Set("Content-Type", "text/html"); return r },
		"meta":    func(r *http.Request) *http.Request { r.Header.Set("X-Amz-Meta-A", "2"); return r },
		"payload": func(r *http.Request) *http.Request { r.Header.Set("X-Amz-Content-Sha256", UnsignedPayload); return r },
		"date": func(r *http.Request) *http.Request {
			r.Header.Set("X-Amz-Date", "20250115T123457Z")
			return r
		},
		"signature": func(r *http.Request) *http.Request {
			a := r.Header.Get("Authorization")
			r.Header.Set("Authorization", a[:len(a)-1]+string("0123456789abcdef"[(unhex(a[len(a)-1])+1)%16]))
			return r
		},
		"uppercase signature": func(r *http.Request) *http.Request {
			a := r.Header.Get("Authorization")
			i := strings.Index(a, "Signature=") + len("Signature=")
			r.Header.Set("Authorization", a[:i]+strings.ToUpper(a[i:]))
			return r
		},
	}
	for name, f := range tamper {
		_, err := verify(f(base()), awsKeys, at(tnow))
		if err == nil {
			t.Fatalf("%s: tampered request verified", name)
		}
		wantCode(t, err, "SignatureDoesNotMatch")
	}
	if _, err := verify(base(), awsKeys, at(tnow)); err != nil {
		t.Fatal(err)
	}
}

func TestVerifyClockSkew(t *testing.T) {
	r := signed(t, "GET", "/bucket/k", bvAKID, bvSecret, "us-east-1", tnow, EmptySHA256)
	tests := []struct {
		now  time.Time
		skew time.Duration
		code string
	}{
		{tnow, 0, ""},
		{tnow.Add(15 * time.Minute), 0, ""},
		{tnow.Add(-15 * time.Minute), 0, ""},
		{tnow.Add(15*time.Minute + time.Second), 0, "RequestTimeTooSkewed"},
		{tnow.Add(-15*time.Minute - time.Second), 0, "RequestTimeTooSkewed"},
		{tnow.Add(time.Minute), time.Minute, ""},
		{tnow.Add(61 * time.Second), time.Minute, "RequestTimeTooSkewed"},
		{tnow.Add(-61 * time.Second), time.Minute, "RequestTimeTooSkewed"},
		{tnow.Add(-time.Hour), -time.Second, "RequestTimeTooSkewed"},
	}
	for _, tc := range tests {
		opt := at(tc.now)
		opt.ClockSkew = tc.skew
		_, err := verify(r, awsKeys, opt)
		if e := wantCode(t, err, tc.code); e != nil {
			if e.Status != 403 || e.Extra["RequestTime"] != "20250115T123456Z" || e.Extra["ServerTime"] == "" ||
				e.Extra["MaxAllowedSkewMilliseconds"] == "" {
				t.Fatalf("error %+v", e)
			}
		}
	}
	// Unknown keys fail before the clock is consulted.
	r = signed(t, "GET", "/bucket/k", "BVKNOBODY", bvSecret, "us-east-1", tnow, EmptySHA256)
	wantCode(t, mustErr(verify(r, awsKeys, at(tnow.Add(time.Hour)))), "InvalidAccessKeyId")
}

// rawSigned builds a header-signed request by hand, for shapes Sign never
// produces. The canonical request uses names in signedList order.
func rawSigned(t *testing.T, method, uri, signedList, scope, amzDate, secret string, headers ...string) *http.Request {
	t.Helper()
	r := serverRequest(method, "bucket.localhost:9000", uri, headers...)
	p, q := SplitRequestURI(uri)
	cu, err := canonicalURI(p)
	if err != nil {
		t.Fatal(err)
	}
	ps, _ := parseQuery(q)
	names := strings.Split(signedList, ";")
	creq := canonicalRequest(r, r.Host, method, cu, canonicalQuery(ps, ""), names, r.Header.Get("X-Amz-Content-Sha256"))
	parts := strings.Split(scope, "/")
	sig := hmacHex(deriveKey(secret, parts[0], parts[1]), stringToSign(amzDate, scope, creq))
	r.Header.Set("Authorization", authHeader(bvAKID, scope, signedList, sig))
	return r
}

func TestVerifyDateHeaders(t *testing.T) {
	// Date (HTTP-date) instead of x-amz-date.
	r := rawSigned(t, "GET", "/bucket/k", "date;host;x-amz-content-sha256", testScope, "20250115T123456Z", bvSecret,
		"Date", "Wed, 15 Jan 2025 12:34:56 GMT", "X-Amz-Content-Sha256", EmptySHA256)
	res, err := verify(r, awsKeys, at(tnow))
	wantCode(t, err, "")
	if !res.AmzDate.Equal(tnow) {
		t.Fatalf("time %v", res.AmzDate)
	}
	// The header the time comes from must be signed.
	r = rawSigned(t, "GET", "/bucket/k", "host;x-amz-content-sha256", testScope, "20250115T123456Z", bvSecret,
		"Date", "Wed, 15 Jan 2025 12:34:56 GMT", "X-Amz-Content-Sha256", EmptySHA256)
	wantCode(t, mustErr(verify(r, noLookup(t), at(tnow))), "AuthorizationHeaderMalformed")
	r = rawSigned(t, "GET", "/bucket/k", "date;host;x-amz-content-sha256", testScope, "20250115T123456Z", bvSecret,
		"Date", "Wed, 15 Jan 2025 12:34:56 GMT", "X-Amz-Date", "20250115T123456Z", "X-Amz-Content-Sha256", EmptySHA256)
	wantCode(t, mustErr(verify(r, noLookup(t), at(tnow))), "AuthorizationHeaderMalformed")

	for _, h := range [][]string{
		{},
		{"X-Amz-Date", "2025-01-15T12:34:56Z"},
		{"X-Amz-Date", "20250115T123456"},
		{"X-Amz-Date", "20250115T12345Z6"},
		{"X-Amz-Date", "20251315T123456Z"},
		{"X-Amz-Date", ""},
		{"X-Amz-Date", "20250115T123456Z", "X-Amz-Date", "20250115T123456Z"},
		{"Date", "yesterday"},
	} {
		hs := append([]string{"X-Amz-Content-Sha256", EmptySHA256}, h...)
		r := serverRequest("GET", "bucket.localhost:9000", "/bucket/k", hs...)
		r.Header.Set("Authorization", authHeader(bvAKID, testScope, "date;host;x-amz-content-sha256;x-amz-date", strings.Repeat("0", 64)))
		e := wantCode(t, mustErr(verify(r, noLookup(t), at(tnow))), "AccessDenied")
		if !strings.Contains(e.Message, "valid Date or x-amz-date") {
			t.Fatalf("%v: %s", h, e.Message)
		}
	}
}

func TestVerifyMalformedAuthorization(t *testing.T) {
	good := signed(t, "GET", "/bucket/k", bvAKID, bvSecret, "us-east-1", tnow, EmptySHA256)
	auth := good.Header.Get("Authorization")
	sh := "host;x-amz-content-sha256;x-amz-date"
	sig := auth[strings.Index(auth, "Signature=")+len("Signature="):]
	tests := map[string]string{
		"no components":        "AWS4-HMAC-SHA256 ",
		"credential only":      "AWS4-HMAC-SHA256 Credential=" + bvAKID + "/" + testScope,
		"missing signature":    "AWS4-HMAC-SHA256 Credential=" + bvAKID + "/" + testScope + ", SignedHeaders=" + sh,
		"empty signature":      "AWS4-HMAC-SHA256 Credential=" + bvAKID + "/" + testScope + ", SignedHeaders=" + sh + ", Signature=",
		"repeated component":   auth + ", Signature=" + sig,
		"unknown component":    auth + ", Foo=bar",
		"component without =":  "AWS4-HMAC-SHA256 Credential=" + bvAKID + "/" + testScope + ", SignedHeaders, Signature=" + sig,
		"lower-case component": strings.Replace(auth, "Credential=", "credential=", 1),
		"short credential":     strings.Replace(auth, "/aws4_request", "", 1),
		"long credential":      strings.Replace(auth, "/aws4_request", "/aws4_request/x", 1),
		"wrong service":        strings.Replace(auth, "/s3/", "/ec2/", 1),
		"wrong terminator":     strings.Replace(auth, "aws4_request", "aws4_requests", 1),
		"empty access key":     strings.Replace(auth, bvAKID, "", 1),
		"odd access key":       strings.Replace(auth, bvAKID, "BVK"+"\x00"+"X", 1),
		"bad date":             strings.Replace(auth, "/20250115/", "/20251315/", 1),
		"short date":           strings.Replace(auth, "/20250115/", "/2025011/", 1),
		"other date":           strings.Replace(auth, "/20250115/", "/20250116/", 1),
		"empty region":         strings.Replace(auth, "/us-east-1/", "//", 1),
		"control in region":    strings.Replace(auth, "/us-east-1/", "/us\x01east/", 1),
		"no host signed":       strings.Replace(auth, "SignedHeaders=host;", "SignedHeaders=", 1),
		"empty signed header":  strings.Replace(auth, "host;", "host;;", 1),
		"duplicate signed":     strings.Replace(auth, "host;", "host;host;", 1),
		"bad signed name":      strings.Replace(auth, "host;", "ho st;", 1),
		"upper-case signed":    strings.Replace(auth, "host;x-amz-content-sha256", "host;X-Amz-Content-Sha256", 1),
		"x-amz-date unsigned":  strings.Replace(auth, ";x-amz-date", "", 1),
	}
	for name, a := range tests {
		r := serverRequest("GET", "bucket.localhost:9000", "/bucket/k",
			"X-Amz-Date", "20250115T123456Z", "X-Amz-Content-Sha256", EmptySHA256, "Authorization", a)
		e := wantCode(t, mustErr(verify(r, noLookup(t), at(tnow))), "AuthorizationHeaderMalformed")
		if e.Status != 400 {
			t.Fatalf("%s: status %d", name, e.Status)
		}
	}
	// Every component is checked; a correct header passes.
	wantCode(t, mustErr(verify(good, awsKeys, at(tnow))), "")
}

func TestVerifyPayloadHashHeader(t *testing.T) {
	r := signed(t, "PUT", "/bucket/k", bvAKID, bvSecret, "us-east-1", tnow, UnsignedPayload)
	r.Header.Del("X-Amz-Content-Sha256")
	e := wantCode(t, mustErr(verify(r, noLookup(t), at(tnow))), "InvalidRequest")
	if !strings.Contains(e.Message, "x-amz-content-sha256") {
		t.Fatal(e.Message)
	}
	for _, v := range []string{"abc", strings.Repeat("g", 64), strings.Repeat("a", 63), "STREAMING-AWS4-ECDSA-P256-SHA256-PAYLOAD", "unsigned-payload", ""} {
		r := signed(t, "PUT", "/bucket/k", bvAKID, bvSecret, "us-east-1", tnow, UnsignedPayload)
		r.Header.Set("X-Amz-Content-Sha256", v)
		wantCode(t, mustErr(verify(r, noLookup(t), at(tnow))), "InvalidArgument")
	}
	r = signed(t, "PUT", "/bucket/k", bvAKID, bvSecret, "us-east-1", tnow, UnsignedPayload)
	r.Header.Add("X-Amz-Content-Sha256", UnsignedPayload)
	wantCode(t, mustErr(verify(r, noLookup(t), at(tnow))), "InvalidArgument")

	modes := map[string]StreamMode{
		UnsignedPayload:                 StreamNone,
		EmptySHA256:                     StreamNone,
		strings.ToUpper(EmptySHA256):    StreamNone,
		StreamingPayload:                StreamSigned,
		StreamingPayloadTrailer:         StreamSignedTrailer,
		StreamingUnsignedPayloadTrailer: StreamUnsignedTrailer,
	}
	for v, mode := range modes {
		r := signed(t, "PUT", "/bucket/k", bvAKID, bvSecret, "us-east-1", tnow, v)
		res, err := verify(r, awsKeys, at(tnow))
		wantCode(t, err, "")
		if res.Stream != mode || res.PayloadHash != v {
			t.Fatalf("%s: %+v", v, res)
		}
	}
}

func TestVerifyUnsignedAmzHeaders(t *testing.T) {
	r := signed(t, "PUT", "/bucket/k", bvAKID, bvSecret, "us-east-1", tnow, UnsignedPayload, "X-Amz-Meta-A", "1")
	r.Header.Set("X-Amz-Cf-Id", "added-by-cloudfront")
	r.Header.Set("User-Agent", "not signed, not x-amz")
	wantCode(t, mustErr(verify(r, awsKeys, at(tnow))), "")

	r.Header.Set("X-Amz-Copy-Source", "/bucket/secret")
	r.Header.Set("x-amz-tagging", "a=b")
	e := wantCode(t, mustErr(verify(r, noLookup(t), at(tnow))), "AccessDenied")
	if e.Extra["HeadersNotSigned"] != "x-amz-copy-source,x-amz-tagging" {
		t.Fatalf("error %+v", e)
	}
}

func TestVerifyInvalidURI(t *testing.T) {
	for _, uri := range []string{"/bucket/%zz", "/bucket/%", "/bucket/a%2", "/bucket?x=%G1", "/bucket?%=1"} {
		r := serverRequest("GET", "bucket.localhost:9000", uri,
			"X-Amz-Date", "20250115T123456Z", "X-Amz-Content-Sha256", EmptySHA256,
			"Authorization", authHeader(bvAKID, testScope, "host;x-amz-content-sha256;x-amz-date", strings.Repeat("0", 64)))
		e := wantCode(t, mustErr(verify(r, noLookup(t), at(tnow))), "InvalidURI")
		if e.Status != 400 {
			t.Fatalf("%s: %d", uri, e.Status)
		}
	}
}

func TestVerifyNotSigned(t *testing.T) {
	r := serverRequest("GET", "bucket.localhost:9000", "/bucket/k")
	wantCode(t, mustErr(verify(r, awsKeys, at(tnow))), "AccessDenied")
	r.Header.Set("Authorization", "Bearer BVPAAAA.secret")
	wantCode(t, mustErr(verify(r, awsKeys, at(tnow))), "AccessDenied")
}

func TestVerifyResultIsolation(t *testing.T) {
	cache := NewKeyCache(4)
	opt := at(tnow)
	opt.Cache = cache
	r := signed(t, "GET", "/bucket/k", bvAKID, bvSecret, "us-east-1", tnow, EmptySHA256)
	res, err := verify(r, awsKeys, opt)
	wantCode(t, err, "")
	for i := range res.SigningKey {
		res.SigningKey[i] = 0
	}
	if _, err := verify(r, awsKeys, opt); err != nil {
		t.Fatalf("mutating Result.SigningKey corrupted the cache: %v", err)
	}
}

func TestPresignRoundTrip(t *testing.T) {
	for _, region := range []string{"us-east-1", "auto", "garage", "x"} {
		for _, method := range []string{"GET", "PUT", "HEAD", "DELETE"} {
			for _, key := range []string{"k", "dir with space/ü+%~*", "//a/../b"} {
				c, _ := http.NewRequest(method, "http://bucket.localhost:9000/bucket/"+EncodeS3Path(key)+"?partNumber=1&uploadId=a%2Bb", nil)
				u, err := Presign(c, bvAKID, bvSecret, region, tnow, time.Hour)
				if err != nil {
					t.Fatal(err)
				}
				pu, _ := url.Parse(u)
				r := serverRequest(method, pu.Host, pu.RequestURI())
				res, err := verify(r, awsKeys, at(tnow.Add(30*time.Minute)))
				if err != nil {
					t.Fatalf("%s %s %q: %v\n%s", region, method, key, err, u)
				}
				if !res.Presigned || res.Region != region || res.PayloadHash != UnsignedPayload ||
					!res.Expires.Equal(tnow.Add(time.Hour)) || res.SignedHeaders[0] != "host" {
					t.Fatalf("result %+v", res)
				}
			}
		}
	}
	c, _ := http.NewRequest("GET", "http://h/b/k", nil)
	for _, d := range []time.Duration{0, -time.Second, 604801 * time.Second, 1500 * time.Millisecond} {
		if _, err := Presign(c, bvAKID, bvSecret, "us-east-1", tnow, d); err == nil {
			t.Fatalf("Presign accepted expiry %v", d)
		}
	}
	if _, err := Presign(c, bvAKID, bvSecret, "us-east-1", tnow, 604800*time.Second); err != nil {
		t.Fatal(err)
	}
}

// presigned returns a server-side presigned request (signed at ts).
func presigned(t *testing.T, method, uri string, ts time.Time, expires time.Duration) *http.Request {
	t.Helper()
	c, err := http.NewRequest(method, "http://bucket.localhost:9000"+uri, nil)
	if err != nil {
		t.Fatal(err)
	}
	u, err := Presign(c, bvAKID, bvSecret, "us-east-1", ts, expires)
	if err != nil {
		t.Fatal(err)
	}
	pu, _ := url.Parse(u)
	return serverRequest(method, pu.Host, pu.RequestURI())
}

func TestPresignedTime(t *testing.T) {
	week := 604800 * time.Second
	r := presigned(t, "GET", "/bucket/k", tnow, week)
	tests := []struct {
		now  time.Time
		code string
	}{
		{tnow, ""},
		{tnow.Add(-15 * time.Minute), ""}, // signed up to the skew in the future
		{tnow.Add(-15*time.Minute - time.Second), "RequestTimeTooSkewed"}, // further: not yet valid
		{tnow.Add(6*24*time.Hour + 23*time.Hour), ""},                     // however long ago, until expiry
		{tnow.Add(week), ""},
		{tnow.Add(week + time.Second), "AccessDenied"},
	}
	for _, tc := range tests {
		_, err := verify(r, awsKeys, at(tc.now))
		if e := wantCode(t, err, tc.code); e != nil && tc.code == "AccessDenied" {
			if e.Message != "Request has expired" || e.Extra["X-Amz-Expires"] != "604800" {
				t.Fatalf("error %+v", e)
			}
		}
	}
}

// editQuery rewrites one parameter of a presigned request's raw query
// (value "" with del removes it).
func editQuery(r *http.Request, name, value string, del bool) *http.Request {
	p, q := SplitRequestURI(r.RequestURI)
	var out []string
	for _, seg := range strings.Split(q, "&") {
		n, _, _ := strings.Cut(seg, "=")
		if n == name {
			if del {
				continue
			}
			seg = n + "=" + value
		}
		out = append(out, seg)
	}
	return withURI(r, p+"?"+strings.Join(out, "&"))
}

func TestPresignedMalformed(t *testing.T) {
	base := presigned(t, "GET", "/bucket/k?versionId=1", tnow, time.Hour)
	wantCode(t, mustErr(verify(base, awsKeys, at(tnow))), "")

	for _, name := range []string{"X-Amz-Algorithm", "X-Amz-Credential", "X-Amz-Date", "X-Amz-Expires", "X-Amz-SignedHeaders", "X-Amz-Signature"} {
		wantCode(t, mustErr(verify(editQuery(base, name, "", true), noLookup(t), at(tnow))), "AuthorizationQueryParametersError")
		wantCode(t, mustErr(verify(editQuery(base, name, "", false), noLookup(t), at(tnow))), "AuthorizationQueryParametersError")
	}
	cases := map[string][2]string{
		"algorithm":     {"X-Amz-Algorithm", "AWS4-HMAC-SHA512"},
		"sigv4a":        {"X-Amz-Algorithm", "AWS4-ECDSA-P256-SHA256"},
		"expires 0":     {"X-Amz-Expires", "0"},
		"expires big":   {"X-Amz-Expires", "604801"},
		"expires neg":   {"X-Amz-Expires", "-1"},
		"expires plus":  {"X-Amz-Expires", "%2B5"},
		"expires frac":  {"X-Amz-Expires", "1.5"},
		"expires text":  {"X-Amz-Expires", "soon"},
		"expires long":  {"X-Amz-Expires", "00000000600"},
		"date format":   {"X-Amz-Date", "20250115T1234Z"},
		"date iso":      {"X-Amz-Date", "2025-01-15T12:34:56Z"},
		"date mismatch": {"X-Amz-Date", "20250116T123456Z"},
		"credential":    {"X-Amz-Credential", bvAKID + "%2F20250115%2Fus-east-1%2Fs3"},
		"service":       {"X-Amz-Credential", bvAKID + "%2F20250115%2Fus-east-1%2Fsqs%2Faws4_request"},
		"region empty":  {"X-Amz-Credential", bvAKID + "%2F20250115%2F%2Fs3%2Faws4_request"},
		"no host":       {"X-Amz-SignedHeaders", "x-amz-date"},
		"bad header":    {"X-Amz-SignedHeaders", "host%3B%3Bx"},
	}
	for name, c := range cases {
		e := wantCode(t, mustErr(verify(editQuery(base, c[0], c[1], false), noLookup(t), at(tnow))), "AuthorizationQueryParametersError")
		if e.Status != 400 {
			t.Fatalf("%s: status %d", name, e.Status)
		}
	}
	// A repeated auth parameter is ambiguous.
	p, q := SplitRequestURI(base.RequestURI)
	wantCode(t, mustErr(verify(withURI(base, p+"?"+q+"&X-Amz-Signature="+strings.Repeat("0", 64)), noLookup(t), at(tnow))),
		"AuthorizationQueryParametersError")
	// Tampering after signing.
	wantCode(t, mustErr(verify(withURI(base, p+"?"+q+"&response-content-type=text%2Fhtml"), awsKeys, at(tnow))), "SignatureDoesNotMatch")
	wantCode(t, mustErr(verify(withURI(base, "/bucket/K?"+q), awsKeys, at(tnow))), "SignatureDoesNotMatch")
	wantCode(t, mustErr(verify(editQuery(base, "versionId", "2", false), awsKeys, at(tnow))), "SignatureDoesNotMatch")
	wantCode(t, mustErr(verify(editQuery(base, "X-Amz-Expires", "7200", false), awsKeys, at(tnow))), "SignatureDoesNotMatch")
	h := withURI(base, base.RequestURI)
	h.Host = "evil.localhost:9000"
	wantCode(t, mustErr(verify(h, awsKeys, at(tnow))), "SignatureDoesNotMatch")
	// Headers added by whoever holds the URL: x-amz-* ones are refused.
	h = withURI(base, base.RequestURI)
	h.Header.Set("X-Amz-Copy-Source", "/bucket/other")
	e := wantCode(t, mustErr(verify(h, noLookup(t), at(tnow))), "AccessDenied")
	if e.Extra["HeadersNotSigned"] != "x-amz-copy-source" {
		t.Fatalf("error %+v", e)
	}
	h = withURI(base, base.RequestURI)
	h.Header.Set("Range", "bytes=0-1")
	wantCode(t, mustErr(verify(h, awsKeys, at(tnow))), "")
	// Unknown key.
	wantCode(t, mustErr(verify(base, keys(), at(tnow))), "InvalidAccessKeyId")
}

func TestPresignedPayloadHash(t *testing.T) {
	sum := sha256Hex([]byte("pinned body"))
	r := presigned(t, "PUT", "/bucket/k?X-Amz-Content-Sha256="+sum, tnow, time.Hour)
	res, err := verify(r, awsKeys, at(tnow))
	wantCode(t, err, "")
	if res.PayloadHash != sum || res.Stream != StreamNone {
		t.Fatalf("result %+v", res)
	}
	// A client-added, unsigned x-amz-content-sha256 header is refused rather
	// than silently ignored.
	r = presigned(t, "PUT", "/bucket/k", tnow, time.Hour)
	r.Header.Set("X-Amz-Content-Sha256", sum)
	wantCode(t, mustErr(verify(r, awsKeys, at(tnow))), "AccessDenied")
	r = presigned(t, "PUT", "/bucket/k?X-Amz-Content-Sha256=bogus", tnow, time.Hour)
	wantCode(t, mustErr(verify(r, noLookup(t), at(tnow))), "InvalidArgument")
}

func TestDetect(t *testing.T) {
	tests := []struct {
		name    string
		uri     string
		headers []string
		kind    Kind
		code    string
	}{
		{"anonymous", "/b/k?versionId=1", nil, None, ""},
		{"header", "/b/k", []string{"Authorization", "AWS4-HMAC-SHA256 Credential=x"}, Header, ""},
		{"bearer", "/b/k", []string{"Authorization", "Bearer BVPX.y"}, Bearer, ""},
		{"bearer lower", "/b/k", []string{"Authorization", "bearer BVPX.y"}, Bearer, ""},
		{"presigned", "/b/k?X-Amz-Algorithm=AWS4-HMAC-SHA256", nil, Presigned, ""},
		{"presigned partial", "/b/k?X-Amz-Credential=x", nil, Presigned, ""},
		{"presigned escaped name", "/b/k?X-Amz-%41lgorithm=x", nil, Presigned, ""},
		{"other x-amz param", "/b/k?X-Amz-Date=1", nil, None, ""},
		{"sigv2 header", "/b/k", []string{"Authorization", "AWS AKIAIOSFODNN7EXAMPLE:frJIUN8DYpKDtOLCwo//yllqDzg="}, None, "InvalidRequest"},
		{"basic", "/b/k", []string{"Authorization", "Basic dXNlcjpwYXNz"}, None, "InvalidRequest"},
		{"sigv4a", "/b/k", []string{"Authorization", "AWS4-ECDSA-P256-SHA256 Credential=x"}, None, "InvalidRequest"},
		{"no space", "/b/k", []string{"Authorization", "AWS4-HMAC-SHA256Credential=x"}, None, "InvalidRequest"},
		{"empty", "/b/k", []string{"Authorization", ""}, None, "AuthorizationHeaderMalformed"},
		{"two headers", "/b/k", []string{"Authorization", "Bearer a.b", "Authorization", "Bearer c.d"}, None, "AuthorizationHeaderMalformed"},
		{"mixed", "/b/k?X-Amz-Credential=x", []string{"Authorization", "AWS4-HMAC-SHA256 Credential=x"}, None, "InvalidRequest"},
		{"mixed bearer", "/b/k?X-Amz-Signature=x", []string{"Authorization", "Bearer a.b"}, None, "InvalidRequest"},
		{"sigv2 query", "/b/k?AWSAccessKeyId=AKIA&Expires=1&Signature=x", nil, None, "InvalidRequest"},
		{"sigv2 query mixed", "/b/k?AWSAccessKeyId=AKIA&Signature=x", []string{"Authorization", "Bearer a.b"}, None, "InvalidRequest"},
	}
	for _, tc := range tests {
		r := serverRequest("GET", "h", tc.uri, tc.headers...)
		k, err := Detect(r)
		wantCode(t, err, tc.code)
		if k != tc.kind {
			t.Fatalf("%s: kind %v", tc.name, k)
		}
		if err == nil && k.String() == "unknown" {
			t.Fatalf("%s: no name for %d", tc.name, k)
		}
	}
	if e := wantCode(t, mustKind(Detect(serverRequest("GET", "h", "/b/k?X-Amz-Credential=x", "Authorization", "Bearer a.b"))), "InvalidRequest"); !strings.Contains(e.Message, "Only one auth mechanism") {
		t.Fatal(e.Message)
	}
}

func mustKind(_ Kind, err error) error { return err }

func TestPeekAccessKey(t *testing.T) {
	h := signed(t, "GET", "/bucket/k", bvAKID, bvSecret, "us-east-1", tnow, EmptySHA256)
	p := presigned(t, "GET", "/bucket/k", tnow, time.Hour)
	tests := []struct {
		name string
		r    *http.Request
		id   string
		code string
	}{
		{"header", h, bvAKID, ""},
		{"presigned", p, bvAKID, ""},
		{"bearer", serverRequest("GET", "h", "/", "Authorization", "Bearer BVPABC.s.e.c"), "BVPABC", ""},
		{"anonymous", serverRequest("GET", "h", "/"), "", ""},
		{"bad bearer", serverRequest("GET", "h", "/", "Authorization", "Bearer nodot"), "", "InvalidAccessKeyId"},
		{"bad header", serverRequest("GET", "h", "/", "Authorization", "AWS4-HMAC-SHA256 Credential=a/b, SignedHeaders=host, Signature=x"), "", "AuthorizationHeaderMalformed"},
		{"bad header shape", serverRequest("GET", "h", "/", "Authorization", "AWS4-HMAC-SHA256 nonsense"), "", "AuthorizationHeaderMalformed"},
		{"bad query", serverRequest("GET", "h", "/?X-Amz-Credential=a%2Fb"), "", "AuthorizationQueryParametersError"},
		{"no credential", serverRequest("GET", "h", "/?X-Amz-Algorithm=AWS4-HMAC-SHA256"), "", "AuthorizationQueryParametersError"},
		{"bad escape", serverRequest("GET", "h", "/?X-Amz-Credential=%zz&X-Amz-Algorithm=x"), "", "InvalidURI"},
		{"mixed", serverRequest("GET", "h", "/?X-Amz-Credential=x", "Authorization", "Bearer a.b"), "", "InvalidRequest"},
	}
	for _, tc := range tests {
		id, err := PeekAccessKey(tc.r)
		wantCode(t, err, tc.code)
		if id != tc.id {
			t.Fatalf("%s: %q", tc.name, id)
		}
	}
}

func TestParseBearer(t *testing.T) {
	tests := []struct {
		header       []string
		akid, secret string
		ok           bool
	}{
		{[]string{"Authorization", "Bearer BVPAAAA.secret"}, "BVPAAAA", "secret", true},
		{[]string{"Authorization", "bearer BVPAAAA.se.cr.et"}, "BVPAAAA", "se.cr.et", true},
		{[]string{"Authorization", "Bearer   BVP.a+b/c=="}, "BVP", "a+b/c==", true},
		{nil, "", "", false},
		{[]string{"Authorization", "Bearer"}, "", "", false},
		{[]string{"Authorization", "Bearer nodot"}, "", "", false},
		{[]string{"Authorization", "Bearer .secret"}, "", "", false},
		{[]string{"Authorization", "Bearer BVP."}, "", "", false},
		{[]string{"Authorization", "Bearer BVP.sec ret"}, "", "", false},
		{[]string{"Authorization", "Bearer BVP.sec,ret"}, "", "", false},
		{[]string{"Authorization", "Basic BVP.secret"}, "", "", false},
		{[]string{"Authorization", "Bearer a.b", "Authorization", "Bearer a.b"}, "", "", false},
	}
	for _, tc := range tests {
		akid, secret, ok := ParseBearer(serverRequest("GET", "h", "/", tc.header...))
		if akid != tc.akid || secret != tc.secret || ok != tc.ok {
			t.Fatalf("%q: %q %q %v", tc.header, akid, secret, ok)
		}
	}
}
