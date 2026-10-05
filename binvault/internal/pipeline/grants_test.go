package pipeline

import (
	"reflect"
	"testing"

	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

func g(actions []string, keys ...string) meta.Grant {
	if len(keys) == 0 {
		return meta.Grant{Actions: actions}
	}
	return meta.Grant{Actions: actions, Keys: keys}
}

func TestExpandGrants(t *testing.T) {
	tmpl := []meta.Grant{
		g([]string{"read"}, "{key}"),
		g([]string{"write", "list"}, "derived/{key}/*"),
		g([]string{"write"}, "{dir}/{name}.webp"),
		g([]string{"delete"}, "{dir}/*"),
		g([]string{"read"}), // every key
	}
	got := ExpandGrants(tmpl, "photos/2026/a.b.png", false)
	want := []meta.Grant{
		g([]string{"read"}, "photos/2026/a.b.png"),
		g([]string{"write", "list"}, "derived/photos/2026/a.b.png/*"),
		g([]string{"write"}, "photos/2026/a.b.webp"),
		g([]string{"delete"}, "photos/2026/*"),
		g([]string{"read"}),
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("expanded:\n got %v\nwant %v", got, want)
	}

	// a top-level key has no directory: {dir}/* would be the whole bucket, so the grant is dropped
	got = ExpandGrants(tmpl, "a.png", false)
	for _, gr := range got {
		for _, k := range gr.Keys {
			if k == "*" {
				t.Fatalf("a grant must never widen to the whole bucket: %v", got)
			}
		}
	}
	if len(got) != 4 || got[2].Keys[0] != "a.webp" {
		t.Fatalf("top-level key: %v", got)
	}
}

func TestExpandGrantsEscapesValues(t *testing.T) {
	got := ExpandGrants([]meta.Grant{g([]string{"read", "write"}, "{key}")}, `we*ird\key`, false)
	if got[0].Keys[0] != `we\*ird\\key` {
		t.Fatalf("substituted values are literal: %q", got[0].Keys[0])
	}
	// and the compiled grant matches only that exact key
	gr, err := auth.CompileGrants(got)
	if err != nil {
		t.Fatal(err)
	}
	if !gr.Can("read", `we*ird\key`) || gr.Can("read", "weXird\\key") || gr.Can("read", "we") {
		t.Fatal("a key containing * must not widen the grant")
	}
}

func TestExpandGrantsReadOnly(t *testing.T) {
	tmpl := []meta.Grant{
		g([]string{"read", "delete", "write"}, "{key}"),
		g([]string{"write", "tag"}, "{key}"),
		g([]string{"list"}, "rules/*"),
	}
	got := ExpandGrants(tmpl, "k", true)
	want := []meta.Grant{g([]string{"read"}, "k"), g([]string{"list"}, "rules/*")}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("a before delete chain gets a read-only token: %v", got)
	}
}

func TestExpandedGrantsCompile(t *testing.T) {
	got := ExpandGrants(DefaultGrants(), "x/y.txt", false)
	gr, err := auth.CompileGrants(got)
	if err != nil {
		t.Fatal(err)
	}
	if !gr.Can("read", "x/y.txt") || gr.Can("read", "x/z.txt") || gr.Can("write", "x/y.txt") {
		t.Fatal("the default grant is read on {key}")
	}
}
