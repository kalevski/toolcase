// Generator of the aws-sdk-go-v2 entries of ../vectors.json (not built by
// the binvault module: testdata is ignored by the go tool).
//
//	mkdir /tmp/vecgen && cp gosigner.go /tmp/vecgen/main.go && cd /tmp/vecgen
//	go mod init vecgen && go get github.com/aws/aws-sdk-go-v2@v1.47.1 github.com/aws/smithy-go@v1.28.1
//	go run . > go_vectors.json
//
// then run merge.py.

package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/smithy-go/encoding/httpbinding"
)

type vec struct {
	Name        string      `json:"name"`
	Source      string      `json:"source"`
	Kind        string      `json:"kind"`
	Method      string      `json:"method"`
	Host        string      `json:"host"`
	RequestURI  string      `json:"request_uri"`
	Headers     [][2]string `json:"headers"`
	AccessKeyID string      `json:"access_key_id"`
	Region      string      `json:"region"`
	Now         string      `json:"now"`
	Signature   string      `json:"signature"`
}

var now = time.Date(2025, 1, 15, 12, 34, 56, 0, time.UTC)

const (
	bvAKID   = "BVKABCDEFGHIJKLMNOPQ"
	bvSecret = "q7Zr2Xv9LmT4Wc8Ns1Ke5Yd3Hb6Gf0Ja2Pu7Ro9V"
)

func hexsum(b []byte) string { h := sha256.Sum256(b); return hex.EncodeToString(h[:]) }

func newReq(method, host, bucket, key, rawQuery string, body []byte) *http.Request {
	rawPath := "/" + bucket
	path := "/" + bucket
	if key != "" {
		rawPath += "/" + httpbinding.EscapePath(key, false)
		path += "/" + key
	}
	u := &url.URL{Scheme: "http", Host: host, Path: path, RawPath: rawPath, RawQuery: rawQuery}
	r, err := http.NewRequest(method, u.String(), bytes.NewReader(body))
	if err != nil {
		panic(err)
	}
	r.URL.Path, r.URL.RawPath, r.URL.RawQuery = path, rawPath, rawQuery
	if r.URL.EscapedPath() != rawPath {
		panic(fmt.Sprintf("escaped path %q != %q", r.URL.EscapedPath(), rawPath))
	}
	if len(body) == 0 {
		r.Body, r.ContentLength = http.NoBody, 0
	}
	return r
}

func headers(r *http.Request) [][2]string {
	var out [][2]string
	names := make([]string, 0, len(r.Header))
	for k := range r.Header {
		names = append(names, k)
	}
	sort.Strings(names)
	for _, k := range names {
		for _, v := range r.Header[k] {
			out = append(out, [2]string{k, v})
		}
	}
	if r.ContentLength > 0 && r.Header.Get("Content-Length") == "" {
		out = append(out, [2]string{"Content-Length", fmt.Sprint(r.ContentLength)})
	}
	return out
}

func sigOf(auth string) string {
	i := strings.Index(auth, "Signature=")
	return auth[i+len("Signature="):]
}

func signHeader(name, region string, r *http.Request, payloadHash string) vec {
	signer := v4.NewSigner(func(o *v4.SignerOptions) { o.DisableURIPathEscaping = true })
	r.Header.Set("X-Amz-Content-Sha256", payloadHash)
	err := signer.SignHTTP(context.Background(), aws.Credentials{AccessKeyID: bvAKID, SecretAccessKey: bvSecret},
		r, payloadHash, "s3", region, now)
	if err != nil {
		panic(err)
	}
	uri := r.URL.EscapedPath()
	if r.URL.RawQuery != "" {
		uri += "?" + r.URL.RawQuery
	}
	return vec{Name: name, Source: "aws-sdk-go-v2 signer v4", Kind: "header", Method: r.Method, Host: r.URL.Host,
		RequestURI: uri, Headers: headers(r), AccessKeyID: bvAKID, Region: region,
		Now: now.Format(time.RFC3339), Signature: sigOf(r.Header.Get("Authorization"))}
}

func presign(name, region string, r *http.Request, expires string) vec {
	signer := v4.NewSigner(func(o *v4.SignerOptions) { o.DisableURIPathEscaping = true })
	q := r.URL.RawQuery
	if q != "" {
		q += "&"
	}
	r.URL.RawQuery = q + "X-Amz-Expires=" + expires
	signed, hdr, err := signer.PresignHTTP(context.Background(), aws.Credentials{AccessKeyID: bvAKID, SecretAccessKey: bvSecret},
		r, "UNSIGNED-PAYLOAD", "s3", region, now)
	if err != nil {
		panic(err)
	}
	// signed is scheme://host/path?query, keep the raw form.
	rest := signed[strings.Index(signed, "://")+3:]
	uri := rest[strings.Index(rest, "/"):]
	var hs [][2]string
	names := make([]string, 0, len(hdr))
	for k := range hdr {
		names = append(names, k)
	}
	sort.Strings(names)
	for _, k := range names {
		if strings.EqualFold(k, "Host") {
			continue
		}
		for _, v := range hdr[k] {
			hs = append(hs, [2]string{k, v})
		}
	}
	u, _ := url.Parse(signed)
	return vec{Name: name, Source: "aws-sdk-go-v2 signer v4 (presign)", Kind: "presigned", Method: r.Method, Host: r.URL.Host,
		RequestURI: uri, Headers: hs, AccessKeyID: bvAKID, Region: region,
		Now: now.Format(time.RFC3339), Signature: u.Query().Get("X-Amz-Signature")}
}

func main() {
	oddKey := "photos/dir with space/ü ñ 日本/+plus%percent~tilde*star!bang'quote(paren)$dollar&amp=eq,comma;semi:colon@at#hash?q[]{}|^`\"<>\\back"
	var vs []vec

	r := newReq("PUT", "localhost:9000", "bucket", oddKey, "", []byte("hello"))
	r.Header.Set("Content-Type", "text/plain; charset=utf-8")
	r.Header.Set("X-Amz-Meta-Note", "a  b   c")
	vs = append(vs, signHeader("go-odd-key-put-region-auto", "auto", r, hexsum([]byte("hello"))))

	r = newReq("GET", "localhost:9000", "bucket", "/a/./../b//c/", "", nil)
	vs = append(vs, signHeader("go-dot-segments-unsigned-payload", "garage", r, "UNSIGNED-PAYLOAD"))

	r = newReq("GET", "s3.example.com", "bucket", "", "prefix=a+b&list-type=2&delimiter=%2F&empty=&flag&encoding-type=url&start-after=caf%C3%A9%20%2B&max-keys=1000", nil)
	vs = append(vs, signHeader("go-query-plus-is-space", "us-west-2", r, hexsum(nil)))

	r = newReq("PUT", "s3.local", "bucket", "trailer.bin", "", nil)
	r.Header.Set("Content-Encoding", "aws-chunked")
	r.Header.Set("X-Amz-Decoded-Content-Length", "11")
	r.Header.Set("X-Amz-Trailer", "x-amz-checksum-crc32")
	r.Header.Set("X-Amz-Sdk-Checksum-Algorithm", "CRC32")
	vs = append(vs, signHeader("go-unsigned-trailer-seed-odd-region", "my_region.weird-1", r, "STREAMING-UNSIGNED-PAYLOAD-TRAILER"))

	r = newReq("GET", "localhost:9000", "bucket", oddKey,
		"response-content-disposition=attachment%3B%20filename%3D%22a%20b.txt%22&versionId=3%2FL4kq%2BrmSpX", nil)
	vs = append(vs, presign("go-presign-get-odd-key-auto", "auto", r, "3600"))

	r = newReq("PUT", "127.0.0.1:9000", "bucket", "uploads/file.bin", "", nil)
	r.Header.Set("Content-Type", "image/png")
	r.Header.Set("X-Amz-Meta-Owner", "42")
	vs = append(vs, presign("go-presign-put-hoisted-meta", "eu-central-1", r, "604800"))

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(vs); err != nil {
		panic(err)
	}
}
