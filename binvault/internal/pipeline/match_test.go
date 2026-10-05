package pipeline

import (
	"encoding/json"
	"testing"
)

func compile(t *testing.T, doc string) *Matcher {
	t.Helper()
	var m Match
	if err := json.Unmarshal([]byte(doc), &m); err != nil {
		t.Fatal(err)
	}
	return m.Compile()
}

func TestMatcher(t *testing.T) {
	big := int64(5000)
	tests := []struct {
		name  string
		match string
		f     Facts
		want  bool
	}{
		{"empty matches everything", `{}`, Facts{Key: "any/thing", Operation: "put"}, true},
		{"keys any element", `{"keys":["uploads/**","logs/*.txt"]}`, Facts{Key: "logs/a.txt"}, true},
		{"keys single star stops at slash", `{"keys":["logs/*.txt"]}`, Facts{Key: "logs/2026/a.txt"}, false},
		{"keys double star crosses slashes", `{"keys":["logs/**/*.txt"]}`, Facts{Key: "logs/2026/a.txt"}, true},
		{"keys alternatives and case", `{"keys":["**/*.{jpg,png}"]}`, Facts{Key: "a/b/C.JPG"}, false},
		{"keys alternatives", `{"keys":["**/*.{jpg,png}"]}`, Facts{Key: "a/b/c.png"}, true},
		{"exclude wins", `{"keys":["uploads/**"],"exclude_keys":["uploads/raw/**"]}`, Facts{Key: "uploads/raw/x"}, false},
		{"exclude only", `{"exclude_keys":["derived/**"]}`, Facts{Key: "uploads/x"}, true},
		{"exclude only hit", `{"exclude_keys":["derived/**"]}`, Facts{Key: "derived/x"}, false},
		{"declared type", `{"content_type":["image/*"]}`, Facts{DeclaredType: "image/png; charset=binary"}, true},
		{"declared type miss", `{"content_type":["image/*"]}`, Facts{DeclaredType: "text/plain"}, false},
		{"declared ignores the sniffed type", `{"content_type":["image/*"]}`, Facts{DeclaredType: "image/png", SniffedType: "text/plain"}, true},
		{"sniffed type", `{"content_type":["image/png"],"content_type_source":"sniffed"}`, Facts{DeclaredType: "text/plain", SniffedType: "image/png"}, true},
		{"sniffed ignores the claim", `{"content_type":["image/png"],"content_type_source":"sniffed"}`, Facts{DeclaredType: "image/png", SniffedType: "text/plain"}, false},
		{"sniffed falls back to the stored type", `{"content_type":["image/png"],"content_type_source":"sniffed"}`, Facts{DeclaredType: "image/png"}, true},
		{"content type case", `{"content_type":["IMAGE/PNG"]}`, Facts{DeclaredType: "image/png"}, true},
		{"min size inclusive", `{"min_size":5000}`, Facts{Size: big}, true},
		{"min size miss", `{"min_size":5001}`, Facts{Size: big}, false},
		{"max size inclusive", `{"max_size":5000}`, Facts{Size: big}, true},
		{"max size miss", `{"max_size":4999}`, Facts{Size: big}, false},
		{"zero min", `{"min_size":0}`, Facts{Size: 0}, true},
		{"operations", `{"operations":["put","post"]}`, Facts{Operation: "post"}, true},
		{"operations miss", `{"operations":["put","post"]}`, Facts{Operation: "copy"}, false},
		{"everything at once", `{"keys":["a/**"],"content_type":["text/*"],"min_size":1,"max_size":9,"operations":["put"]}`,
			Facts{Key: "a/b", DeclaredType: "text/plain", Size: 5, Operation: "put"}, true},
		{"one condition failing fails all", `{"keys":["a/**"],"content_type":["text/*"],"min_size":1,"max_size":9,"operations":["put"]}`,
			Facts{Key: "a/b", DeclaredType: "text/plain", Size: 50, Operation: "put"}, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := compile(t, tc.match).Matches(tc.f); got != tc.want {
				t.Fatalf("Matches(%+v) with %s = %v, want %v", tc.f, tc.match, got, tc.want)
			}
		})
	}
}

func TestMatchBothIsAnd(t *testing.T) {
	p := compile(t, `{"keys":["uploads/**"]}`)
	a := compile(t, `{"keys":["uploads/img/**"]}`)
	if !matchBoth(p, a, Facts{Key: "uploads/img/1"}) {
		t.Error("both match")
	}
	if matchBoth(p, a, Facts{Key: "uploads/doc/1"}) {
		t.Error("an attachment filter can only narrow")
	}
	if matchBoth(p, a, Facts{Key: "other/img/1"}) {
		t.Error("the pipeline's own filter still applies")
	}
	if !matchBoth(p, nil, Facts{Key: "uploads/x"}) {
		t.Error("a nil filter matches everything")
	}
}

func TestNeedsSniff(t *testing.T) {
	if !compile(t, `{"content_type":["image/*"],"content_type_source":"sniffed"}`).NeedsSniff() {
		t.Error("sniffed types need the bytes")
	}
	if compile(t, `{"content_type":["image/*"]}`).NeedsSniff() || compile(t, `{"content_type_source":"sniffed"}`).NeedsSniff() {
		t.Error("declared types, or no type, need nothing")
	}
}

func TestCompileJSON(t *testing.T) {
	m, raw := compileJSON(`{"keys":["a/**"],"operations":["put"]}`)
	if !m.Matches(Facts{Key: "a/x", Operation: "put"}) || m.Matches(Facts{Key: "a/x", Operation: "copy"}) || len(raw.Keys) != 1 {
		t.Fatal("compileJSON")
	}
	m, _ = compileJSON("")
	if !m.Matches(Facts{Key: "x"}) {
		t.Fatal("an empty stored filter matches everything")
	}
	m, _ = compileJSON("{not json")
	if !m.Matches(Facts{Key: "x"}) {
		t.Fatal("a corrupt stored filter must not hide objects")
	}
}
