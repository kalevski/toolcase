package sigv4

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

// Requests built with the signing helpers travel through a real net/http
// client and server, and the handler verifies them the way the S3 front end
// will: raw path and query from RequestURI, aws-chunked bodies decoded from
// r.Body.
func TestEndToEndHTTP(t *testing.T) {
	type outcome struct {
		res  *Result
		body []byte
		tr   http.Header
		err  error
	}
	got := make(chan outcome, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p, q := SplitRequestURI(r.RequestURI)
		res, err := Verify(r, p, q, awsKeys, Options{Now: func() time.Time { return tnow }})
		o := outcome{res: res, err: err}
		if err == nil {
			if res.Stream != StreamNone {
				sr := NewStreamReader(r.Body, res, 0)
				o.body, o.err = io.ReadAll(sr)
				o.tr = sr.Trailer()
			} else {
				o.body, _ = io.ReadAll(r.Body)
			}
		}
		got <- o
		w.WriteHeader(http.StatusNoContent)
	}))
	defer srv.Close()

	send := func(r *http.Request) outcome {
		t.Helper()
		resp, err := http.DefaultClient.Do(r)
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		return <-got
	}
	key := "/bucket/" + EncodeS3Path("dir with space/ü+%~*/../x//y")

	// Header-signed PUT with a signed payload hash and a signed Content-Length.
	payload := []byte("hello, binvault")
	r, _ := http.NewRequest("PUT", srv.URL+key+"?tagging&x=a+b", bytes.NewReader(payload))
	r.Header.Set("Content-Type", "text/plain")
	r.Header.Set("X-Amz-Meta-Note", "  spaced   out  ")
	if _, err := Sign(r, bvAKID, bvSecret, "auto", tnow, sha256Hex(payload), "content-type", "content-length", "x-amz-meta-note"); err != nil {
		t.Fatal(err)
	}
	if o := send(r); o.err != nil || !bytes.Equal(o.body, payload) || o.res.PayloadHash != sha256Hex(payload) {
		t.Fatalf("signed PUT: %+v", o)
	}

	// Streaming PUT with a signed trailer, Content-Length signed.
	big := payloadOf(200 << 10)
	crc := crc32b64(big)
	trailer := http.Header{"x-amz-checksum-crc32": {crc}}
	r, _ = http.NewRequest("PUT", srv.URL+key, nil)
	r.Header.Set("Content-Encoding", "aws-chunked")
	r.Header.Set("X-Amz-Decoded-Content-Length", strconv.Itoa(len(big)))
	r.Header.Set("X-Amz-Trailer", "x-amz-checksum-crc32")
	// Signatures are fixed-length, so the encoded size is known before signing.
	size := len(EncodeStream(&Result{Signature: EmptySHA256, SigningKey: []byte("k")}, StreamSignedTrailer, big, 64<<10, trailer))
	r.ContentLength = int64(size)
	res, err := Sign(r, bvAKID, bvSecret, "eu-central-1", tnow, StreamingPayloadTrailer,
		"content-encoding", "content-length", "x-amz-decoded-content-length", "x-amz-trailer")
	if err != nil {
		t.Fatal(err)
	}
	body := EncodeStream(res, StreamSignedTrailer, big, 64<<10, trailer)
	r.Body, r.ContentLength = io.NopCloser(bytes.NewReader(body)), int64(len(body))
	if o := send(r); o.err != nil || !bytes.Equal(o.body, big) || o.tr["x-amz-checksum-crc32"][0] != crc || o.res.Signature != res.Signature {
		t.Fatalf("streaming PUT: err %v, %d bytes, trailer %v", o.err, len(o.body), o.tr)
	}

	// Unsigned-trailer body sent with Transfer-Encoding: chunked.
	r, _ = http.NewRequest("PUT", srv.URL+key, nil)
	r.Header.Set("Content-Encoding", "aws-chunked")
	r.Header.Set("X-Amz-Trailer", "x-amz-checksum-crc32")
	res, err = Sign(r, bvAKID, bvSecret, "garage", tnow, StreamingUnsignedPayloadTrailer, "content-encoding", "x-amz-trailer")
	if err != nil {
		t.Fatal(err)
	}
	body = EncodeStream(res, StreamUnsignedTrailer, big, 100000, trailer)
	r.Body, r.ContentLength = io.NopCloser(io.MultiReader(bytes.NewReader(body[:7]), bytes.NewReader(body[7:]))), -1
	if o := send(r); o.err != nil || !bytes.Equal(o.body, big) || o.tr["x-amz-checksum-crc32"][0] != crc {
		t.Fatalf("chunked transfer: err %v, %d bytes", o.err, len(o.body))
	}

	// Presigned GET.
	r, _ = http.NewRequest("GET", srv.URL+key+"?versionId=v%2B1", nil)
	u, err := Presign(r, bvAKID, bvSecret, "us-east-1", tnow.Add(-time.Hour), time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	r, _ = http.NewRequest("GET", u, nil)
	if o := send(r); o.err != nil || !o.res.Presigned {
		t.Fatalf("presigned GET: %+v", o)
	}
	r, _ = http.NewRequest("GET", u+"&extra=1", nil)
	if o := send(r); o.err == nil {
		t.Fatal("a presigned URL with an added parameter verified")
	}
}
