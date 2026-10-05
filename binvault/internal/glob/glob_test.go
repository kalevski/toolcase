package glob

import (
	"math/rand/v2"
	"regexp"
	"strings"
	"testing"

	"github.com/bmatcuk/doublestar/v4"
)

func TestMatch(t *testing.T) {
	tests := []struct {
		pattern string
		yes, no []string
	}{
		// Spec §7.2, §7.3, §7.11 and §7.14 examples.
		{"uploads/**",
			[]string{"uploads/a.jpg", "uploads/2026/09/a.jpg", "uploads/"},
			[]string{"uploads", "uploadsx/a", "x/uploads/a", "Uploads/a"}},
		{"uploads/raw/**",
			[]string{"uploads/raw/a", "uploads/raw/x/y"},
			[]string{"uploads/rawx/a", "uploads/a"}},
		{"derived/**",
			[]string{"derived/uploads/a.png/thumb.webp"},
			[]string{"uploads/derived/a", "derived"}},
		{"**/*.{jpg,jpeg,JPG,JPEG}",
			[]string{"a.jpg", "x/a.jpeg", "x/y/z/a.JPG", "a.JPEG", "/a.jpg", ".jpg"},
			[]string{"a.Jpg", "a.png", "a.jpg/b", "a.jpgx", "ajpg"}},
		{"**/*.jpg", []string{"a.jpg"}, []string{"A.JPG", "a.JPG"}}, // case-sensitive

		// '*' and '?' stay inside one segment.
		{"*", []string{"a", "a.b", " ", "é"}, []string{"a/b", "a/", "/a"}},
		{"*/", []string{"a/"}, []string{"a", "a/b"}},
		{"a/*", []string{"a/b", "a/"}, []string{"a/b/c", "a"}},
		{"?", []string{"a", "é", "日"}, []string{"ab", "/"}},
		{"photos/?.png", []string{"photos/é.png"}, []string{"photos/é.png", "photos/.png"}},
		{"photos/??.png", []string{"photos/é.png"}, []string{"photos/é.png"}},

		// '**' crosses separators; a segment-leading '**/' may match nothing.
		{"**", []string{"a", "a/b/c", "/", "a/"}, nil},
		{"***", []string{"a/b"}, nil},
		{"a**b", []string{"ab", "axb", "a/b", "a/x/y/b"}, []string{"a/x/bc", "xab", "a"}},
		{"a/**/b", []string{"a/b", "a/x/b", "a/x/y/b", "a//b"}, []string{"ab", "a/xb", "a/b/c", "xa/b"}},
		{"**/x", []string{"x", "a/x", "a/b/x", "/x"}, []string{"ax", "x/a"}},
		{"x/**", []string{"x/", "x/y", "x/y/z"}, []string{"x", "xy"}},
		{"x/**/*", []string{"x/", "x/a", "x/a/b"}, []string{"x"}},
		{"**/**/x", []string{"x", "a/b/x"}, []string{"xa"}},
		{"uploads/**.jpg",
			[]string{"uploads/a.jpg", "uploads/x/a.jpg", "uploads/x/y/a.jpg"},
			[]string{"uploads/a.png", "a.jpg"}},
		{"a/**b", []string{"a/b", "a/xb", "a/x/b", "a/x/yb"}, []string{"ab"}},
		{"a**/b", []string{"a/b", "ax/b", "a/x/b"}, []string{"ab"}},
		{"a\\/**/b", []string{"a/b", "a/x/b"}, nil}, // an escaped '/' is still a separator

		// Classes.
		{"[abc]", []string{"a", "c"}, []string{"d", "ab"}},
		{"[a-c]x", []string{"bx"}, []string{"dx"}},
		{"[!a-c]", []string{"d", "é"}, []string{"a", "/"}},
		{"[^a]", []string{"b"}, []string{"a", "/"}},
		{"[\\]]", []string{"]"}, []string{"\\"}},
		{"[a\\-z]", []string{"-", "a", "z"}, []string{"b"}},
		{"[-a]", []string{"-", "a"}, nil},
		{"[a-]", []string{"-", "a"}, nil},
		{"[+-0]", []string{"+", ".", "0"}, []string{"/"}}, // a range spanning '/' still skips it
		{"[α-ω]*", []string{"λx"}, []string{"ax"}},
		{"x[!.]*", []string{"xa", "xab"}, []string{"x.a", "x/a", "x"}},

		// Escapes.
		{"\\*", []string{"*"}, []string{"a", "\\*"}},
		{"a\\?b", []string{"a?b"}, []string{"axb"}},
		{"\\[x\\]", []string{"[x]"}, []string{"x"}},
		{"\\{a,b\\}", []string{"{a,b}"}, []string{"a"}},
		{"\\\\", []string{"\\"}, []string{"\\\\"}},
		{"\\é", []string{"é"}, nil},
		{"a\\**", []string{"a*", "a*b"}, []string{"ab"}},

		// Alternatives.
		{"{a,b}/c", []string{"a/c", "b/c"}, []string{"c", "ab/c"}},
		{"{a,b{c,d}}", []string{"a", "bc", "bd"}, []string{"b", "bcd"}},
		{"x{,y}", []string{"x", "xy"}, []string{"y"}},
		{"a,b", []string{"a,b"}, []string{"a"}},
		{"{uploads,incoming}/**", []string{"incoming/a", "uploads/a/b"}, []string{"other/a"}},
		{"{**/,}x.txt", []string{"x.txt", "a/x.txt"}, []string{"ax.txt"}},
		{"{a/,b}**/c", []string{"a/c", "a/x/c", "b/c", "bx/c", "b/x/c"}, []string{"bc", "ac"}},
		{"{[ab],c}d", []string{"ad", "cd"}, []string{"[ab]d"}},

		// Keys are byte-exact: spaces, unicode, leading and trailing slashes.
		{"my photos/*.jpg", []string{"my photos/a b.jpg"}, []string{"my photos/x/a.jpg", "myphotos/a.jpg"}},
		{"日本/*", []string{"日本/写真.jpg"}, []string{"日本"}},
		{"/a/*", []string{"/a/b"}, []string{"a/b"}},
		{"a/", []string{"a/"}, []string{"a"}},
		{"a//b", []string{"a//b"}, []string{"a/b"}},
	}
	for _, tc := range tests {
		if err := Valid(tc.pattern); err != nil {
			t.Errorf("Valid(%q) = %v", tc.pattern, err)
			continue
		}
		for _, name := range tc.yes {
			if !Match(tc.pattern, name) {
				t.Errorf("Match(%q, %q) = false, want true", tc.pattern, name)
			}
		}
		for _, name := range tc.no {
			if Match(tc.pattern, name) {
				t.Errorf("Match(%q, %q) = true, want false", tc.pattern, name)
			}
		}
	}
}

func TestInvalid(t *testing.T) {
	tests := []struct {
		pattern string
		reason  string // substring of the error
	}{
		{"", "empty"},
		{"a[", "'[' without ']'"},
		{"a[]", "empty character class"},
		{"a[!]", "empty character class"},
		{"[]a]", "empty character class"},
		{"a[\\", "'[' without ']'"},
		{"a{b", "'{' without '}'"},
		{"{a,b", "'{' without '}'"},
		{"a}b", "'}' without '{'"},
		{"a\\", "trailing"},
		{"[z-a]", "reversed"},
		{"[/]", "never matches '/'"},
		{"[a/b]", "never matches '/'"},
		{"[!/]", "never matches '/'"},
		{"[+-/]", "never matches '/'"},
		{"[a-/]", "reversed"},
		{"[\\/]", "never matches '/'"},
		{strings.Repeat("{a,b}", 9), "alternatives"},
		{"{" + strings.Repeat("a,", 256) + "a}", "alternatives"},
		{strings.Repeat("a", 1025), "longer than"},
		{"a\x00b", "NUL"},
		{"a\xffb", "UTF-8"},
	}
	for _, tc := range tests {
		err := Valid(tc.pattern)
		if err == nil {
			t.Errorf("Valid(%q) = nil, want an error", tc.pattern)
			continue
		}
		if !strings.Contains(err.Error(), tc.reason) {
			t.Errorf("Valid(%q) = %q, want it to mention %q", tc.pattern, err, tc.reason)
		}
		if Match(tc.pattern, "a") || Match(tc.pattern, tc.pattern) {
			t.Errorf("invalid pattern %q matched", tc.pattern)
		}
	}
	// The limits themselves are accepted.
	for _, p := range []string{strings.Repeat("{a,b}", 8), strings.Repeat("a", 1024)} {
		if err := Valid(p); err != nil {
			t.Errorf("Valid(%.20q...) = %v", p, err)
		}
	}
}

// TestAgreesWithDoublestar cross-checks patterns on which §7.3 and
// doublestar.Match agree.
func TestAgreesWithDoublestar(t *testing.T) {
	tests := []struct{ pattern, name string }{
		{"uploads/**", "uploads/a/b"},
		{"uploads/*", "uploads/a/b"},
		{"uploads/*", "uploads/a"},
		{"**/*.{jpg,jpeg}", "a.jpg"},
		{"**/*.{jpg,jpeg}", "x/y/a.jpeg"},
		{"**/*.{jpg,jpeg}", "x/y/a.png"},
		{"a/**/b", "a/b"},
		{"a/**/b", "a/x/y/b"},
		{"a/**/b", "a/x/y/c"},
		{"**/x", "x"},
		{"*.txt", "a.txt"},
		{"*.txt", "d/a.txt"},
		{"?x", "ax"},
		{"?x", "/x"},
		{"[a-c]x", "bx"},
		{"[!a-c]x", "dx"},
		{"[!a-c]x", "ax"},
		{"{a,b}/c", "b/c"},
		{"{a,b{c,d}}", "bd"},
		{"x{,y}", "x"},
		{"\\*", "*"},
		{"\\*", "a"},
		{"a\\{b\\}", "a{b}"},
		{"日本/*", "日本/写真.jpg"},
	}
	for _, tc := range tests {
		want, err := doublestar.Match(tc.pattern, tc.name)
		if err != nil {
			t.Fatalf("doublestar.Match(%q): %v", tc.pattern, err)
		}
		if got := Match(tc.pattern, tc.name); got != want {
			t.Errorf("Match(%q, %q) = %v, doublestar says %v", tc.pattern, tc.name, got, want)
		}
	}
}

// TestDiffersFromDoublestar pins the cases where doublestar.Match departs
// from §7.3, which is why Match does not delegate to it.
func TestDiffersFromDoublestar(t *testing.T) {
	tests := []struct {
		pattern, name string
		want          bool // §7.3; doublestar answers the opposite
	}{
		{"a**b", "a/x/b", true},                     // "**" is any run, '/' included
		{"uploads/**.jpg", "uploads/x/a.jpg", true}, // likewise mid-segment
		{"uploads/**", "uploads", false},            // a trailing "/**" needs the '/'
		{"uploads/**/*", "uploads/", true},          // consistent with "uploads/**"
		{"a[!x]b", "a/b", false},                    // a class never matches '/'
	}
	for _, tc := range tests {
		ds, err := doublestar.Match(tc.pattern, tc.name)
		if err != nil {
			t.Fatalf("doublestar.Match(%q): %v", tc.pattern, err)
		}
		if ds == tc.want {
			t.Errorf("doublestar now agrees on Match(%q, %q); revisit the package doc", tc.pattern, tc.name)
		}
		if got := Match(tc.pattern, tc.name); got != tc.want {
			t.Errorf("Match(%q, %q) = %v, want %v", tc.pattern, tc.name, got, tc.want)
		}
	}
}

// toRegexp translates a pattern built by TestAgainstRegexp (no escaped '/',
// no nested braces, braces holding only literals) into a regexp with the
// §7.3 semantics, as an independent oracle for the matcher. Like the package,
// it expands braces textually first.
func toRegexp(p string) string {
	alts := []string{""}
	for len(p) > 0 {
		i := strings.IndexByte(p, '{')
		if i < 0 {
			i = len(p)
		}
		var next []string
		for _, a := range alts {
			next = append(next, a+p[:i])
		}
		alts, p = next, p[i:]
		if p == "" {
			break
		}
		end := strings.IndexByte(p, '}')
		next = nil
		for _, a := range alts {
			for _, opt := range strings.Split(p[1:end], ",") {
				next = append(next, a+opt)
			}
		}
		alts, p = next, p[end+1:]
	}
	res := make([]string, len(alts))
	for i, a := range alts {
		res[i] = braceFreeRegexp(a)
	}
	return "^(?:" + strings.Join(res, "|") + ")$"
}

func braceFreeRegexp(p string) string {
	var b strings.Builder
	for i := 0; i < len(p); {
		switch c := p[i]; c {
		case '\\':
			b.WriteString(regexp.QuoteMeta(p[i+1 : i+2]))
			i += 2
		case '*':
			j := i
			for j < len(p) && p[j] == '*' {
				j++
			}
			switch {
			case j-i == 1:
				b.WriteString("[^/]*")
			case (i == 0 || p[i-1] == '/') && j < len(p) && p[j] == '/':
				b.WriteString("(?:.*/)?")
				j++
			default:
				b.WriteString(".*")
			}
			i = j
		case '?':
			b.WriteString("[^/]")
			i++
		case '[':
			end := strings.IndexByte(p[i:], ']') + i
			if p[i+1] == '!' {
				b.WriteString("[^/" + p[i+2:end] + "]")
			} else {
				b.WriteString(p[i : end+1])
			}
			i = end + 1
		default:
			b.WriteString(regexp.QuoteMeta(p[i : i+1]))
			i++
		}
	}
	return b.String()
}

func TestAgainstRegexp(t *testing.T) {
	rng := rand.New(rand.NewPCG(3, 5))
	pieces := []string{"a", "b", "/", "/", "*", "**", "?", "[ab]", "[!a]", `\*`, "{a,b}", "{a,}", "{ab,b/a}"}
	names := []byte("ab/*")
	for range 4000 {
		var pb strings.Builder
		for range 1 + rng.IntN(6) {
			pb.WriteString(pieces[rng.IntN(len(pieces))])
		}
		p := pb.String()
		if err := Valid(p); err != nil {
			t.Fatalf("generated pattern %q is invalid: %v", p, err)
		}
		re := regexp.MustCompile(toRegexp(p))
		for range 30 {
			nb := make([]byte, rng.IntN(9))
			for i := range nb {
				nb[i] = names[rng.IntN(len(names))]
			}
			name := string(nb)
			if got, want := Match(p, name), re.MatchString(name); got != want {
				t.Fatalf("Match(%q, %q) = %v, regexp %s says %v", p, name, got, toRegexp(p), want)
			}
		}
	}
}

// TestStricterThanDoublestar checks that Valid rejects every pattern that
// doublestar.ValidatePattern rejects, so the two never disagree the other way.
func TestStricterThanDoublestar(t *testing.T) {
	rng := rand.New(rand.NewPCG(8, 13))
	alphabet := []byte(`a/*?[]{},\!^-`)
	for range 50000 {
		b := make([]byte, 1+rng.IntN(8))
		for i := range b {
			b[i] = alphabet[rng.IntN(len(alphabet))]
		}
		p := string(b)
		if !doublestar.ValidatePattern(p) && Valid(p) == nil {
			t.Fatalf("Valid(%q) accepts a pattern doublestar rejects", p)
		}
	}
}

func TestSet(t *testing.T) {
	tests := []struct {
		set  Set
		name string
		want bool
	}{
		{nil, "a", false},
		{Set{}, "a", false},
		{Set{"a/*", "b/**"}, "b/x/y", true},
		{Set{"a/*", "b/**"}, "a/x", true},
		{Set{"a/*", "b/**"}, "c/x", false},
		{Set{"a[", "c/*"}, "c/x", true}, // an invalid pattern matches nothing, the rest still apply
	}
	for _, tc := range tests {
		if got := tc.set.MatchAny(tc.name); got != tc.want {
			t.Errorf("%q.MatchAny(%q) = %v, want %v", tc.set, tc.name, got, tc.want)
		}
	}

	if err := (Set{}).Valid(); err != nil {
		t.Errorf("empty Set: %v", err)
	}
	if err := (Set{"uploads/**", "**/*.{jpg,png}"}).Valid(); err != nil {
		t.Errorf("valid Set: %v", err)
	}
	err := Set{"uploads/**", "x/[", "y{"}.Valid()
	if err == nil || !strings.Contains(err.Error(), `"x/["`) {
		t.Errorf("Set.Valid() = %v, want the error of the first invalid pattern", err)
	}
}

func TestLongKey(t *testing.T) {
	key := strings.Repeat("ab/", 341) + "c.jpg" // 1028 bytes
	if !Match("**/*.jpg", key) || !Match("**", key) || !Match("ab/**/c.jpg", key) {
		t.Error("long key did not match")
	}
	if Match("**/*.png", key) || Match("*", key) {
		t.Error("long key matched a pattern it should not")
	}
}

func BenchmarkMatch(b *testing.B) {
	key := "uploads/2026/09/photos/holiday/IMG_0001.JPEG"
	for range b.N {
		Match("**/*.{jpg,jpeg,JPG,JPEG}", key)
	}
}
