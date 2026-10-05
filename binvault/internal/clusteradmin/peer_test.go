package clusteradmin

import (
	"net/http"
	"strings"
	"testing"
)

func TestBucketOfCall(t *testing.T) {
	for _, c := range []struct {
		method string
		path   string
		body   string
		want   string
	}{
		{"GET", "/buckets/photos", "", "photos"},
		{"PATCH", "/buckets/photos", "", "photos"},
		{"DELETE", "/buckets/photos", "", "photos"},
		{"POST", "/buckets/photos/tokens", "", "photos"},
		{"PUT", "/buckets/photos/pipelines", "", "photos"},
		{"POST", "/buckets", `{"name":"x"}`, ""}, // creation is placed, not routed to a home
		{"GET", "/buckets", "", ""},
		{"POST", "/backfills", `{"bucket":"photos","pipeline":"p"}`, "photos"},
		{"POST", "/backfills", `not json`, ""},
		{"GET", "/backfills", "", ""},
		{"POST", "/pipelines/p/test", `{"bucket":"b1","key":"k"}`, "b1"},
		{"POST", "/pipelines", `{"bucket":"b1"}`, ""},
		{"GET", "/runs", "", ""},
		{"GET", "/cluster", "", ""},
	} {
		if got := bucketOfCall(c.method, splitPath(c.path), []byte(c.body)); got != c.want {
			t.Errorf("%s %s: %q, want %q", c.method, c.path, got, c.want)
		}
	}
}

func TestValidEnvelope(t *testing.T) {
	ok := envelope{Method: "POST", Path: "/buckets/photos/tokens", Query: "wait=replicated", Headers: map[string]string{"Content-Type": "application/json", "if-match": `"3"`}}
	if err := validEnvelope(&ok); err != nil {
		t.Fatalf("a valid envelope: %v", err)
	}
	for name, e := range map[string]envelope{
		"method":        {Method: "TRACE", Path: "/x"},
		"no slash":      {Method: "GET", Path: "buckets"},
		"query in path": {Method: "GET", Path: "/buckets?x=1"},
		"empty segment": {Method: "GET", Path: "/buckets//x"},
		"fragment":      {Method: "GET", Path: "/buckets#x"},
		"query space":   {Method: "GET", Path: "/x", Query: "a b"},
		"header":        {Method: "GET", Path: "/x", Headers: map[string]string{"Authorization": "Bearer secret"}},
		"body":          {Method: "POST", Path: "/x", Body: []byte(strings.Repeat("x", bodyLimit+2))},
	} {
		if err := validEnvelope(&e); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}

func TestSplitPath(t *testing.T) {
	if got := splitPath("/buckets/a/tokens"); len(got) != 3 || got[0] != "buckets" || got[2] != "tokens" {
		t.Fatalf("%v", got)
	}
	if splitPath("/") != nil {
		t.Fatal("the root has no segments")
	}
}

func TestWriteReplyCopiesOnlyWhatMatters(t *testing.T) {
	rec := &capture{h: http.Header{}, status: 200}
	writeReply(rec, reply{status: 409, header: http.Header{"Content-Type": {"application/json"}, "Set-Cookie": {"x=1"}, "X-Other": {"y"}}, body: []byte(`{"error":"conflict"}`)})
	if rec.status != 409 || rec.h.Get("Content-Type") != "application/json" || rec.h.Get("Set-Cookie") != "" || rec.h.Get("X-Other") != "" || rec.buf.String() != `{"error":"conflict"}` {
		t.Fatalf("%d %v %q", rec.status, rec.h, rec.buf.String())
	}
}
