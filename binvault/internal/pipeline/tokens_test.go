package pipeline

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

type fakeClock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *fakeClock) now() time.Time { c.mu.Lock(); defer c.mu.Unlock(); return c.t }
func (c *fakeClock) add(d time.Duration) {
	c.mu.Lock()
	c.t = c.t.Add(d)
	c.mu.Unlock()
}

func TestTokenMintLookupRevoke(t *testing.T) {
	clk := &fakeClock{t: time.Now()}
	reg := newTokenRegistry(clk.now)
	var revoked []string
	reg.onRevoke = func(id string) { revoked = append(revoked, id) }
	g := &engine.Guard{Key: "k", Version: "v"}
	tok, err := reg.mint(mintSpec{
		Pipeline: "thumbs", Run: "run_1", Bucket: "photos", Deadline: clk.now().Add(20 * time.Second),
		Grants: []meta.Grant{{Actions: []string{"read"}, Keys: []string{"k"}}}, Depth: 2, Chain: []string{"a", "b"}, Guard: g,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(tok.id) != 20 || tok.id[:3] != "BVP" || len(tok.secret) != 40 || !auth.ValidAccessKeyID(tok.id) {
		t.Fatalf("token shape: %s %s", tok.id, tok.secret)
	}
	p := tok.principal
	if p.Kind != auth.KindPipeline || p.Name != "thumbs" || p.Run != "run_1" || p.Bucket != "photos" || p.AccessKey != tok.id || p.Label() != "pipeline:thumbs/run_1" {
		t.Fatalf("principal: %+v", p)
	}
	if !p.Grants.Can("read", "k") || p.Grants.Can("read", "other") || p.Grants.Can("write", "k") {
		t.Fatal("grants")
	}
	d, chain := tok.Lineage()
	if d != 2 || len(chain) != 2 || tok.Guard() != g || tok.StagedKey() != "" {
		t.Fatal("lineage/guard/staged key")
	}
	if !tok.expires.Equal(clk.now().Add(20*time.Second + TokenGrace)) {
		t.Fatalf("expiry = %v", tok.expires)
	}
	pr, secret, ok := (&Manager{toks: reg}).Lookup(tok.id)
	if !ok || pr != p || secret != tok.secret {
		t.Fatal("lookup")
	}
	if tok.Context().Err() != nil || reg.count() != 1 {
		t.Fatal("live")
	}

	tok.revoke()
	tok.revoke() // idempotent
	if tok.Context().Err() == nil {
		t.Fatal("revoking cancels the token's context, aborting its requests")
	}
	if _, _, ok := (&Manager{toks: reg}).Lookup(tok.id); ok {
		t.Fatal("a revoked token authenticates no more")
	}
	if reg.count() != 0 || len(revoked) != 1 || revoked[0] != tok.id {
		t.Fatalf("registry: %d, revoked %v", reg.count(), revoked)
	}
	if _, _, ok := (&Manager{toks: reg}).Lookup("BVPNOSUCHTOKENXXXXXX"); ok {
		t.Fatal("unknown")
	}
}

func TestTokenExpiryAndSweep(t *testing.T) {
	clk := &fakeClock{t: time.Now()}
	reg := newTokenRegistry(clk.now)
	m := &Manager{toks: reg}
	mk := func(deadline time.Duration) *token {
		tok, err := reg.mint(mintSpec{Pipeline: "p", Run: "r", Bucket: "b", Deadline: clk.now().Add(deadline),
			Grants: []meta.Grant{{Actions: []string{"read"}}}})
		if err != nil {
			t.Fatal(err)
		}
		return tok
	}
	a, b := mk(10*time.Second), mk(10*time.Minute)
	clk.add(10*time.Second + TokenGrace - time.Millisecond)
	if _, _, ok := m.Lookup(a.id); !ok {
		t.Fatal("a token lives until its deadline plus the grace")
	}
	clk.add(time.Millisecond)
	if _, _, ok := m.Lookup(a.id); ok {
		t.Fatal("a token expires 30 s after its attempt's deadline")
	}
	if _, _, ok := m.Lookup(b.id); !ok {
		t.Fatal("the other token is still valid")
	}
	if n := reg.sweep(); n != 1 || reg.count() != 1 {
		t.Fatalf("sweep: %d, left %d", n, reg.count())
	}
	if a.ctx.Err() == nil {
		t.Fatal("a swept token's context ends")
	}
}

func TestTokenContextEndsAtExpiry(t *testing.T) {
	reg := newTokenRegistry(time.Now)
	tok, _ := reg.mint(mintSpec{Pipeline: "p", Run: "r", Bucket: "b", Deadline: time.Now().Add(-TokenGrace + 50*time.Millisecond),
		Grants: []meta.Grant{{Actions: []string{"read"}}}})
	select {
	case <-tok.Context().Done():
	case <-time.After(2 * time.Second):
		t.Fatal("the context must end by itself at the token's expiry")
	}
}

func TestTokenEmptyGrantsAreNotAnError(t *testing.T) {
	reg := newTokenRegistry(time.Now)
	tok, err := reg.mint(mintSpec{Pipeline: "p", Run: "r", Bucket: "b", Deadline: time.Now().Add(time.Second)})
	if err != nil || tok.principal.Grants.Can("read", "x") {
		t.Fatalf("%v", err)
	}
}

func TestStagedMethodsWithoutAView(t *testing.T) {
	reg := newTokenRegistry(time.Now)
	tok, _ := reg.mint(mintSpec{Pipeline: "p", Run: "r", Bucket: "b", Deadline: time.Now().Add(time.Second), Grants: []meta.Grant{{Actions: []string{"read"}}}})
	if _, err := tok.StagedOpen(context.Background()); err == nil {
		t.Fatal("StagedOpen")
	}
	if _, err := tok.StagedPut(context.Background(), &engine.StagedPut{}); err == nil {
		t.Fatal("StagedPut")
	}
	if tok.StagedDelete() == nil || tok.StagedSetTags(nil) == nil {
		t.Fatal("staged changes without a staged object")
	}
	if _, deleted := tok.StagedObject(); !deleted {
		t.Fatal("no staged object reads as deleted")
	}
}
