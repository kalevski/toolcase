package sigv4

import (
	"bytes"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
)

// The AWS documentation example credentials.
const (
	awsAKID   = "AKIAIOSFODNN7EXAMPLE"
	awsSecret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
	// A binvault-shaped bucket token (spec §4.3).
	bvAKID   = "BVKABCDEFGHIJKLMNOPQ"
	bvSecret = "q7Zr2Xv9LmT4Wc8Ns1Ke5Yd3Hb6Gf0Ja2Pu7Ro9V"
)

// awsTime is the time of the AWS examples, 20130524T000000Z.
var awsTime = time.Date(2013, 5, 24, 0, 0, 0, 0, time.UTC)

// keys is a SecretLookup over a fixed table.
func keys(pairs ...string) SecretLookup {
	m := map[string]string{}
	for i := 0; i+1 < len(pairs); i += 2 {
		m[pairs[i]] = pairs[i+1]
	}
	return func(id string) (string, bool) {
		s, ok := m[id]
		return s, ok
	}
}

var awsKeys = keys(awsAKID, awsSecret, bvAKID, bvSecret)

func at(t time.Time) Options {
	return Options{Now: func() time.Time { return t }}
}

// serverRequest builds a request the way net/http's server hands it to a
// handler: Host in r.Host, headers in r.Header, the raw request-target in
// RequestURI. headers alternate name, value; repeated names add values.
func serverRequest(method, host, requestURI string, headers ...string) *http.Request {
	r := &http.Request{
		Method:     method,
		Host:       host,
		RequestURI: requestURI,
		Header:     http.Header{},
		Proto:      "HTTP/1.1", ProtoMajor: 1, ProtoMinor: 1,
	}
	rawPath, rawQuery := SplitRequestURI(requestURI)
	u := &url.URL{RawQuery: rawQuery}
	if p, err := DecodeS3Path(rawPath); err == nil {
		u.Path, u.RawPath = p, rawPath
	}
	r.URL = u
	for i := 0; i+1 < len(headers); i += 2 {
		r.Header.Add(headers[i], headers[i+1])
	}
	return r
}

// verify runs Verify with the raw path and query of r.RequestURI.
func verify(r *http.Request, lookup SecretLookup, opt Options) (*Result, error) {
	p, q := SplitRequestURI(r.RequestURI)
	return Verify(r, p, q, lookup, opt)
}

// wantCode fails unless err is an *apierr.Error with the given code.
func wantCode(t *testing.T, err error, code string) *apierr.Error {
	t.Helper()
	if code == "" {
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		return nil
	}
	e, ok := apierr.As(err)
	if !ok {
		t.Fatalf("want %s, got %v (%T)", code, err, err)
	}
	if e.Code != code {
		t.Fatalf("want %s, got %s: %s", code, e.Code, e.Message)
	}
	if e.Status < 400 || e.Status > 599 {
		t.Fatalf("%s has status %d", code, e.Status)
	}
	return e
}

// readAll drains a StreamReader with small, uneven reads.
func readAll(r io.Reader) ([]byte, error) {
	var out bytes.Buffer
	buf := make([]byte, 7777)
	for {
		n, err := r.Read(buf[:1+out.Len()%len(buf)])
		out.Write(buf[:n])
		if err == io.EOF {
			return out.Bytes(), nil
		}
		if err != nil {
			return out.Bytes(), err
		}
	}
}

func authHeader(akid, scope, signed, sig string) string {
	return "AWS4-HMAC-SHA256 Credential=" + akid + "/" + scope + ",SignedHeaders=" + signed + ",Signature=" + sig
}

var awsScope = "20130524/us-east-1/s3/aws4_request"

func repeat(c string, n int) []byte { return []byte(strings.Repeat(c, n)) }
