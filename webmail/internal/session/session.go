// Package session manages server-side sessions (spec §3.3): an opaque random
// id in a __Host- cookie, a record in SQLite whose mailbox password is
// sealed under WEBMAIL_SESSION_KEY, idle and absolute expiry, remember-me,
// listing/ending sessions, and the CSRF + Origin check.
package session

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/kalevski/toolcase/webmail/internal/store"
)

const (
	// CookieName is the session cookie; the __Host- prefix forces Secure,
	// path=/ and no Domain attribute.
	CookieName = "__Host-webmail_session"
	// CSRFHeader carries the per-session CSRF token on mutating requests.
	CSRFHeader = "X-Webmail-CSRF"
	// touchEvery limits how often last_used / idle expiry are written.
	touchEvery = time.Minute
	// MaxUserAgent bounds the stored user agent.
	MaxUserAgent = 256
)

var (
	// ErrNoSession means there is no valid session for the request (absent,
	// unknown, expired or its credential cannot be opened).
	ErrNoSession = errors.New("session: no valid session")
	// ErrCSRF means the CSRF token or Origin check failed.
	ErrCSRF = errors.New("session: csrf check failed")
)

// Settings are the lifetimes.
type Settings struct {
	Idle         time.Duration // normal idle expiry
	RememberIdle time.Duration // idle expiry with "remember me"
	Max          time.Duration // absolute expiry
}

// Manager creates and looks up sessions.
type Manager struct {
	Store     *store.Store
	Key       []byte
	Settings  Settings
	PublicURL string // scheme://host[:port], for the Origin check
	Now       func() time.Time
	Log       *slog.Logger
}

func (m *Manager) now() time.Time {
	if m.Now != nil {
		return m.Now()
	}
	return time.Now()
}

// Active is a resolved session with its credential opened.
type Active struct {
	*store.Session
	// Credential is the mailbox password, the upstream (JMAP) Basic secret.
	// Never log it.
	Credential string
}

// CreateParams describe a new session.
type CreateParams struct {
	Address    string
	Domain     string
	IP         string
	UserAgent  string
	Remember   bool
	Credential string
}

func randToken(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic("session: no randomness: " + err.Error())
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

// HashID is the database id of a cookie value.
func HashID(cookieValue string) string {
	h := sha256.Sum256([]byte(cookieValue))
	return hex.EncodeToString(h[:])
}

// Create stores a new session and returns the cookie value.
func (m *Manager) Create(ctx context.Context, p CreateParams) (string, *store.Session, error) {
	cookie := randToken(32)
	id := HashID(cookie)
	sealed, err := Seal(m.Key, []byte(p.Credential), []byte(id))
	if err != nil {
		return "", nil, err
	}
	now := m.now()
	idle := m.Settings.Idle
	if p.Remember {
		idle = m.Settings.RememberIdle
	}
	abs := now.Add(m.Settings.Max)
	ua := p.UserAgent
	if len(ua) > MaxUserAgent {
		ua = ua[:MaxUserAgent]
	}
	s := &store.Session{
		ID: id, PublicID: randToken(9), Address: strings.ToLower(p.Address), Domain: p.Domain,
		CreatedAt: now, LastUsedAt: now, IdleExpiresAt: minTime(now.Add(idle), abs), ExpiresAt: abs,
		Remember: p.Remember, IP: p.IP, UserAgent: ua,
		CredSealed: sealed, CSRF: randToken(24),
	}
	if err := m.Store.CreateSession(ctx, s); err != nil {
		return "", nil, err
	}
	return cookie, s, nil
}

func minTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}

// Lookup resolves a cookie value. Expired sessions are deleted by the
// caller's reaper, see Reap.
func (m *Manager) Lookup(ctx context.Context, cookieValue string) (*Active, error) {
	if cookieValue == "" {
		return nil, ErrNoSession
	}
	id := HashID(cookieValue)
	s, err := m.Store.GetSession(ctx, id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, ErrNoSession
		}
		return nil, err
	}
	now := m.now()
	if !now.Before(s.ExpiresAt) || !now.Before(s.IdleExpiresAt) {
		return nil, ErrNoSession // the reaper revokes and deletes it
	}
	cred, err := Open(m.Key, s.CredSealed, []byte(s.ID))
	if err != nil {
		return nil, ErrNoSession
	}
	if now.Sub(s.LastUsedAt) >= touchEvery {
		idle := m.Settings.Idle
		if s.Remember {
			idle = m.Settings.RememberIdle
		}
		newIdle := minTime(now.Add(idle), s.ExpiresAt)
		if err := m.Store.TouchSession(ctx, s.ID, now, newIdle); err == nil {
			s.LastUsedAt, s.IdleExpiresAt = now, newIdle
		}
	}
	return &Active{Session: s, Credential: string(cred)}, nil
}

// FromRequest resolves the session cookie of a request.
func (m *Manager) FromRequest(r *http.Request) (*Active, error) {
	c, err := r.Cookie(CookieName)
	if err != nil {
		return nil, ErrNoSession
	}
	return m.Lookup(r.Context(), c.Value)
}

// End deletes a session by its database id. It reports whether it existed.
func (m *Manager) End(ctx context.Context, id string) (bool, error) {
	return m.Store.DeleteSession(ctx, id)
}

// Reap deletes expired sessions and returns them so the caller can drop what
// it caches for them.
func (m *Manager) Reap(ctx context.Context) ([]*store.Session, error) {
	return m.Store.TakeExpired(ctx, m.now())
}

// Cookie builds the Set-Cookie for a new session. maxAge 0 makes a session
// cookie for non-remember logins; the server-side expiry is authoritative.
func (m *Manager) Cookie(value string, s *store.Session) *http.Cookie {
	c := &http.Cookie{Name: CookieName, Value: value, Path: "/", HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode}
	if s != nil && s.Remember {
		c.Expires = s.ExpiresAt
	}
	return c
}

// ClearCookie expires the session cookie.
func ClearCookie() *http.Cookie {
	return &http.Cookie{Name: CookieName, Value: "", Path: "/", HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode, MaxAge: -1}
}

// CheckCSRF enforces, for a mutating request: the per-session token in
// X-Webmail-CSRF (constant-time compare) and an Origin equal to the public
// origin. A missing Origin is rejected: every browser sends it on POST/PUT/
// DELETE, and refusing the rest closes the gap for odd clients.
func (m *Manager) CheckCSRF(r *http.Request, s *store.Session) error {
	if CheckOrigin(r, m.PublicURL) != nil {
		return ErrCSRF
	}
	got := r.Header.Get(CSRFHeader)
	if got == "" || subtle.ConstantTimeCompare([]byte(got), []byte(s.CSRF)) != 1 {
		return ErrCSRF
	}
	return nil
}

// CheckOrigin verifies the Origin header against the public origin.
func CheckOrigin(r *http.Request, publicOrigin string) error {
	o := r.Header.Get("Origin")
	if o == "" || !strings.EqualFold(o, publicOrigin) {
		return ErrCSRF
	}
	return nil
}

// IsMutating reports whether a method changes state.
func IsMutating(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return false
	}
	return true
}
