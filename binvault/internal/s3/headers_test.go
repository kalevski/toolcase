package s3

import (
	"net/http"
	"testing"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
)

func hdr(kv ...string) http.Header {
	h := http.Header{}
	for i := 0; i+1 < len(kv); i += 2 {
		h.Add(kv[i], kv[i+1])
	}
	return h
}

func TestParseWriteHeaders(t *testing.T) {
	h := hdr("Content-Type", "image/png", "Content-Encoding", "aws-chunked", "Cache-Control", "max-age=60",
		"X-Amz-Meta-User", "42", "X-Amz-Meta-Team", "a", "X-Amz-Tagging", "k=v&k2=v2",
		"X-Amz-Server-Side-Encryption", "AES256")
	w, err := ParseWriteHeaders(h)
	if err != nil {
		t.Fatal(err)
	}
	if w.Headers.ContentType != "image/png" || w.Headers.ContentEncoding != "" || w.Headers.CacheControl != "max-age=60" {
		t.Fatalf("%+v", w.Headers)
	}
	if w.Metadata["user"] != "42" || w.Metadata["team"] != "a" || len(w.Metadata) != 2 {
		t.Fatalf("%v", w.Metadata)
	}
	if len(w.Tags) != 2 || !w.SSE {
		t.Fatalf("%v %v", w.Tags, w.SSE)
	}
}

func TestContentEncodingKeepsOthers(t *testing.T) {
	w, err := ParseWriteHeaders(hdr("Content-Encoding", "aws-chunked, gzip"))
	if err != nil {
		t.Fatal(err)
	}
	if w.Headers.ContentEncoding != "gzip" {
		t.Fatalf("%q", w.Headers.ContentEncoding)
	}
}

func TestUnsupportedHeaders(t *testing.T) {
	cases := map[string]string{
		"x-amz-server-side-encryption":                    "NotImplemented", // aws:kms below
		"x-amz-server-side-encryption-customer-algorithm": "NotImplemented",
		"x-amz-object-lock-mode":                          "NotImplemented",
		"x-amz-website-redirect-location":                 "NotImplemented",
		"x-amz-grant-read":                                "AccessControlListNotSupported",
		"x-amz-acl":                                       "AccessControlListNotSupported", // public-read below
		"x-amz-storage-class":                             "InvalidStorageClass",           // GLACIER below
		"x-amz-server-side-encryption-aws-kms-key-id":     "NotImplemented",
	}
	values := map[string]string{
		"x-amz-server-side-encryption": "aws:kms",
		"x-amz-acl":                    "public-read",
		"x-amz-storage-class":          "GLACIER",
	}
	for k, code := range cases {
		v := values[k]
		if v == "" {
			v = "x"
		}
		_, err := ParseWriteHeaders(hdr(k, v))
		if !apierr.Is(err, code) {
			t.Errorf("%s: want %s, got %v", k, code, err)
		}
	}
	for _, ok := range []map[string]string{
		{"x-amz-acl": "private"}, {"x-amz-acl": "bucket-owner-full-control"},
		{"x-amz-storage-class": "STANDARD"}, {"x-amz-storage-class": "REDUCED_REDUNDANCY"},
	} {
		h := http.Header{}
		for k, v := range ok {
			h.Set(k, v)
		}
		if _, err := ParseWriteHeaders(h); err != nil {
			t.Errorf("%v: %v", ok, err)
		}
	}
}

func TestContentMD5(t *testing.T) {
	if b, err := ParseContentMD5("1B2M2Y8AsgTpgAmY7PhCfg=="); err != nil || len(b) != 16 {
		t.Fatalf("%v %v", b, err)
	}
	for _, bad := range []string{"!!!", "AAAA"} {
		if _, err := ParseContentMD5(bad); !apierr.Is(err, "InvalidDigest") {
			t.Errorf("%q: %v", bad, err)
		}
	}
}

func TestWritePreconditions(t *testing.T) {
	star, m, err := WritePreconditions(hdr("If-None-Match", "*"))
	if err != nil || !star || m != "" {
		t.Fatal(star, m, err)
	}
	if _, _, err := WritePreconditions(hdr("If-None-Match", `"abc"`)); err == nil {
		t.Fatal("If-None-Match with an etag on a write must be refused")
	}
	if _, m, _ := WritePreconditions(hdr("If-Match", `"abc"`)); m != `"abc"` {
		t.Fatal(m)
	}
}
