package mailhost

import (
	"context"
	"testing"
	"time"

	"github.com/kalevski/toolcase/webmail/internal/jmap"
	"github.com/kalevski/toolcase/webmail/internal/store"
)

func newRouter(t *testing.T) (*Router, *store.Store) {
	t.Helper()
	st, err := store.Open(context.Background(), t.TempDir(), store.Options{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return &Router{Default: jmap.New("http://default.test:8080", time.Second), Store: st, Timeout: time.Second}, st
}

func TestDomainUsesItsOwnServerAndFallsBackToTheDefault(t *testing.T) {
	r, st := newRouter(t)
	ctx := context.Background()
	if err := st.InsertBranding(ctx, &store.Branding{Domain: "a.test", JMAPURL: "http://one.test:8080"}); err != nil {
		t.Fatal(err)
	}
	if err := st.InsertBranding(ctx, &store.Branding{Domain: "b.test"}); err != nil {
		t.Fatal(err)
	}
	if got := r.For(ctx, "a.test").Base; got != "http://one.test:8080" {
		t.Fatalf("a.test: %q", got)
	}
	if got := r.For(ctx, "B.test").Base; got != "http://default.test:8080" {
		t.Fatalf("b.test without an address uses the default, got %q", got)
	}
	if got := r.For(ctx, "unknown.test").Base; got != "http://default.test:8080" {
		t.Fatalf("an unknown domain uses the default, got %q", got)
	}
	if r.For(ctx, "a.test") != r.ForBase("http://one.test:8080/") {
		t.Fatal("one client is shared per server")
	}
}

func TestAMovedDomainFollowsItsNewServerOnceForgotten(t *testing.T) {
	r, st := newRouter(t)
	ctx := context.Background()
	if err := st.InsertBranding(ctx, &store.Branding{Domain: "a.test", JMAPURL: "http://one.test:8080"}); err != nil {
		t.Fatal(err)
	}
	if r.For(ctx, "a.test").Base != "http://one.test:8080" {
		t.Fatal("first server")
	}
	if err := st.UpdateBranding(ctx, &store.Branding{Domain: "a.test", JMAPURL: "http://two.test:8080"}); err != nil {
		t.Fatal(err)
	}
	r.Forget("a.test")
	if got := r.For(ctx, "a.test").Base; got != "http://two.test:8080" {
		t.Fatalf("after the move: %q", got)
	}
}
