package sigv4

import (
	"math/rand"
	"testing"
)

func TestEncodeS3Path(t *testing.T) {
	tests := map[string]string{
		"":                "",
		"/":               "/",
		"a b":             "a%20b",
		"ü":               "%C3%BC",
		"+":               "%2B",
		"%":               "%25",
		"~-_.":            "~-_.",
		"*":               "%2A",
		"//a/../b/./":     "//a/../b/./",
		"AZaz09":          "AZaz09",
		"!$&'()*+,;=:@":   "%21%24%26%27%28%29%2A%2B%2C%3B%3D%3A%40",
		"?#[]":            "%3F%23%5B%5D",
		"\x00\x7f\xff":    "%00%7F%FF",
		"photos/日本.jpg":   "photos/%E6%97%A5%E6%9C%AC.jpg",
		"test$file.text":  "test%24file.text",
		"a\\b\"c<d>e`f|g": "a%5Cb%22c%3Cd%3Ee%60f%7Cg",
	}
	for in, want := range tests {
		if got := EncodeS3Path(in); got != want {
			t.Fatalf("EncodeS3Path(%q) = %q, want %q", in, got, want)
		}
	}
	if got := uriEncode("a/b c", true); got != "a%2Fb%20c" {
		t.Fatalf("query encoding %q", got)
	}
}

func TestDecodeS3Path(t *testing.T) {
	ok := map[string]string{
		"":       "",
		"a+b":    "a+b",
		"a%2Bb":  "a+b",
		"%2F":    "/",
		"%2f":    "/",
		"%c3%BC": "ü",
		"%41":    "A",
		"%25%32": "%2",
		"/a//b/": "/a//b/",
	}
	for in, want := range ok {
		if got, err := DecodeS3Path(in); err != nil || got != want {
			t.Fatalf("DecodeS3Path(%q) = %q, %v", in, got, err)
		}
	}
	for _, in := range []string{"%", "%2", "%zz", "%%41", "a%g0", "abc%"} {
		if _, err := DecodeS3Path(in); err == nil {
			t.Fatalf("DecodeS3Path(%q) accepted", in)
		}
	}
	rng := rand.New(rand.NewSource(7))
	for i := 0; i < 2000; i++ {
		b := make([]byte, rng.Intn(40))
		rng.Read(b)
		if got, err := DecodeS3Path(EncodeS3Path(string(b))); err != nil || got != string(b) {
			t.Fatalf("round trip of %q: %q %v", b, got, err)
		}
	}
	if got, err := unescape("a+b%20c", true); err != nil || got != "a b c" {
		t.Fatalf("query unescape %q %v", got, err)
	}
}

func TestSplitRequestURI(t *testing.T) {
	tests := []struct{ in, path, query string }{
		{"/b/k?x=1", "/b/k", "x=1"},
		{"/b/k", "/b/k", ""},
		{"/b/k?", "/b/k", ""},
		{"/b/k?a?b", "/b/k", "a?b"},
		{"/", "/", ""},
		{"http://host:9000/b/k?x", "/b/k", "x"},
		{"HTTPS://host/b", "/b", ""},
		{"http://host", "", ""},
		{"http://host?x=1", "", "x=1"},
		{"http://user@host/b//k/../x", "/b//k/../x", ""},
		{"*", "*", ""},
		{"/a://b", "/a://b", ""},
		{"/b/http://x/y?z", "/b/http://x/y", "z"},
		{"", "", ""},
	}
	for _, tc := range tests {
		p, q := SplitRequestURI(tc.in)
		if p != tc.path || q != tc.query {
			t.Fatalf("SplitRequestURI(%q) = %q, %q", tc.in, p, q)
		}
	}
}

func TestCanonicalQuery(t *testing.T) {
	tests := map[string]string{
		"":                             "",
		"b=2&a=1":                      "a=1&b=2",
		"a=2&a=1&a=10":                 "a=1&a=10&a=2",
		"acl":                          "acl=",
		"x=a+b":                        "x=a%20b",
		"x=%7e~":                       "x=~~",
		"x=%2f/":                       "x=%2F%2F",
		"&&x=1&":                       "x=1",
		"=v":                           "=v",
		"%E2%9C%93=1":                  "%E2%9C%93=1",
		"B=1&a=1":                      "B=1&a=1",
		"a~b=1&a_b=1&a.b=1&a-b=1&a=1":  "a=1&a-b=1&a.b=1&a_b=1&a~b=1",
		"x=%2B&x=+":                    "x=%20&x=%2B",
		"prefix=photos%2F2024%2F&max=": "max=&prefix=photos%2F2024%2F",
	}
	for in, want := range tests {
		ps, err := parseQuery(in)
		if err != nil {
			t.Fatal(err)
		}
		if got := canonicalQuery(ps, ""); got != want {
			t.Fatalf("canonicalQuery(%q) = %q, want %q", in, got, want)
		}
	}
	ps, _ := parseQuery("X-Amz-Signature=abc&a=1&X-Amz-Date=x")
	if got := canonicalQuery(ps, "X-Amz-Signature"); got != "X-Amz-Date=x&a=1" {
		t.Fatalf("presigned canonical query %q", got)
	}
}

func TestTrimAll(t *testing.T) {
	tests := map[string]string{
		"":           "",
		"a":          "a",
		"  a  ":      "a",
		"a  b":       "a b",
		"a\t\tb":     "a b",
		"\ta b\t":    "a b",
		" a \t b ":   "a b",
		"a\nb":       "a b",
		"a b":        "a b",
		"   ":        "",
		"x  y   z  ": "x y z",
	}
	for in, want := range tests {
		if got := trimAll(in); got != want {
			t.Fatalf("trimAll(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestKindAndModeNames(t *testing.T) {
	for k, name := range map[Kind]string{None: "none", Header: "header", Presigned: "presigned", Bearer: "bearer", 9: "unknown"} {
		if k.String() != name {
			t.Fatalf("%d: %s", k, k.String())
		}
	}
	for m, name := range map[StreamMode]string{StreamNone: "none", StreamSigned: "signed", StreamSignedTrailer: "signed-trailer",
		StreamUnsignedTrailer: "unsigned-trailer", 9: "unknown"} {
		if m.String() != name {
			t.Fatalf("%d: %s", m, m.String())
		}
	}
}
