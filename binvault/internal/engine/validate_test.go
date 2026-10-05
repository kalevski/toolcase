package engine

import (
	"strings"
	"testing"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
)

func TestValidateKey(t *testing.T) {
	for _, k := range []string{"a", "a/b/../c", "//x", "ключ", strings.Repeat("x", 1024)} {
		if err := ValidateKey(k); err != nil {
			t.Errorf("%q: %v", k, err)
		}
	}
	for _, k := range []string{"", "a\x00b", "\xff\xfe", strings.Repeat("x", 1025)} {
		if err := ValidateKey(k); err == nil {
			t.Errorf("%q must be refused", k)
		}
	}
}

func TestBucketNames(t *testing.T) {
	ok := []string{"abc", "my-bucket", "a.b.c", "123abc"}
	bad := []string{"ab", "-abc", "abc-", "a..b", "192.168.1.1", "_abc", "ABC", strings.Repeat("a", 64), "a_b"}
	for _, n := range ok {
		if err := ValidateBucketName(n, false); err != nil {
			t.Errorf("%q: %v", n, err)
		}
	}
	for _, n := range bad {
		if err := ValidateBucketName(n, false); err == nil {
			t.Errorf("%q must be refused", n)
		}
	}
	if err := ValidateBucketName("a.b", true); err == nil {
		t.Error("dots must be refused while a domain is set")
	}
}

func TestTypeAllowed(t *testing.T) {
	cases := []struct {
		pats []string
		ct   string
		want bool
	}{
		{nil, "anything", true},
		{[]string{"image/*"}, "image/png", true},
		{[]string{"image/*"}, "Image/PNG; charset=x", true},
		{[]string{"image/*"}, "application/pdf", false},
		{[]string{"application/pdf", "text/plain"}, "text/plain; charset=utf-8", true},
		{[]string{"application/pdf"}, "application/pdfx", false},
		{[]string{"*/*"}, "x/y", true},
	}
	for _, c := range cases {
		if got := TypeAllowed(c.pats, c.ct); got != c.want {
			t.Errorf("%v %q = %v", c.pats, c.ct, got)
		}
	}
}

func TestSniff(t *testing.T) {
	cases := map[string]string{
		"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR":            "image/png",
		"%PDF-1.4\n":                                     "application/pdf",
		"GIF89a......":                                   "image/gif",
		"hello world":                                    "text/plain; charset=utf-8",
		"\x00\x01\x02\x03\x04\x05\x06\x07":               "application/octet-stream",
		"<svg xmlns='http://www.w3.org/2000/svg'></svg>": "image/svg+xml",
		"SQLite format 3\x00rest":                        "application/vnd.sqlite3",
		"\x00\x00\x00\x18ftypavif\x00\x00\x00\x00":       "image/avif",
	}
	for in, want := range cases {
		if got := Sniff([]byte(in)); got != want {
			t.Errorf("%q: got %q want %q", in[:min(len(in), 12)], got, want)
		}
	}
}

func TestTags(t *testing.T) {
	if _, err := ParseTagging("a=1&b=two%20words"); err != nil {
		t.Fatal(err)
	}
	if _, err := ParseTagging("a=1&a=2"); err == nil {
		t.Fatal("duplicate keys must be refused")
	}
	long := map[string]string{strings.Repeat("k", 129): "v"}
	if err := ValidateTags(long); err == nil {
		t.Fatal("long key accepted")
	}
	many := map[string]string{}
	for i := 0; i < 11; i++ {
		many[string(rune('a'+i))] = "v"
	}
	if err := ValidateTags(many); err == nil {
		t.Fatal("11 tags accepted")
	}
}

// S3 tag syntax: letters, numbers, separator spaces and + - = . _ : / @ — never a
// control character such as CR, LF or TAB (spec §10: no header injection).
func TestTagSyntax(t *testing.T) {
	for _, ok := range []string{"env", "a b", "a\u00a0b", "a\u3000b", "unié 日本", "n1½", "k+-=._:/@", "x=y", "a\u2028b"} {
		if err := ValidateTags(map[string]string{ok: ok}); err != nil {
			t.Errorf("%q refused: %v", ok, err)
		}
	}
	for _, bad := range []string{"a\nb", "a\rb", "a\tb", "k\n", "a\r\nX-Evil: 1", "a\x00b", "a\vb", "a\fb", "a\u0085b", "<x>", "a;b", "a|b", "a&b", "a%b", "a\u200bb"} {
		for _, in := range []map[string]string{{bad: "v"}, {"k": bad}} {
			err := ValidateTags(in)
			if e, ok := apierr.As(err); !ok || e.Code != "InvalidTag" {
				t.Errorf("%v: %v, want InvalidTag", in, err)
			}
		}
	}
	if _, err := ParseTagging("a=b%0d%0aX-Evil%3D1"); err == nil {
		t.Error("CRLF in a tagging header value accepted")
	}
	if _, err := ParseTagging("k%0a=v"); err == nil {
		t.Error("LF in a tag key accepted")
	}
}

func TestMetadata(t *testing.T) {
	if err := ValidateMetadata(map[string]string{"user": "42"}); err != nil {
		t.Fatal(err)
	}
	if err := ValidateMetadata(map[string]string{"user": "é"}); err == nil {
		t.Fatal("non-ASCII value accepted")
	}
	if err := ValidateMetadata(map[string]string{"k": strings.Repeat("x", 2049)}); err == nil {
		t.Fatal("oversized metadata accepted")
	}
}
