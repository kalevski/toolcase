package httpcond

import (
	"net/http"
	"testing"
	"time"
)

var mod = time.Date(2026, 10, 2, 12, 0, 0, 500_000_000, time.UTC)

func hdr(kv ...string) http.Header {
	h := http.Header{}
	for i := 0; i+1 < len(kv); i += 2 {
		h.Set(kv[i], kv[i+1])
	}
	return h
}

func TestEvaluate(t *testing.T) {
	later := mod.Add(time.Hour).Format(http.TimeFormat)
	earlier := mod.Add(-time.Hour).Format(http.TimeFormat)
	same := mod.Format(http.TimeFormat)
	cases := []struct {
		name string
		h    http.Header
		want Result
	}{
		{"none", hdr(), Proceed},
		{"if-match hit", hdr("If-Match", `"abc"`), Proceed},
		{"if-match miss", hdr("If-Match", `"zzz"`), Failed},
		{"if-match star", hdr("If-Match", `*`), Proceed},
		{"if-match list", hdr("If-Match", `"x", "abc"`), Proceed},
		{"if-none-match hit", hdr("If-None-Match", `"abc"`), NotModified},
		{"if-none-match weak", hdr("If-None-Match", `W/"abc"`), NotModified},
		{"if-none-match miss", hdr("If-None-Match", `"zzz"`), Proceed},
		{"unmodified-since earlier", hdr("If-Unmodified-Since", earlier), Failed},
		{"unmodified-since later", hdr("If-Unmodified-Since", later), Proceed},
		{"unmodified-since same second", hdr("If-Unmodified-Since", same), Proceed},
		{"modified-since later", hdr("If-Modified-Since", later), NotModified},
		{"modified-since earlier", hdr("If-Modified-Since", earlier), Proceed},
		{"modified-since same", hdr("If-Modified-Since", same), NotModified},
		// If-Match present: If-Unmodified-Since is ignored
		{"match beats unmodified", hdr("If-Match", `"abc"`, "If-Unmodified-Since", earlier), Proceed},
		// If-None-Match present: If-Modified-Since is ignored
		{"none-match beats modified", hdr("If-None-Match", `"zzz"`, "If-Modified-Since", later), Proceed},
		{"bad date ignored", hdr("If-Modified-Since", "garbage"), Proceed},
	}
	for _, c := range cases {
		if got := Evaluate(c.h, "abc", mod); got != c.want {
			t.Errorf("%s: got %d want %d", c.name, got, c.want)
		}
	}
}

func TestEvaluateCopy(t *testing.T) {
	later := mod.Add(time.Hour).Format(http.TimeFormat)
	earlier := mod.Add(-time.Hour).Format(http.TimeFormat)
	cases := []struct {
		h    http.Header
		want bool
	}{
		{hdr(), true},
		{hdr("x-amz-copy-source-if-match", `"abc"`), true},
		{hdr("x-amz-copy-source-if-match", `"zzz"`), false},
		{hdr("x-amz-copy-source-if-none-match", `"abc"`), false},
		{hdr("x-amz-copy-source-if-none-match", `"zzz"`), true},
		{hdr("x-amz-copy-source-if-unmodified-since", earlier), false},
		{hdr("x-amz-copy-source-if-unmodified-since", later), true},
		{hdr("x-amz-copy-source-if-modified-since", later), false},
		{hdr("x-amz-copy-source-if-modified-since", earlier), true},
		// RFC 9110 / S3 precedence: If-Match decides over If-Unmodified-Since ...
		{hdr("x-amz-copy-source-if-match", `"abc"`, "x-amz-copy-source-if-unmodified-since", earlier), true},
		{hdr("x-amz-copy-source-if-match", `"zzz"`, "x-amz-copy-source-if-unmodified-since", later), false},
		// ... and If-None-Match over If-Modified-Since
		{hdr("x-amz-copy-source-if-none-match", `"zzz"`, "x-amz-copy-source-if-modified-since", later), true},
		{hdr("x-amz-copy-source-if-none-match", `"abc"`, "x-amz-copy-source-if-modified-since", earlier), false},
	}
	for i, c := range cases {
		if got := EvaluateCopy(c.h, "abc", mod); got != c.want {
			t.Errorf("case %d: got %v want %v", i, got, c.want)
		}
	}
}

func TestParseRange(t *testing.T) {
	const size = 100
	cases := []struct {
		in    string
		res   RangeResult
		start int64
		len   int64
	}{
		{"", Whole, 0, 100},
		{"bytes=0-9", Partial, 0, 10},
		{"bytes=10-", Partial, 10, 90},
		{"bytes=-10", Partial, 90, 10},
		{"bytes=-1000", Partial, 0, 100},
		{"bytes=90-1000", Partial, 90, 10},
		{"bytes=99-99", Partial, 99, 1},
		{"bytes=100-", Unsatisfiable, 0, 0},
		{"bytes=100-200", Unsatisfiable, 0, 0},
		{"bytes=-0", Unsatisfiable, 0, 0},
		{"bytes=0-1,5-6", Whole, 0, 100}, // several ranges: ignored
		{"bytes=5-2", Whole, 0, 100},     // invalid: ignored
		{"bytes=abc", Whole, 0, 100},
		{"items=0-5", Whole, 0, 100},
		{"BYTES=0-4", Partial, 0, 5},
		{"bytes=-", Whole, 0, 100},
	}
	for _, c := range cases {
		r, res := ParseRange(c.in, size)
		if res != c.res || (res == Partial && (r.Start != c.start || r.Length != c.len)) {
			t.Errorf("%q: got %+v %d, want %d %d+%d", c.in, r, res, c.res, c.start, c.len)
		}
	}
	if _, res := ParseRange("bytes=0-0", 0); res != Unsatisfiable {
		t.Error("range on an empty object must be unsatisfiable")
	}
}

func TestParseCopyRange(t *testing.T) {
	if r, ok := ParseCopyRange("bytes=0-9", 100); !ok || r.Start != 0 || r.Length != 10 {
		t.Fatalf("%+v %v", r, ok)
	}
	if r, ok := ParseCopyRange("bytes=95-200", 100); !ok || r.Length != 5 {
		t.Fatalf("%+v %v", r, ok)
	}
	for _, bad := range []string{"bytes=5-", "bytes=-5", "0-5", "bytes=9-1", "bytes=100-101", "bytes=a-b"} {
		if _, ok := ParseCopyRange(bad, 100); ok {
			t.Errorf("%q must be invalid", bad)
		}
	}
}
