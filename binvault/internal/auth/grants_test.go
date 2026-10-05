package auth

import (
	"strings"
	"testing"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

func g(actions []string, keys ...string) meta.Grant {
	gr := meta.Grant{Actions: actions}
	if keys != nil {
		gr.Keys = keys
	}
	return gr
}

func TestCompileGrantsValidation(t *testing.T) {
	bad := [][]meta.Grant{
		nil,
		{{Actions: nil}},
		{{Actions: []string{"read"}, Keys: []string{}}},
		{{Actions: []string{"fly"}}},
		{{Actions: []string{"read"}, Keys: []string{"a*b"}}}, // '*' only at the end
	}
	for i, in := range bad {
		if _, err := CompileGrants(in); err == nil {
			t.Errorf("case %d must be refused", i)
		}
	}
	if _, err := CompileGrants([]meta.Grant{g([]string{"read", "list"})}); err != nil {
		t.Fatal(err)
	}
}

func TestCan(t *testing.T) {
	gs, err := CompileGrants([]meta.Grant{
		g([]string{Read}, "photos/*"),
		g([]string{Write}, "uploads/*", "exact.txt"),
		g([]string{Delete}, "trash/old"),
		g([]string{List}),
	})
	if err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		action, key string
		want        bool
	}{
		{Read, "photos/a.png", true},
		{Read, "photos", false},
		{Read, "uploads/a", false},
		{Write, "uploads/x/y", true},
		{Create, "uploads/x", true}, // write implies create
		{Tag, "uploads/x", true},    // ... and tag
		{Create, "photos/a", false},
		{Write, "exact.txt", true},
		{Write, "exact.txt2", false},
		{Delete, "trash/old", true},
		{Delete, "trash/old2", false},
		{Purge, "trash/old", false},
		{List, "anything", true},
	}
	for _, c := range cases {
		if got := gs.Can(c.action, c.key); got != c.want {
			t.Errorf("%s %s = %v", c.action, c.key, got)
		}
	}
}

func TestCreateDoesNotImplyWrite(t *testing.T) {
	gs, _ := CompileGrants([]meta.Grant{g([]string{Create})})
	if !gs.Can(Create, "k") || gs.Can(Write, "k") || gs.Can(Tag, "k") {
		t.Fatal("create must not imply write or tag")
	}
}

func TestListRules(t *testing.T) {
	gs, _ := CompileGrants([]meta.Grant{g([]string{List}, "photos/*"), g([]string{List}, "docs/readme.md")})
	if !gs.CanList("photos/") || !gs.CanList("photos/2026/") {
		t.Fatal("prefix inside a granted wildcard must be listable")
	}
	if gs.CanList("") || gs.CanList("pho") || gs.CanList("other/") {
		t.Fatal("prefix outside the granted literal part must be refused")
	}
	if !gs.CanList("docs/readme.md") {
		t.Fatal("exact pattern prefix")
	}
	f := gs.ListFilter()
	if f == nil || !f("photos/a") || f("secret") || !f("docs/readme.md") || f("docs/other") {
		t.Fatal("list filter must restrict results to granted keys")
	}
	all, _ := CompileGrants([]meta.Grant{g([]string{List})})
	if all.ListFilter() != nil || !all.CanList("") {
		t.Fatal("a keyless list grant covers everything")
	}
}

func TestKeys(t *testing.T) {
	id := NewAccessKeyID(BucketKeyPrefix)
	if !ValidAccessKeyID(id) || !strings.HasPrefix(id, "BVK") || len(id) != 20 {
		t.Fatalf("bad id %q", id)
	}
	if !IsPipelineKey(NewAccessKeyID(PipelineKeyPrefix)) || IsPipelineKey(id) {
		t.Fatal("pipeline key detection")
	}
	s := NewSecret()
	if len(s) != 40 || s == NewSecret() {
		t.Fatalf("secret %q", s)
	}
	for _, bad := range []string{"", "BVK", "XXX" + strings.Repeat("A", 17), "BVK" + strings.Repeat("1", 17), "BVK" + strings.Repeat("a", 17)} {
		if ValidAccessKeyID(bad) {
			t.Errorf("%q accepted", bad)
		}
	}
}
