package admin

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAuthFailuresAreRateLimited(t *testing.T) {
	env := newSitesEnv(t, "0123456789abcdef0123456789abcdef")
	do := func(token, addr string) int {
		req := httptest.NewRequest(http.MethodGet, "/status", nil)
		req.RemoteAddr = addr
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		rec := httptest.NewRecorder()
		env.h.ServeHTTP(rec, req)
		return rec.Code
	}
	for i := 0; i < authFailLimit; i++ {
		if code := do("wrong", "203.0.113.9:4000"); code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: want 401, got %d", i, code)
		}
	}
	if code := do("wrong", "203.0.113.9:4001"); code != http.StatusTooManyRequests {
		t.Fatalf("want 429 after %d failures, got %d", authFailLimit, code)
	}
	if code := do("0123456789abcdef0123456789abcdef", "203.0.113.9:4002"); code != http.StatusTooManyRequests {
		t.Fatalf("a blocked client stays blocked even with the right token, got %d", code)
	}
	if code := do("0123456789abcdef0123456789abcdef", "198.51.100.1:4000"); code != http.StatusOK {
		t.Fatalf("another client is unaffected, got %d", code)
	}
}

func TestAuthLimiterWindowAndExpiry(t *testing.T) {
	l := newAuthLimiter()
	now := time.Now()
	l.now = func() time.Time { return now }
	for i := 0; i < authFailLimit-1; i++ {
		l.fail("a")
	}
	now = now.Add(2 * authFailWindow)
	l.fail("a")
	if b, _ := l.blocked("a"); b {
		t.Fatal("failures outside the window must not accumulate")
	}
	for i := 0; i < authFailLimit; i++ {
		l.fail("b")
	}
	if b, _ := l.blocked("b"); !b {
		t.Fatal("client b should be blocked")
	}
	now = now.Add(authBlockFor + time.Second)
	if b, _ := l.blocked("b"); b {
		t.Fatal("the block must expire")
	}
}

func TestSchemaRequiresTokenWhenConfigured(t *testing.T) {
	env := newSitesEnv(t, "0123456789abcdef0123456789abcdef")
	req := httptest.NewRequest(http.MethodGet, "/schema", nil)
	rec := httptest.NewRecorder()
	env.h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("/schema without a token: want 401, got %d", rec.Code)
	}
}
