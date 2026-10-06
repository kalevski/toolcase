package sanitize

import (
	"strings"
	"testing"
)

// A realistic newsletter-like body: inline styles, tables, links, remote images.
var benchHTML = "<html><head><style>p{color:red} .a{margin:0}</style></head><body>" +
	strings.Repeat(`<div class="a"><p style="color:#333;font-size:14px">Hello <b>world</b> <a href="https://example.org/x?y=1">link</a> <img src="https://t.example/p.gif"> text text text text</p><table><tr><td style="padding:4px">cell</td></tr></table></div>`, 6000) +
	"</body></html>"

func BenchmarkSanitize(b *testing.B) {
	b.SetBytes(int64(len(benchHTML)))
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		Sanitize(benchHTML, Options{})
	}
}

func BenchmarkCleanValue(b *testing.B) {
	for i := 0; i < b.N; i++ {
		cleanValue("font-size", "14px", CSSOptions{})
	}
}

// badValue must agree with the regexp it short-cuts, for ASCII and non-ASCII.
func TestBadValueMatchesRegexp(t *testing.T) {
	cases := []string{"14px", "#333", "red", "expression(alert(1))", "EXPRESSION(x)", "JavaScript:x", "vbscript:x", "livescript:x",
		"behavior:url(x)", "-Moz-binding:url(x)", "binding", "@IMPORT", "image-set(x)", "a/*b", "a\\b", "a<b", "a>b", "a{b", "a}b",
		"expreſsion(x)", "exprεssion", "ǅ", "Kelvin K", "10px solid #fff", "Arial, 'Helvetica Neue', sans-serif", "url(x)", "", "a/b", "-moz", "moz-"}
	for _, c := range cases {
		if got, want := badValue(c), reBadValue.MatchString(c); got != want {
			t.Errorf("badValue(%q) = %v, regexp says %v", c, got, want)
		}
	}
}
