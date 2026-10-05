package keypat

import (
	"strings"
	"testing"
)

func TestParse(t *testing.T) {
	tests := []struct {
		in       string
		literal  string
		wildcard bool
		canon    string // String()
	}{
		{"*", "", true, "*"},
		{"a", "a", false, "a"},
		{"photos/2026/a.png", "photos/2026/a.png", false, "photos/2026/a.png"},
		{"derived/x/*", "derived/x/", true, "derived/x/*"},
		{`a\*`, "a*", false, `a\*`},
		{`a\**`, "a*", true, `a\**`},
		{`a\\`, `a\`, false, `a\\`},
		{`a\\*`, `a\`, true, `a\\*`},
		{`\\\*\\`, `\*\`, false, `\\\*\\`},
		{`\{a\}`, "{a}", false, "{a}"},
		{"{raw}/*", "{raw}/", true, "{raw}/*"},
		{"日本/写真 1.jpg", "日本/写真 1.jpg", false, "日本/写真 1.jpg"},
		{"/", "/", false, "/"},
	}
	for _, tc := range tests {
		p, err := Parse(tc.in)
		if err != nil {
			t.Errorf("Parse(%q): %v", tc.in, err)
			continue
		}
		if p.Prefix() != tc.literal || p.HasWildcard() != tc.wildcard {
			t.Errorf("Parse(%q) = {%q, %v}, want {%q, %v}", tc.in, p.Prefix(), p.HasWildcard(), tc.literal, tc.wildcard)
		}
		if got := p.String(); got != tc.canon {
			t.Errorf("Parse(%q).String() = %q, want %q", tc.in, got, tc.canon)
		}
		// Round trip: the canonical form parses back to the same pattern.
		if back, err := Parse(p.String()); err != nil || back != p {
			t.Errorf("Parse(Parse(%q).String()) = %v, %v; want %v", tc.in, back, err, p)
		}
	}
}

func TestParseErrors(t *testing.T) {
	tests := []struct{ in, reason string }{
		{"", "empty"},
		{"a*b", "only at the end"},
		{"*a", "only at the end"},
		{"**", "only at the end"},
		{"a**", "only at the end"},
		{"a/*/b", "only at the end"},
		{`a\`, "lone"},
		{`\`, "lone"},
		{`a\\\`, "lone"},
		{`a\x`, `invalid escape \x`},
		{`a\/b`, `invalid escape \/`},
		{`a\é`, `invalid escape \é`},
	}
	for _, tc := range tests {
		_, err := Parse(tc.in)
		if err == nil {
			t.Errorf("Parse(%q) = nil error", tc.in)
			continue
		}
		if !strings.Contains(err.Error(), tc.reason) {
			t.Errorf("Parse(%q) = %q, want it to mention %q", tc.in, err, tc.reason)
		}
	}
}

func TestMatch(t *testing.T) {
	tests := []struct {
		pattern string
		key     string
		want    bool
	}{
		{"a/b.txt", "a/b.txt", true},
		{"a/b.txt", "a/b.txt2", false},
		{"a/b.txt", "a/b.tx", false},
		{"a/b.txt", "A/b.txt", false},
		{"a/*", "a/b", true},
		{"a/*", "a/b/c/d", true}, // the suffix may contain '/'
		{"a/*", "a/", true},
		{"a/*", "a", false},
		{"a/*", "ab", false},
		{"a*", "ab/c", true},
		{"*", "anything/at/all", true},
		{`a\*`, "a*", true},
		{`a\*`, "ab", false},
		{`a\**`, "a*b", true},
		{`a\**`, "ab", false},
		{`a\\*`, `a\b`, true},
		{`a\\*`, "ab", false},
		{"{x}", "{x}", true},
		{`\{x\}`, "{x}", true},
		{"日本/*", "日本/写真.jpg", true},
		{"日本/*", "日/写真.jpg", false},
	}
	for _, tc := range tests {
		p, err := Parse(tc.pattern)
		if err != nil {
			t.Fatalf("Parse(%q): %v", tc.pattern, err)
		}
		if got := p.Match(tc.key); got != tc.want {
			t.Errorf("Parse(%q).Match(%q) = %v, want %v", tc.pattern, tc.key, got, tc.want)
		}
	}
	if (Pattern{}).Match("a") {
		t.Error("zero Pattern matched a key")
	}
}

func TestMatchAny(t *testing.T) {
	ps := mustParseAll(t, "photos/a.png", "derived/photos/a.png/*")
	tests := []struct {
		key  string
		want bool
	}{
		{"photos/a.png", true},
		{"derived/photos/a.png/thumb.webp", true},
		{"photos/b.png", false},
		{"derived/photos/b.png/thumb.webp", false},
	}
	for _, tc := range tests {
		if got := MatchAny(ps, tc.key); got != tc.want {
			t.Errorf("MatchAny(%q) = %v, want %v", tc.key, got, tc.want)
		}
	}
	if MatchAny(nil, "a") {
		t.Error("no patterns matched a key")
	}
}

func TestAllowsList(t *testing.T) {
	tests := []struct {
		pattern string
		prefix  string
		want    bool
	}{
		{"derived/x/*", "derived/x/", true},
		{"derived/x/*", "derived/x/thumbs/", true},
		{"derived/x/*", "derived/x", false}, // must start with the whole literal part
		{"derived/x/*", "derived/", false},
		{"derived/x/*", "", false},
		{"*", "", true},
		{"*", "any/prefix", true},
		{"a*", "a", true},
		{"a*", "abc", true},
		{"a*", "", false},
		{"a/b.txt", "a/b.txt", true}, // exact: the literal part is the whole key
		{"a/b.txt", "a/b.txt.bak", true},
		{"a/b.txt", "a/b", false},
		{"a/b.txt", "a/", false},
		{"a/b.txt", "", false},
		{`x\*/*`, "x*/", true},
		{`x\*/*`, "xy/", false},
	}
	for _, tc := range tests {
		p, err := Parse(tc.pattern)
		if err != nil {
			t.Fatalf("Parse(%q): %v", tc.pattern, err)
		}
		if got := p.AllowsList(tc.prefix); got != tc.want {
			t.Errorf("Parse(%q).AllowsList(%q) = %v, want %v", tc.pattern, tc.prefix, got, tc.want)
		}
	}
}

func TestEscapeLiteral(t *testing.T) {
	tests := []struct{ in, want string }{
		{"plain/key.png", "plain/key.png"},
		{"a*b", `a\*b`},
		{`a\b`, `a\\b`},
		{`*\*`, `\*\\\*`},
		{"{x}", "{x}"},
		{"", ""},
	}
	for _, tc := range tests {
		got := EscapeLiteral(tc.in)
		if got != tc.want {
			t.Errorf("EscapeLiteral(%q) = %q, want %q", tc.in, got, tc.want)
		}
		// An escaped value is a pattern matching exactly that value.
		if tc.in == "" {
			continue
		}
		p, err := Parse(got)
		if err != nil || p.HasWildcard() || !p.Match(tc.in) {
			t.Errorf("Parse(EscapeLiteral(%q)) = %v, %v; want an exact pattern for it", tc.in, p, err)
		}
	}
}

func TestExpand(t *testing.T) {
	const k = "photos/2026/a.b.png"
	tests := []struct {
		tmpl, key string
		want      string
		ok        bool
	}{
		// §7.8 table and examples.
		{"{key}", k, k, true},
		{"{dir}", k, "photos/2026", true},
		{"{base}", k, "a.b.png", true},
		{"{name}", k, "a.b", true},
		{"{ext}", k, "png", true},
		{"{dir}/{name}.webp", k, "photos/2026/a.b.webp", true},
		{"thumbs/{key}", k, "thumbs/photos/2026/a.b.png", true},
		{"derived/{key}/*", k, "derived/photos/2026/a.b.png/*", true},
		{"quarantine/{key}", k, "quarantine/photos/2026/a.b.png", true},
		{"{dir}/{base}", k, k, true},
		{"{dir}/*", k, "photos/2026/*", true},
		{"{name}.{ext}", k, "a.b.png", true},
		{"{key}*", k, k + "*", true},

		// Nested directories.
		{"{dir}", "a/b/c/d.txt", "a/b/c", true},
		{"{dir}/{name}-small.{ext}", "a/b/c/d.txt", "a/b/c/d-small.txt", true},

		// Top-level keys: no directory, the '/' after {dir} goes.
		{"{dir}/{name}.webp", "a.png", "a.webp", true},
		{"{dir}/thumbs/{base}", "a.png", "thumbs/a.png", true},
		{"{dir}/*", "a.png", "", false}, // would be the whole bucket
		{"{dir}*", "a.png", "", false},
		{"{dir}", "a.png", "", false}, // empty
		{"{dir}{name}", "a.png", "a", true},
		{"{ext}*", "README", "", false},

		// An empty variable never leaves a wildcard grant wider than the key's own
		// directory or name: thumbs/* instead of thumbs/<dir>/*.
		{"thumbs/{dir}/*", "a.jpg", "", false},
		{"thumbs/{dir}/*", "x/a.jpg", "thumbs/x/*", true},
		{"derived/{base}*", "dir/", "", false},
		{"derived/{base}*", "dir/a.jpg", "derived/a.jpg*", true},
		{"out/{ext}*", "README", "", false},
		{"out/{name}.{ext}*", "README", "", false},
		{"out/{name}.{ext}", "README", "out/README.", true}, // an exact pattern stays exact

		// A leading '/' is a directory (the empty one).
		{"{dir}/{name}.webp", "/a.png", "/a.webp", true},
		{"{dir}/*", "/a.png", "", false}, // an empty variable before a '*' is dropped, however it came about

		// Folder markers, dotfiles, odd dots.
		{"{dir}", "photos/", "photos", true},
		{"{base}", "photos/", "", false},
		{"{name}|{ext}", "cfg/.bashrc", ".bashrc|", true},
		{"{name}|{ext}", "cfg/.config.json", ".config|json", true},
		{"{name}|{ext}", "cfg/..x", "..x|", true},
		{"{name}|{ext}", "archive.tar.gz", "archive.tar|gz", true},
		{"{name}|{ext}", "trailing.", "trailing|", true},
		{"{name}|{ext}", "noext", "noext|", true},

		// Values are escaped: a key can never widen a grant.
		{"{key}", "a*b.png", `a\*b.png`, true},
		{"{key}", "*", `\*`, true},
		{"derived/{key}/*", "x/*", `derived/x/\*/*`, true},
		{"{dir}/*", "*/a.png", `\*/*`, true},
		{"{key}", `a\b`, `a\\b`, true},
		{"{key}", `a\`, `a\\`, true},
		{"{key}", "{x}.png", "{x}.png", true},
		{"{name}", "{dir}.png", "{dir}", true}, // no re-expansion
		{"{key}", "a}b{c", "a}b{c", true},
		{"{dir}/{name}.webp", "фото/2026/кот.jpg", "фото/2026/кот.webp", true},

		// Template escapes pass through; static templates expand to themselves.
		{`\{key\}/{key}`, "a.png", "{key}/a.png", true},
		{`a\*{key}`, "x", `a\*x`, true},
		{`a\\{key}`, "x", `a\\x`, true},
		{"*", k, "*", true}, // a deliberate whole-bucket grant
		{"config/rules.json", k, "config/rules.json", true},

		// Invalid templates expand to nothing.
		{"{nope}", k, "", false},
		{"*{key}", k, "", false},
		{"", k, "", false},
	}
	for _, tc := range tests {
		got, ok := Expand(tc.tmpl, tc.key)
		if got != tc.want || ok != tc.ok {
			t.Errorf("Expand(%q, %q) = %q, %v; want %q, %v", tc.tmpl, tc.key, got, ok, tc.want, tc.ok)
			continue
		}
		if !ok {
			continue
		}
		if _, err := Parse(got); err != nil {
			t.Errorf("Expand(%q, %q) = %q, which does not parse: %v", tc.tmpl, tc.key, got, err)
		}
	}
}

// TestExpandNeverWidens checks that, whatever the key, {key} matches exactly
// that key and derived/{key}/* only keys under it.
func TestExpandNeverWidens(t *testing.T) {
	keys := []string{"a", "*", "a*", `a\`, `\*`, "x/*/y", "{key}", `\{`, "日本*/写真"}
	for _, key := range keys {
		pat, ok := Expand("{key}", key)
		p, err := Parse(pat)
		if !ok || err != nil || p.HasWildcard() || !p.Match(key) || p.Match(key+"x") {
			t.Errorf("{key} for %q -> %q (ok=%v, err=%v) is not exactly the key", key, pat, ok, err)
		}
		pat, ok = Expand("derived/{key}/*", key)
		p, err = Parse(pat)
		if !ok || err != nil || p.Prefix() != "derived/"+key+"/" || !p.HasWildcard() {
			t.Errorf("derived/{key}/* for %q -> %q (ok=%v, err=%v)", key, pat, ok, err)
		}
	}
}

func TestValidateTemplate(t *testing.T) {
	valid := []string{
		"{key}", "derived/{key}/*", "{dir}/{name}.webp", "thumbs/{key}", "{dir}/*",
		"quarantine/{key}", "{name}.{ext}", "{base}", "*", "config/rules.json",
		`\{literal\}/{key}`, `a\\{key}`, `a\*{key}`, "{key}*",
	}
	for _, tmpl := range valid {
		if err := ValidateTemplate(tmpl); err != nil {
			t.Errorf("ValidateTemplate(%q) = %v", tmpl, err)
		}
	}
	invalid := []struct{ tmpl, reason string }{
		{"", "empty"},
		{"{nope}", "unknown variable {nope}"},
		{"{KEY}", "unknown variable {KEY}"},
		{"{}", "unknown variable {}"},
		{"{ key }", "unknown variable"},
		{"{ke{y}", "unknown variable"},
		{"{key", "'{' without '}'"},
		{"a{", "'{' without '}'"},
		{"key}", "'}' without '{'"},
		{`\{key}`, "'}' without '{'"},
		{"a*{key}", "only at the end"},
		{"{key}*x", "only at the end"},
		{"**", "only at the end"},
		{`a\`, "lone"},
		{`a\x{key}`, `invalid escape \x`},
	}
	for _, tc := range invalid {
		err := ValidateTemplate(tc.tmpl)
		if err == nil {
			t.Errorf("ValidateTemplate(%q) = nil", tc.tmpl)
			continue
		}
		if !strings.Contains(err.Error(), tc.reason) {
			t.Errorf("ValidateTemplate(%q) = %q, want it to mention %q", tc.tmpl, err, tc.reason)
		}
	}
}

func mustParseAll(t *testing.T, ss ...string) []Pattern {
	t.Helper()
	ps := make([]Pattern, len(ss))
	for i, s := range ss {
		p, err := Parse(s)
		if err != nil {
			t.Fatalf("Parse(%q): %v", s, err)
		}
		ps[i] = p
	}
	return ps
}
