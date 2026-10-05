package s3

import (
	"net/http"
	"testing"
)

func TestHoistQueryHeaders(t *testing.T) {
	q, err := parseQuery("x-amz-meta-who=presign&x-amz-Meta-Other=Two+Words&x-amz-tagging=env%3Dprod%26team%3Dcore" +
		"&x-amz-server-side-encryption=AES256&x-amz-checksum-crc32=y%2FQ5Jg%3D%3D&response-content-type=text%2Fplain" +
		"&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AK%2F20260101%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260101T000000Z" +
		"&X-Amz-Expires=60&X-Amz-SignedHeaders=host&X-Amz-Signature=abc&X-Amz-Security-Token=tok&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD")
	if err != nil {
		t.Fatal(err)
	}
	h := http.Header{}
	h.Set("X-Amz-Meta-Who", "header-wins") // a signed header is not overridden by the query form
	if !hoistQueryHeaders(h, q, false) {
		t.Fatal("nothing was hoisted")
	}
	want := map[string]string{
		"X-Amz-Meta-Who":               "header-wins",
		"X-Amz-Meta-Other":             "Two Words",
		"X-Amz-Tagging":                "env=prod&team=core",
		"X-Amz-Server-Side-Encryption": "AES256",
		"X-Amz-Checksum-Crc32":         "y/Q5Jg==",
	}
	for k, v := range want {
		if got := h.Get(k); got != v {
			t.Errorf("%s = %q, want %q", k, got, v)
		}
	}
	// the SigV4 parameters themselves, the payload marker and response-* overrides are never headers
	for _, k := range []string{"X-Amz-Algorithm", "X-Amz-Credential", "X-Amz-Date", "X-Amz-Expires", "X-Amz-Signedheaders",
		"X-Amz-Signature", "X-Amz-Security-Token", "X-Amz-Content-Sha256", "Response-Content-Type"} {
		if v := h.Values(k); len(v) != 0 {
			t.Errorf("%s was hoisted: %v", k, v)
		}
	}
	// and what was hoisted is parsed like the header form
	w, err := ParseWriteHeaders(h)
	if err != nil {
		t.Fatal(err)
	}
	if w.Metadata["other"] != "Two Words" || w.Metadata["who"] != "header-wins" || len(w.Tags) != 2 || !w.SSE {
		t.Fatalf("%+v", w)
	}
}

func TestHoistQueryHeadersNothingToDo(t *testing.T) {
	q, _ := parseQuery("X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc&response-content-type=text%2Fplain&uploadId=1&partNumber=2")
	h := http.Header{}
	if hoistQueryHeaders(h, q, false) || len(h) != 0 {
		t.Fatalf("hoisted %v", h)
	}
}

func TestHoistedUnsupportedValuesAreRefused(t *testing.T) {
	for _, tc := range []struct{ query, code string }{
		{"x-amz-server-side-encryption=aws%3Akms", "NotImplemented"},
		{"x-amz-storage-class=GLACIER", "InvalidStorageClass"},
		{"x-amz-acl=public-read", "AccessControlListNotSupported"},
		{"x-amz-server-side-encryption-customer-algorithm=AES256", "NotImplemented"},
	} {
		q, _ := parseQuery(tc.query)
		h := http.Header{}
		hoistQueryHeaders(h, q, false)
		_, err := ParseWriteHeaders(h)
		if err == nil || err.Error() == "" {
			t.Errorf("%s: accepted", tc.query)
			continue
		}
		if ae := toAPIError(err); ae.Code != tc.code {
			t.Errorf("%s: %s, want %s", tc.query, ae.Code, tc.code)
		}
	}
}

// aws-sdk-js-v3 signs presigned PutObject / UploadPart URLs with the checksum of the empty
// body it has at signing time; against a real body that is a placeholder, not a checksum
// to verify (spec §5.9), while any other value is.
func TestHoistedEmptyBodyChecksumIsAPlaceholder(t *testing.T) {
	const jsDefault = "x-amz-checksum-crc32=AAAAAA%3D%3D&x-amz-sdk-checksum-algorithm=CRC32&x-id=PutObject"
	hoist := func(query string, emptyBody bool) http.Header {
		t.Helper()
		q, err := parseQuery(query)
		if err != nil {
			t.Fatal(err)
		}
		h := http.Header{}
		hoistQueryHeaders(h, q, emptyBody)
		return h
	}
	// a body that is not known to be empty: the placeholder is dropped, the algorithm stays declared
	h := hoist(jsDefault, false)
	if h.Get("x-amz-checksum-crc32") != "" || h.Get("x-amz-sdk-checksum-algorithm") != "CRC32" {
		t.Fatalf("placeholder with a body: %v", h)
	}
	algo, value, trailer, err := requestChecksum(h)
	if err != nil || algo != "CRC32" || value != "" || trailer {
		t.Fatalf("requestChecksum: %q %q %v %v", algo, value, trailer, err)
	}
	// the algorithm is declared even when the URL only had the placeholder
	h = hoist("x-amz-checksum-sha256=47DEQpj8HBSa%2B%2FTImW%2B5JCeuQeRkm5NMpJWZG3hSuFU%3D", false)
	if h.Get("x-amz-checksum-sha256") != "" || h.Get("x-amz-sdk-checksum-algorithm") != "SHA256" {
		t.Fatalf("sha256 placeholder: %v", h)
	}
	// an empty body is verified like any other
	h = hoist(jsDefault, true)
	if h.Get("x-amz-checksum-crc32") != "AAAAAA==" {
		t.Fatalf("placeholder with an empty body: %v", h)
	}
	// every other value is a real checksum
	h = hoist("x-amz-checksum-crc32=y%2FQ5Jg%3D%3D&x-amz-sdk-checksum-algorithm=CRC32", false)
	if h.Get("x-amz-checksum-crc32") != "y/Q5Jg==" {
		t.Fatalf("a real checksum: %v", h)
	}
	// the declared algorithm of the URL wins over the placeholder's
	h = hoist("x-amz-checksum-crc32=AAAAAA%3D%3D&x-amz-sdk-checksum-algorithm=SHA256", false)
	if h.Get("x-amz-checksum-crc32") != "" || h.Get("x-amz-sdk-checksum-algorithm") != "SHA256" {
		t.Fatalf("declared algorithm: %v", h)
	}
	// a signed header with the same name is the signer's deliberate word and is left alone
	q, _ := parseQuery(jsDefault)
	hh := http.Header{}
	hh.Set("X-Amz-Checksum-Crc32", "AAAAAA==")
	hoistQueryHeaders(hh, q, false)
	if hh.Get("X-Amz-Checksum-Crc32") != "AAAAAA==" {
		t.Fatalf("header form: %v", hh)
	}
}
