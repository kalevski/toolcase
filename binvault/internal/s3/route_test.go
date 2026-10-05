package s3

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func req(method, uri, host string) *http.Request {
	r := httptest.NewRequest(method, "http://placeholder"+uri, nil)
	r.RequestURI = uri // as received on the wire
	if host != "" {
		r.Host = host
	}
	return r
}

func TestParseTargetPathStyle(t *testing.T) {
	cases := []struct {
		uri      string
		bucket   string
		key      string
		service  bool
		reserved bool
	}{
		{"/", "", "", true, false},
		{"/b", "b", "", false, false},
		{"/b/", "b", "", false, false},
		{"/b/k", "b", "k", false, false},
		{"/b/a/b/c.txt", "b", "a/b/c.txt", false, false},
		{"/b//k", "b", "/k", false, false},
		{"/b/a/../c", "b", "a/../c", false, false},
		{"/b/a%2Fb%2Bc+d", "b", "a/b+c+d", false, false}, // '+' in a path is a literal plus
		{"/b/%E2%9C%93", "b", "✓", false, false},
		{"/b/k/", "b", "k/", false, false},
		{"/_healthz", "_healthz", "", false, true},
		{"/_admin/v1/x", "_admin", "", false, true},
	}
	for _, c := range cases {
		tg, err := ParseTarget(req("GET", c.uri, "localhost:9000"), "")
		if err != nil {
			t.Errorf("%s: %v", c.uri, err)
			continue
		}
		if tg.Bucket != c.bucket || tg.Key != c.key || tg.Service != c.service || tg.Reserved != c.reserved || tg.Virtual {
			t.Errorf("%s: got %+v", c.uri, tg)
		}
	}
}

func TestParseTargetVirtualHosted(t *testing.T) {
	cases := []struct {
		uri, host, bucket, key string
		virtual                bool
	}{
		{"/", "photos.s3.example.com", "photos", "", true},
		{"/a/b.png", "photos.s3.example.com:9000", "photos", "a/b.png", true},
		{"/_next/app.js", "photos.s3.example.com", "photos", "_next/app.js", true}, // reserved prefix does not apply
		{"/_peer/v1/x", "photos.s3.example.com", "photos", "_peer/v1/x", true},
		{"//x", "photos.s3.example.com", "photos", "/x", true},
		{"/b/k", "s3.example.com", "b", "k", false}, // bare domain: path-style
		{"/b/k", "other.org", "b", "k", false},
	}
	for _, c := range cases {
		tg, err := ParseTarget(req("GET", c.uri, c.host), "s3.example.com")
		if err != nil {
			t.Errorf("%s: %v", c.uri, err)
			continue
		}
		if tg.Bucket != c.bucket || tg.Key != c.key || tg.Virtual != c.virtual || tg.Reserved {
			t.Errorf("%s %s: got %+v", c.host, c.uri, tg)
		}
	}
}

func TestQueryParsing(t *testing.T) {
	tg, err := ParseTarget(req("GET", "/b?prefix=a+b%2Fc&uploads&x=1;2&delimiter=%2F", "h"), "")
	if err != nil {
		t.Fatal(err)
	}
	if tg.Query.Get("prefix") != "a b/c" || !tg.Query.Has("uploads") || tg.Query.Get("x") != "1;2" || tg.Query.Get("delimiter") != "/" {
		t.Fatalf("%v", tg.Query)
	}
	if _, err := ParseTarget(req("GET", "/b?prefix=%zz", "h"), ""); err == nil {
		t.Fatal("bad escape accepted")
	}
}

func TestDispatch(t *testing.T) {
	cases := []struct {
		method, uri string
		hdr         map[string]string
		op          string
		err         string
	}{
		{"GET", "/", nil, OpListBuckets, ""},
		{"HEAD", "/b", nil, OpHeadBucket, ""},
		{"PUT", "/b", nil, OpCreateBucket, ""},
		{"DELETE", "/b", nil, OpDeleteBucket, ""},
		{"GET", "/b", nil, OpListObjects, ""},
		{"GET", "/b?list-type=2&prefix=a", nil, OpListObjectsV2, ""},
		{"GET", "/b?list-type=2&x-id=ListObjectsV2", nil, OpListObjectsV2, ""},
		{"GET", "/b?versions", nil, OpListObjectVersions, ""},
		{"GET", "/b?uploads", nil, OpListMultipartUploads, ""},
		{"GET", "/b?location", nil, OpGetBucketLocation, ""},
		{"GET", "/b?versioning", nil, OpGetBucketVersioning, ""},
		{"PUT", "/b?versioning", nil, OpBucketRestricted, ""},
		{"DELETE", "/b?lifecycle", nil, OpBucketRestricted, ""},
		{"PUT", "/b?acl", nil, OpPutBucketAcl, ""},
		{"GET", "/b?policy", nil, OpBucketStub, ""},
		{"PUT", "/b?policy", nil, "", "NotImplemented"},
		{"GET", "/b?logging", nil, OpBucketStub, ""},
		{"GET", "/b?accelerate", nil, "", "NotImplemented"},
		{"GET", "/b?bogus=1", nil, "", "NotImplemented"},
		{"POST", "/b?delete", nil, OpDeleteObjects, ""},
		{"POST", "/b", map[string]string{"Content-Type": "multipart/form-data; boundary=x"}, OpPostObject, ""},
		{"POST", "/b", nil, "", "MethodNotAllowed"},
		{"GET", "/b/k", nil, OpGetObject, ""},
		{"GET", "/b/k?versionId=x&response-content-type=a", nil, OpGetObject, ""},
		{"GET", "/b/k?tagging", nil, OpGetObjectTagging, ""},
		{"GET", "/b/k?attributes", nil, OpGetObjectAttributes, ""},
		{"GET", "/b/k?uploadId=u", nil, OpListParts, ""},
		{"HEAD", "/b/k", nil, OpHeadObject, ""},
		{"PUT", "/b/k", nil, OpPutObject, ""},
		{"PUT", "/b/k", map[string]string{"x-amz-copy-source": "/b/o"}, OpCopyObject, ""},
		{"PUT", "/b/k?uploadId=u&partNumber=1", nil, OpUploadPart, ""},
		{"PUT", "/b/k?uploadId=u&partNumber=1", map[string]string{"x-amz-copy-source": "/b/o"}, OpUploadPartCopy, ""},
		{"PUT", "/b/k?tagging", nil, OpPutObjectTagging, ""},
		{"PUT", "/b/k?acl", nil, OpPutObjectAcl, ""},
		{"DELETE", "/b/k", nil, OpDeleteObject, ""},
		{"DELETE", "/b/k?versionId=v", nil, OpDeleteObject, ""},
		{"DELETE", "/b/k?uploadId=u", nil, OpAbortMultipartUpload, ""},
		{"DELETE", "/b/k?tagging", nil, OpDeleteObjectTagging, ""},
		{"POST", "/b/k?uploads", nil, OpCreateMultipartUpload, ""},
		{"POST", "/b/k?uploadId=u", nil, OpCompleteMultipartUpload, ""},
		{"GET", "/b/k?retention", nil, "", "NotImplemented"},
		{"POST", "/b/k?restore", nil, "", "NotImplemented"},
		{"OPTIONS", "/b/k", nil, OpOptions, ""},
		{"PATCH", "/b/k", nil, "", "MethodNotAllowed"},
	}
	for _, c := range cases {
		r := req(c.method, c.uri, "h")
		for k, v := range c.hdr {
			r.Header.Set(k, v)
		}
		tg, err := ParseTarget(r, "")
		if err != nil {
			t.Errorf("%s %s: %v", c.method, c.uri, err)
			continue
		}
		op, _, derr := Dispatch(r, tg)
		got := ""
		if derr != nil {
			got = derr.(interface{ Error() string }).Error()
		}
		switch {
		case c.err != "" && (derr == nil || !contains(got, c.err)):
			t.Errorf("%s %s: want error %s, got op=%q err=%v", c.method, c.uri, c.err, op, derr)
		case c.err == "" && (derr != nil || op != c.op):
			t.Errorf("%s %s: want %s, got %q err=%v", c.method, c.uri, c.op, op, derr)
		}
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
