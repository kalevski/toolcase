package server

import (
	"context"
	"errors"
	"math/rand/v2"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/kalevski/toolcase/webmail/internal/httpx"
	"github.com/kalevski/toolcase/webmail/internal/platform"
	"github.com/kalevski/toolcase/webmail/internal/ratelimit"
	"github.com/kalevski/toolcase/webmail/internal/session"
)

const (
	maxLoginBody   = 8 << 10
	maxSessionsPer = 20 // live sessions per mailbox (spec §3.3)
	maxPassword    = 1024
)

const (
	msgInvalidCreds = "The address or password is incorrect."
	msgRateLimited  = "Too many attempts. Try again later."
)

func (s *Server) handleBranding(w http.ResponseWriter, r *http.Request) {
	ip := httpx.ClientIP(r, s.cfg.TrustedProxies)
	if d, err := s.brandingLim.Hit(r.Context(), ip); err == nil && !d.Allowed {
		s.rateLimited(w, r, d)
		return
	}
	domain := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(r.URL.Query().Get("domain")), "."))
	if domain == "" || !platform.ValidDomain(domain) {
		// not an error: the page stays neutral
		httpx.JSON(w, http.StatusOK, platform.Neutral(domain))
		return
	}
	b, err := s.branding.Get(r.Context(), domain)
	if err != nil {
		s.log.Warn("branding lookup failed", "domain", domain, "error", err)
		b = nil // neutral skin; the login page must still render
	}
	w.Header().Set("Cache-Control", "public, max-age=30")
	httpx.JSON(w, http.StatusOK, platform.Public(domain, b))
}

// handleLogo proxies a domain's logo from the platform (the browser has no
// service token). Only raster/SVG image types pass, served as a sandboxed,
// non-sniffed image.
func (s *Server) handleLogo(w http.ResponseWriter, r *http.Request) {
	ip := httpx.ClientIP(r, s.cfg.TrustedProxies)
	if d, err := s.brandingLim.Hit(r.Context(), ip); err == nil && !d.Allowed {
		s.rateLimited(w, r, d)
		return
	}
	domain := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(r.URL.Query().Get("domain")), "."))
	data, ctype, err := s.platform.Logo(r.Context(), domain)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	ctype = strings.ToLower(strings.TrimSpace(strings.Split(ctype, ";")[0]))
	switch ctype {
	case "image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml":
	default:
		http.NotFound(w, r)
		return
	}
	h := w.Header()
	h.Set("Content-Type", ctype)
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Content-Security-Policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'")
	h.Set("Cache-Control", "public, max-age=300")
	_, _ = w.Write(data)
}

func (s *Server) rateLimited(w http.ResponseWriter, r *http.Request, d ratelimit.Decision) {
	secs := int(d.RetryAfter.Seconds()) + 1
	w.Header().Set("Retry-After", strconv.Itoa(secs))
	httpx.ErrorWith(w, r, http.StatusTooManyRequests, httpx.APIError{Code: "rate_limited", Message: msgRateLimited, RetryAfter: secs})
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Remember bool   `json:"remember"`
}

// validAddress reports whether s looks like local@domain and returns the
// lower-cased address and domain.
func validAddress(s string) (addr, domain string, ok bool) {
	s = strings.ToLower(strings.TrimSpace(s))
	at := strings.LastIndexByte(s, '@')
	if at < 1 || len(s) > 254 || strings.ContainsAny(s, " \t\r\n<>\"") {
		return "", "", false
	}
	if !platform.ValidDomain(s[at+1:]) {
		return "", "", false
	}
	return s, s[at+1:], true
}

// failDelay holds a failed response until minFailDelay (plus jitter) has passed
// since start, so unknown address and wrong password cost the same time.
func (s *Server) failDelay(ctx context.Context, start time.Time) {
	if s.minFailDelay <= 0 {
		return
	}
	jitter := time.Duration(rand.Int64N(int64(s.minFailDelay)/4 + 1))
	remaining := s.minFailDelay + jitter - time.Since(start)
	if remaining <= 0 {
		return
	}
	t := time.NewTimer(remaining)
	defer t.Stop()
	select {
	case <-t.C:
	case <-ctx.Done():
	}
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	if o := r.Header.Get("Origin"); o != "" && session.CheckOrigin(r, s.cfg.PublicURL) != nil {
		httpx.Error(w, r, http.StatusForbidden, "csrf", "The request could not be verified.")
		return
	}
	var req loginRequest
	if err := httpx.ReadJSON(w, r, maxLoginBody, &req); err != nil {
		httpx.BadJSON(w, r, err)
		return
	}
	if req.Email == "" || req.Password == "" || len(req.Password) > maxPassword {
		httpx.Error(w, r, http.StatusBadRequest, "bad_request", "Enter your address and password.")
		return
	}
	ctx := r.Context()
	ip := httpx.ClientIP(r, s.cfg.TrustedProxies)
	addr, domain, ok := validAddress(req.Email)
	key := addr
	if !ok {
		key = "invalid:" + ip // never let junk input create unbounded counters
	}

	// Limits first: a blocked client does not reach the platform at all.
	for _, lim := range []struct {
		f *ratelimit.Failures
		k string
	}{{s.loginIP, ip}, {s.loginAddr, key}} {
		d, err := lim.f.Check(ctx, lim.k)
		if err != nil {
			s.log.Error("rate limit check", "error", err)
			httpx.Error(w, r, http.StatusInternalServerError, "internal", "Something went wrong.")
			return
		}
		if !d.Allowed {
			s.logins.Inc("rate_limited")
			s.log.Info("login blocked", "client", ip, "retry_after_s", int(d.RetryAfter.Seconds()))
			s.rateLimited(w, r, d)
			return
		}
	}
	reject := func() {
		_ = s.loginIP.Fail(ctx, ip)
		_ = s.loginAddr.Fail(ctx, key)
		s.logins.Inc("invalid_credentials")
		s.failDelay(ctx, start)
		httpx.Error(w, r, http.StatusUnauthorized, "invalid_credentials", msgInvalidCreds)
	}
	if !ok {
		reject()
		return
	}

	// The real password goes to the platform and nowhere else; it is not stored
	// or logged. Only the returned session credential is kept (sealed).
	cred, err := s.platform.CreateSession(ctx, addr, req.Password, ip, r.UserAgent())
	req.Password = ""
	var rl *platform.RateLimitedError
	switch {
	case errors.Is(err, platform.ErrInvalidCredentials):
		reject()
		return
	case errors.As(err, &rl):
		s.logins.Inc("platform_rate_limited")
		s.rateLimited(w, r, ratelimit.Decision{RetryAfter: rl.RetryAfter})
		return
	case err != nil:
		s.logins.Inc("platform_error")
		s.log.Warn("platform sign-in failed", "error", err)
		httpx.Error(w, r, http.StatusServiceUnavailable, "platform_unavailable", "Sign-in is temporarily unavailable. Try again in a moment.")
		return
	}

	// Open a JMAP session with the credential to prove it works and learn the
	// account id.
	doc, err := s.jmap.Session(ctx, addr, cred.Credential, ip)
	if err == nil && doc.OwnAccountID() == "" {
		err = errors.New("no mail account")
	}
	if err != nil {
		s.logins.Inc("mail_unavailable")
		s.log.Warn("jmap session failed after sign-in", "error", err)
		s.revokeNow(cred.ID)
		httpx.Error(w, r, http.StatusBadGateway, "mail_unavailable", "Your mailbox is not reachable right now. Try again in a moment.")
		return
	}
	cookie, sess, err := s.sessions.Create(ctx, session.CreateParams{
		Address: addr, Domain: domain, IP: ip, UserAgent: r.UserAgent(), Remember: req.Remember,
		PlatformID: cred.ID, Credential: cred.Credential, CredentialExpires: cred.ExpiresAt,
	})
	if err != nil {
		s.log.Error("create session", "error", err)
		s.revokeNow(cred.ID)
		httpx.Error(w, r, http.StatusInternalServerError, "internal", "Something went wrong.")
		return
	}
	_ = s.store.SetAccountID(ctx, sess.ID, doc.OwnAccountID())
	_ = s.loginAddr.Reset(ctx, addr)
	s.logins.Inc("ok")
	s.limitSessions(ctx, addr)
	httpx.From(ctx).Principal = sess.PublicID
	http.SetCookie(w, s.sessions.Cookie(cookie, sess))
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) revokeNow(id string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := s.platform.RevokeSession(ctx, id); err != nil {
		s.log.Warn("revoke session credential", "error", err)
	}
}

// limitSessions ends the oldest sessions beyond maxSessionsPer.
func (s *Server) limitSessions(ctx context.Context, addr string) {
	all, err := s.store.ListSessions(ctx, addr, s.clock())
	if err != nil || len(all) <= maxSessionsPer {
		return
	}
	for _, old := range all[maxSessionsPer:] { // newest first
		s.gw.Forget(old.ID)
		s.sessions.Terminate(ctx, old)
	}
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	a, err := s.sessions.FromRequest(r)
	if err == nil {
		if cerr := s.sessions.CheckCSRF(r, a.Session); cerr != nil {
			httpx.Error(w, r, http.StatusForbidden, "csrf", "The request could not be verified.")
			return
		}
		s.gw.Forget(a.ID)
		s.sessions.Terminate(r.Context(), a.Session)
	}
	http.SetCookie(w, session.ClearCookie())
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

type sessionInfo struct {
	ID         string    `json:"id"`
	Current    bool      `json:"current"`
	CreatedAt  time.Time `json:"createdAt"`
	LastUsedAt time.Time `json:"lastUsedAt"`
	IP         string    `json:"ip"`
	UserAgent  string    `json:"userAgent"`
	Remember   bool      `json:"remember"`
}

func (s *Server) handleListSessions(w http.ResponseWriter, r *http.Request, a *session.Active) {
	all, err := s.store.ListSessions(r.Context(), a.Address, s.clock())
	if err != nil {
		s.log.Error("list sessions", "error", err)
		httpx.Error(w, r, http.StatusInternalServerError, "internal", "Something went wrong.")
		return
	}
	out := make([]sessionInfo, 0, len(all))
	for _, x := range all {
		out = append(out, sessionInfo{ID: x.PublicID, Current: x.ID == a.ID, CreatedAt: x.CreatedAt.UTC(),
			LastUsedAt: x.LastUsedAt.UTC(), IP: x.IP, UserAgent: x.UserAgent, Remember: x.Remember})
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (s *Server) handleEndSession(w http.ResponseWriter, r *http.Request, a *session.Active) {
	id := r.PathValue("id")
	if id == a.PublicID {
		httpx.Error(w, r, http.StatusBadRequest, "current_session", "Use sign out to end this session.")
		return
	}
	x, err := s.store.TakeSessionByPublicID(r.Context(), a.Address, id)
	if err != nil {
		httpx.Error(w, r, http.StatusNotFound, "not_found", "That session does not exist.")
		return
	}
	s.gw.Forget(x.ID)
	s.sessions.Revoke(x)
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

type passwordRequest struct {
	Current string `json:"current"`
	Next    string `json:"next"`
}

func (s *Server) handlePassword(w http.ResponseWriter, r *http.Request, a *session.Active) {
	var req passwordRequest
	if err := httpx.ReadJSON(w, r, maxLoginBody, &req); err != nil {
		httpx.BadJSON(w, r, err)
		return
	}
	if req.Current == "" || req.Next == "" || len(req.Next) > maxPassword || len(req.Current) > maxPassword {
		httpx.Error(w, r, http.StatusBadRequest, "bad_request", "Enter your current and new password.")
		return
	}
	ctx := r.Context()
	ip := httpx.ClientIP(r, s.cfg.TrustedProxies)
	for _, lim := range []struct {
		f *ratelimit.Failures
		k string
	}{{s.pwdIP, ip}, {s.pwdAddr, a.Address}} {
		if d, err := lim.f.Check(ctx, lim.k); err == nil && !d.Allowed {
			s.rateLimited(w, r, d)
			return
		}
	}
	err := s.platform.ChangePassword(ctx, a.Address, req.Current, req.Next)
	req.Current, req.Next = "", ""
	var rl *platform.RateLimitedError
	var pe *platform.PolicyError
	switch {
	case errors.Is(err, platform.ErrInvalidCredentials):
		_ = s.pwdIP.Fail(ctx, ip)
		_ = s.pwdAddr.Fail(ctx, a.Address)
		httpx.Error(w, r, http.StatusUnauthorized, "invalid_credentials", "Your current password is incorrect.")
	case errors.As(err, &rl):
		s.rateLimited(w, r, ratelimit.Decision{RetryAfter: rl.RetryAfter})
	case errors.As(err, &pe):
		httpx.Error(w, r, http.StatusBadRequest, "password_policy", pe.Message)
	case err != nil:
		s.log.Warn("password change failed", "error", err)
		httpx.Error(w, r, http.StatusServiceUnavailable, "platform_unavailable", "The password could not be changed right now. Try again in a moment.")
	default:
		// The platform revoked every session credential of the mailbox: all
		// our sessions for it are dead, this one included.
		_ = s.pwdAddr.Reset(ctx, a.Address)
		dead, _ := s.store.TakeAllSessions(ctx, a.Address)
		for _, d := range dead {
			s.gw.Forget(d.ID)
		}
		http.SetCookie(w, session.ClearCookie())
		httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}

type inviteRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

func (s *Server) handleInvite(w http.ResponseWriter, r *http.Request) {
	if o := r.Header.Get("Origin"); o != "" && session.CheckOrigin(r, s.cfg.PublicURL) != nil {
		httpx.Error(w, r, http.StatusForbidden, "csrf", "The request could not be verified.")
		return
	}
	ip := httpx.ClientIP(r, s.cfg.TrustedProxies)
	if d, err := s.inviteLim.Hit(r.Context(), ip); err == nil && !d.Allowed {
		s.rateLimited(w, r, d)
		return
	}
	var req inviteRequest
	if err := httpx.ReadJSON(w, r, maxLoginBody, &req); err != nil {
		httpx.BadJSON(w, r, err)
		return
	}
	if req.Token == "" || len(req.Token) > 512 || req.Password == "" || len(req.Password) > maxPassword {
		httpx.Error(w, r, http.StatusBadRequest, "bad_request", "Enter a new password.")
		return
	}
	err := s.platform.RedeemInvite(r.Context(), req.Token, req.Password)
	req.Password = ""
	var rl *platform.RateLimitedError
	var pe *platform.PolicyError
	switch {
	case errors.Is(err, platform.ErrInvalidToken), errors.Is(err, platform.ErrInvalidCredentials):
		httpx.Error(w, r, http.StatusBadRequest, "invalid_token", "This invitation link is not valid or was already used.")
	case errors.As(err, &rl):
		s.rateLimited(w, r, ratelimit.Decision{RetryAfter: rl.RetryAfter})
	case errors.As(err, &pe):
		httpx.Error(w, r, http.StatusBadRequest, "password_policy", pe.Message)
	case err != nil:
		s.log.Warn("invite redeem failed", "error", err)
		httpx.Error(w, r, http.StatusServiceUnavailable, "platform_unavailable", "The invitation could not be redeemed right now. Try again in a moment.")
	default:
		httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}
