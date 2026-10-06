package session

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kalevski/toolcase/webmail/internal/store"
)

var testKey = bytes.Repeat([]byte{7}, 32)

type clock struct{ t time.Time }

func (c *clock) now() time.Time { return c.t }

func newMgr(t *testing.T) (*Manager, *clock) {
	t.Helper()
	ck := &clock{t: time.Unix(1_700_000_000, 0)}
	st, err := store.Open(context.Background(), t.TempDir(), store.Options{Now: ck.now})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	return &Manager{Store: st, Key: testKey, PublicURL: "https://mail.example.test", Now: ck.now,
		Settings: Settings{Idle: 12 * time.Hour, RememberIdle: 30 * 24 * time.Hour, Max: 30 * 24 * time.Hour}}, ck
}

func TestSealRoundTripAndBinding(t *testing.T) {
	blob, err := Seal(testKey, []byte("s3cret-credential"), []byte("row-1"))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(blob, []byte("s3cret")) {
		t.Fatal("plaintext visible in sealed blob")
	}
	got, err := Open(testKey, blob, []byte("row-1"))
	if err != nil || string(got) != "s3cret-credential" {
		t.Fatalf("open: %q %v", got, err)
	}
	if _, err := Open(testKey, blob, []byte("row-2")); err == nil {
		t.Fatal("blob opened under a different row id")
	}
	other := bytes.Repeat([]byte{9}, 32)
	if _, err := Open(other, blob, []byte("row-1")); err == nil {
		t.Fatal("blob opened under a different key")
	}
	blob[len(blob)-1] ^= 1
	if _, err := Open(testKey, blob, []byte("row-1")); err == nil {
		t.Fatal("tampered blob opened")
	}
	if _, err := Open(testKey, []byte{1, 2}, nil); err == nil {
		t.Fatal("short blob opened")
	}
	b1, _ := Seal(testKey, []byte("x"), nil)
	b2, _ := Seal(testKey, []byte("x"), nil)
	if bytes.Equal(b1, b2) {
		t.Fatal("nonce reused")
	}
	if _, err := Seal([]byte("short"), []byte("x"), nil); err == nil {
		t.Fatal("short key accepted")
	}
}

func TestCreateLookupStoresOnlySealedCredential(t *testing.T) {
	m, _ := newMgr(t)
	ctx := context.Background()
	cookie, s, err := m.Create(ctx, CreateParams{Address: "Ann@Example.Test", Domain: "example.test", IP: "1.2.3.4", UserAgent: "UA", PlatformID: "p1", Credential: "cred-xyz"})
	if err != nil {
		t.Fatal(err)
	}
	if s.ID == cookie || s.ID != HashID(cookie) {
		t.Fatal("database id must be the hash of the cookie value")
	}
	row, _ := m.Store.GetSession(ctx, s.ID)
	if bytes.Contains(row.CredSealed, []byte("cred-xyz")) {
		t.Fatal("credential stored in the clear")
	}
	a, err := m.Lookup(ctx, cookie)
	if err != nil {
		t.Fatal(err)
	}
	if a.Credential != "cred-xyz" || a.Address != "ann@example.test" {
		t.Fatalf("got %q %q", a.Credential, a.Address)
	}
	if _, err := m.Lookup(ctx, "nope"); err != ErrNoSession {
		t.Fatalf("unknown cookie: %v", err)
	}
	if _, err := m.Lookup(ctx, ""); err != ErrNoSession {
		t.Fatalf("empty cookie: %v", err)
	}
}

func TestExpiry(t *testing.T) {
	m, ck := newMgr(t)
	ctx := context.Background()
	cookie, _, _ := m.Create(ctx, CreateParams{Address: "a@x.test", Credential: "c"})
	// activity keeps the session alive past the first idle window
	for i := 0; i < 3; i++ {
		ck.t = ck.t.Add(8 * time.Hour)
		if _, err := m.Lookup(ctx, cookie); err != nil {
			t.Fatalf("step %d: %v", i, err)
		}
	}
	// idle expiry
	ck.t = ck.t.Add(13 * time.Hour)
	if _, err := m.Lookup(ctx, cookie); err != ErrNoSession {
		t.Fatalf("idle expiry: %v", err)
	}
	// remember me lives longer idle, but never past the absolute limit
	ck.t = time.Unix(1_700_000_000, 0)
	cookie2, s2, _ := m.Create(ctx, CreateParams{Address: "a@x.test", Credential: "c", Remember: true})
	if !s2.IdleExpiresAt.Equal(s2.ExpiresAt) {
		t.Fatalf("remember idle %v should be capped at absolute %v", s2.IdleExpiresAt, s2.ExpiresAt)
	}
	ck.t = ck.t.Add(29 * 24 * time.Hour)
	if _, err := m.Lookup(ctx, cookie2); err != nil {
		t.Fatalf("remembered session should live: %v", err)
	}
	ck.t = ck.t.Add(2 * 24 * time.Hour)
	if _, err := m.Lookup(ctx, cookie2); err != ErrNoSession {
		t.Fatalf("absolute expiry: %v", err)
	}
	reaped, err := m.Reap(ctx)
	if err != nil || len(reaped) != 2 {
		t.Fatalf("reap: %d %v", len(reaped), err)
	}
}

func TestCredentialExpiryCapsSession(t *testing.T) {
	m, ck := newMgr(t)
	_, s, _ := m.Create(context.Background(), CreateParams{Address: "a@x.test", Credential: "c", CredentialExpires: ck.t.Add(time.Hour)})
	if !s.ExpiresAt.Equal(ck.t.Add(time.Hour)) {
		t.Fatalf("expiry %v", s.ExpiresAt)
	}
}

func TestWrongKeyIsNoSession(t *testing.T) {
	m, _ := newMgr(t)
	ctx := context.Background()
	cookie, _, _ := m.Create(ctx, CreateParams{Address: "a@x.test", Credential: "c"})
	m.Key = bytes.Repeat([]byte{1}, 32)
	if _, err := m.Lookup(ctx, cookie); err != ErrNoSession {
		t.Fatalf("restored with a different key must require sign-in: %v", err)
	}
}

func TestCSRF(t *testing.T) {
	m, _ := newMgr(t)
	_, s, _ := m.Create(context.Background(), CreateParams{Address: "a@x.test", Credential: "c"})
	mk := func(origin, token string) *http.Request {
		r := httptest.NewRequest("POST", "/api/jmap", nil)
		if origin != "" {
			r.Header.Set("Origin", origin)
		}
		if token != "" {
			r.Header.Set(CSRFHeader, token)
		}
		return r
	}
	good := "https://mail.example.test"
	if err := m.CheckCSRF(mk(good, s.CSRF), s); err != nil {
		t.Fatalf("valid request rejected: %v", err)
	}
	for name, r := range map[string]*http.Request{
		"no token":     mk(good, ""),
		"wrong token":  mk(good, "abc"),
		"no origin":    mk("", s.CSRF),
		"other origin": mk("https://evil.test", s.CSRF),
		"scheme":       mk("http://mail.example.test", s.CSRF),
	} {
		if err := m.CheckCSRF(r, s); err != ErrCSRF {
			t.Errorf("%s: want ErrCSRF, got %v", name, err)
		}
	}
	if IsMutating("GET") || IsMutating("HEAD") || !IsMutating("POST") || !IsMutating("DELETE") || !IsMutating("PUT") {
		t.Fatal("IsMutating")
	}
}

func TestCookieAttributes(t *testing.T) {
	m, _ := newMgr(t)
	_, s, _ := m.Create(context.Background(), CreateParams{Address: "a@x.test", Credential: "c", Remember: true})
	c := m.Cookie("v", s)
	if c.Name != "__Host-webmail_session" || !c.Secure || !c.HttpOnly || c.SameSite != http.SameSiteLaxMode || c.Path != "/" || c.Domain != "" {
		t.Fatalf("bad cookie %+v", c)
	}
	if c.Expires.IsZero() {
		t.Fatal("remember-me cookie should persist")
	}
	if !m.Cookie("v", &store.Session{}).Expires.IsZero() {
		t.Fatal("normal cookie should be a browser-session cookie")
	}
}

// The session cache must not extend a session: expiry is judged against the
// manager's clock on every lookup, even while the row is served from memory.
func TestCachedSessionStillExpires(t *testing.T) {
	storeNow := time.Unix(1_700_000_000, 0) // frozen: the cache TTL never lapses
	st, err := store.Open(context.Background(), t.TempDir(), store.Options{Now: func() time.Time { return storeNow }, SessionCacheTTL: time.Hour})
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	ck := &clock{t: storeNow}
	m := &Manager{Store: st, Key: testKey, PublicURL: "https://mail.example.test", Now: ck.now,
		Settings: Settings{Idle: time.Hour, RememberIdle: 2 * time.Hour, Max: 3 * time.Hour}}
	ctx := context.Background()
	cookie, _, _ := m.Create(ctx, CreateParams{Address: "a@x.test", Credential: "c"})
	if _, err := m.Lookup(ctx, cookie); err != nil { // warm
		t.Fatal(err)
	}
	ck.t = ck.t.Add(30 * time.Second)
	if _, err := m.Lookup(ctx, cookie); err != nil {
		t.Fatal(err)
	}
	ck.t = ck.t.Add(61 * time.Minute) // past idle; cache entry is "fresh" by the store clock
	if _, err := m.Lookup(ctx, cookie); err != ErrNoSession {
		t.Fatalf("idle expiry not enforced on a cached session: %v", err)
	}
}

func TestLogoutThenReplayFailsAtOnce(t *testing.T) {
	m, _ := newMgr(t)
	ctx := context.Background()
	cookie, s, _ := m.Create(ctx, CreateParams{Address: "a@x.test", Credential: "c"})
	a, err := m.Lookup(ctx, cookie)
	if err != nil {
		t.Fatal(err)
	}
	a.Session.CSRF = "tampered" // callers get a copy
	if b, _ := m.Lookup(ctx, cookie); b.CSRF == "tampered" {
		t.Fatal("cache state mutated through a returned session")
	}
	m.Terminate(ctx, s)
	if _, err := m.Lookup(ctx, cookie); err != ErrNoSession {
		t.Fatalf("old cookie replayed after logout: %v", err)
	}
}

func TestTouchRefreshesCachedIdle(t *testing.T) {
	m, ck := newMgr(t)
	ctx := context.Background()
	cookie, _, _ := m.Create(ctx, CreateParams{Address: "a@x.test", Credential: "c"})
	m.Lookup(ctx, cookie)
	ck.t = ck.t.Add(2 * time.Minute)
	a, _ := m.Lookup(ctx, cookie) // touches
	ck.t = ck.t.Add(2 * time.Minute)
	b, _ := m.Lookup(ctx, cookie)
	if !b.IdleExpiresAt.After(a.IdleExpiresAt) {
		t.Fatalf("touch effect lost: %v then %v", a.IdleExpiresAt, b.IdleExpiresAt)
	}
}
