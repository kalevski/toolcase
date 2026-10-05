package session

import (
	"context"
	"net/http"
	"time"

	"github.com/kalevski/toolcase/webmail/internal/httpx"
	"github.com/kalevski/toolcase/webmail/internal/store"
)

// Revoker revokes a session credential at the platform.
type Revoker interface {
	RevokeSession(ctx context.Context, id string) error
}

// Terminate ends a session: the row is deleted now, the platform credential is
// revoked in the background (best effort; the platform also sweeps expired
// credentials hourly, spec §3.3).
func (m *Manager) Terminate(ctx context.Context, s *store.Session) {
	if _, err := m.Store.DeleteSession(ctx, s.ID); err != nil && m.Log != nil {
		m.Log.Error("delete session", "error", err)
	}
	m.Revoke(s)
}

// Revoke revokes the platform credential of s in the background.
func (m *Manager) Revoke(s *store.Session) {
	if m.Revoker == nil || s.PlatformID == "" {
		return
	}
	m.bg.Add(1)
	go func() {
		defer m.bg.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := m.Revoker.RevokeSession(ctx, s.PlatformID); err != nil && m.Log != nil {
			m.Log.Warn("revoke session credential", "error", err)
		}
	}()
}

// Wait blocks until background revocations finish (shutdown, tests).
func (m *Manager) Wait() { m.bg.Wait() }

// Require wraps a handler: it needs a valid session; mutating methods also
// need the CSRF token and a matching Origin (spec §3.3). Anything else is a
// JSON 401 / 403.
func (m *Manager) Require(h func(w http.ResponseWriter, r *http.Request, a *Active)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, err := m.FromRequest(r)
		if err != nil {
			if err != ErrNoSession {
				if m.Log != nil {
					m.Log.Error("session lookup", "error", err)
				}
				httpx.Error(w, r, http.StatusInternalServerError, "internal", "Something went wrong.")
				return
			}
			http.SetCookie(w, ClearCookie())
			httpx.Error(w, r, http.StatusUnauthorized, "unauthenticated", "Sign in to continue.")
			return
		}
		httpx.From(r.Context()).Principal = a.PublicID
		if IsMutating(r.Method) {
			if err := m.CheckCSRF(r, a.Session); err != nil {
				httpx.Error(w, r, http.StatusForbidden, "csrf", "The request could not be verified. Reload the page and try again.")
				return
			}
		}
		h(w, r, a)
	}
}
