package platform

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func fakePlatform(t *testing.T) (*Client, *httptest.Server) {
	t.Helper()
	mux := http.NewServeMux()
	auth := func(h http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Authorization") != "Bearer svc-key" {
				w.WriteHeader(401)
				return
			}
			h(w, r)
		}
	}
	mux.HandleFunc("GET /v1/webmail/domains/{d}", auth(func(w http.ResponseWriter, r *http.Request) {
		if r.PathValue("d") != "example.test" {
			http.NotFound(w, r)
			return
		}
		json.NewEncoder(w).Encode(Branding{Name: "Example", Theme: "default", Accent: "#336699"})
	}))
	mux.HandleFunc("POST /v1/webmail/sessions", auth(func(w http.ResponseWriter, r *http.Request) {
		var in map[string]string
		json.NewDecoder(r.Body).Decode(&in)
		switch in["password"] {
		case "good":
			json.NewEncoder(w).Encode(SessionCredential{ID: "s1", Credential: "tmp-cred", ExpiresAt: time.Now().Add(time.Hour)})
		case "slow":
			w.Header().Set("Retry-After", "7")
			w.WriteHeader(429)
		case "boom":
			w.WriteHeader(500)
		default:
			w.WriteHeader(401)
		}
	}))
	mux.HandleFunc("POST /v1/webmail/password", auth(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(422)
		w.Write([]byte(`{"message":"Password is too short."}`))
	}))
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return New(srv.URL, "svc-key", 2*time.Second), srv
}

func TestClient(t *testing.T) {
	c, _ := fakePlatform(t)
	ctx := context.Background()
	b, err := c.Branding(ctx, "example.test")
	if err != nil || b.Name != "Example" {
		t.Fatalf("branding: %+v %v", b, err)
	}
	if _, err := c.Branding(ctx, "nope.test"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unknown domain: %v", err)
	}
	if _, err := c.Branding(ctx, "../etc/passwd"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("path injection: %v", err)
	}
	sc, err := c.CreateSession(ctx, "a@example.test", "good", "1.1.1.1", "ua")
	if err != nil || sc.Credential != "tmp-cred" {
		t.Fatalf("session: %+v %v", sc, err)
	}
	if _, err := c.CreateSession(ctx, "a@example.test", "bad", "", ""); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("bad password: %v", err)
	}
	var rl *RateLimitedError
	if _, err := c.CreateSession(ctx, "a@example.test", "slow", "", ""); !errors.As(err, &rl) || rl.RetryAfter != 7*time.Second {
		t.Fatalf("rate limit: %v", err)
	}
	if _, err := c.CreateSession(ctx, "a@example.test", "boom", "", ""); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("5xx: %v", err)
	}
	var pe *PolicyError
	if err := c.ChangePassword(ctx, "a@example.test", "x", "y"); !errors.As(err, &pe) || pe.Message != "Password is too short." {
		t.Fatalf("policy: %v", err)
	}
	bad := New(c.BaseURL, "wrong-key", time.Second)
	if _, err := bad.Branding(ctx, "example.test"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("service key rejected: %v", err)
	}
}

type countSrc struct {
	n   atomic.Int32
	err error
}

func (s *countSrc) Branding(_ context.Context, d string) (*Branding, error) {
	s.n.Add(1)
	if s.err != nil {
		return nil, s.err
	}
	if d == "unknown.test" {
		return nil, ErrNotFound
	}
	return &Branding{Name: d}, nil
}

func TestBrandingCache(t *testing.T) {
	now := time.Unix(1000, 0)
	src := &countSrc{}
	c := &BrandingCache{Source: src, TTL: 60 * time.Second, Now: func() time.Time { return now }}
	ctx := context.Background()
	for i := 0; i < 3; i++ {
		if b, err := c.Get(ctx, "Example.test."); err != nil || b.Name != "example.test" {
			t.Fatalf("get: %+v %v", b, err)
		}
	}
	if src.n.Load() != 1 {
		t.Fatalf("expected 1 upstream call, got %d", src.n.Load())
	}
	// unknown domains are cached too, as nil without error
	for i := 0; i < 2; i++ {
		if b, err := c.Get(ctx, "unknown.test"); b != nil || err != nil {
			t.Fatalf("unknown: %+v %v", b, err)
		}
	}
	if src.n.Load() != 2 {
		t.Fatalf("negative cache: %d calls", src.n.Load())
	}
	// invalid names never reach the source
	if b, err := c.Get(ctx, "bad name/../x"); b != nil || err != nil || src.n.Load() != 2 {
		t.Fatal("invalid domain reached the platform")
	}
	// expiry refetches; a failing platform serves the stale entry
	now = now.Add(61 * time.Second)
	src.err = ErrUnavailable
	if b, err := c.Get(ctx, "example.test"); err != nil || b == nil {
		t.Fatalf("stale: %+v %v", b, err)
	}
	if _, err := c.Get(ctx, "never-seen.test"); err == nil {
		t.Fatal("expected error with nothing cached")
	}
	src.err = nil
	n := src.n.Load()
	c.Get(ctx, "example.test")
	if src.n.Load() != n+1 {
		t.Fatal("expired entry not refetched")
	}
}

func TestPublicBrandingValidation(t *testing.T) {
	p := Public("example.test", &Branding{
		Name: "  Ex\x00ample  ", LogoURL: "javascript:alert(1)", Theme: "dungeon", Accent: "#ABCDEF",
		LoginMessage: strings.Repeat("x", 500), SupportEmail: "help@example.test", SupportURL: "https://example.test/help",
		FooterLinks:     []FooterLink{{"Privacy", "https://example.test/p"}, {"Evil", "javascript:alert(1)"}, {"", "https://x.test"}},
		DefaultLanguage: "en", AllowUserAccent: true,
	})
	if !p.Known || p.Name != "Example" || p.LogoURL != "" || p.Theme != "dungeon" || p.Accent != "#abcdef" {
		t.Fatalf("%+v", p)
	}
	if len([]rune(p.LoginMessage)) != 280 || len(p.FooterLinks) != 1 || p.SupportURL == "" || p.SupportEmail == "" {
		t.Fatalf("%+v", p)
	}
	bad := Public("example.test", &Branding{Name: "n", Theme: "x;}</style><script>", Accent: "red;background:url(x)", DefaultLanguage: "en\"><"})
	if bad.Theme != "" || bad.Accent != "" || bad.DefaultLanguage != "" {
		t.Fatalf("injection survived: %+v", bad)
	}
	n := Public("unknown.test", nil)
	if n.Known || n.Name != "Webmail" || n.FooterLinks == nil {
		t.Fatalf("%+v", n)
	}
}

func TestBrandingAcceptsPlatformFieldNames(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"domain":"acme.com","displayName":"Acme Mail","defaultLocale":"de","logoUrl":"/v1/webmail/domains/acme.com/logo","theme":"ocean","accent":"#123456"}`))
	}))
	defer srv.Close()
	c := New(srv.URL, "tok", time.Second)
	b, err := c.Branding(context.Background(), "acme.com")
	if err != nil {
		t.Fatal(err)
	}
	p := Public("acme.com", b)
	if p.Name != "Acme Mail" || p.DefaultLanguage != "de" {
		t.Fatalf("names not mapped: %+v", p)
	}
	if p.LogoURL != "/api/logo?domain=acme.com" {
		t.Fatalf("logo not proxied: %q", p.LogoURL)
	}
}
