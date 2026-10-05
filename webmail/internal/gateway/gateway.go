// Package gateway is the authenticated JMAP gateway (spec §3.6): the browser
// talks JMAP to webmail as if it were the mail server; the gateway adds the
// session credential, forces the account, allow-lists capabilities and
// methods, and rewrites URLs. Mail server specifics live in internal/jmap.
package gateway

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/netip"
	"sync"
	"time"

	"github.com/kalevski/toolcase/webmail/internal/httpx"
	"github.com/kalevski/toolcase/webmail/internal/jmap"
	"github.com/kalevski/toolcase/webmail/internal/obs"
	"github.com/kalevski/toolcase/webmail/internal/platform"
	"github.com/kalevski/toolcase/webmail/internal/session"
	"github.com/kalevski/toolcase/webmail/internal/store"
)

// Gateway serves the authenticated /api routes that touch the mail server.
type Gateway struct {
	Sessions       *session.Manager
	JMAP           *jmap.Client
	Store          *store.Store
	Branding       *platform.BrandingCache
	MaxUploadBytes int64
	Trusted        []netip.Prefix
	Log            *slog.Logger
	Now            func() time.Time

	// Metrics (optional)
	Upstream *obs.CounterVec // webmail_upstream_requests_total{op,result}

	mu    sync.Mutex
	cache map[string]cachedDoc
}

type cachedDoc struct {
	doc *jmap.SessionDoc
	at  time.Time
}

const (
	docTTL      = 5 * time.Minute
	maxDocCache = 4096
)

func (g *Gateway) now() time.Time {
	if g.Now != nil {
		return g.Now()
	}
	return time.Now()
}

// Routes registers the gateway's routes on mux (Go 1.22 patterns).
func (g *Gateway) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/session", g.Sessions.Require(g.handleSession))
	mux.HandleFunc("PUT /api/prefs", g.Sessions.Require(g.handlePutPrefs))
	mux.HandleFunc("POST /api/jmap", g.Sessions.Require(g.handleJMAP))
	mux.HandleFunc("GET /api/download/{accountId}/{blobId}/{name}", g.Sessions.Require(g.handleDownload))
	mux.HandleFunc("POST /api/upload/{accountId}", g.Sessions.Require(g.handleUpload))
	mux.HandleFunc("GET /api/eventsource", g.Sessions.Require(g.handleEventSource))
	mux.HandleFunc("GET /api/message-html/{emailId}", g.Sessions.Require(g.handleMessageHTML))
}

func (g *Gateway) count(op, result string) {
	if g.Upstream != nil {
		g.Upstream.Inc(op, result)
	}
}

func (g *Gateway) clientIP(r *http.Request) string { return httpx.ClientIP(r, g.Trusted) }

// sessionDoc returns the upstream session document for a session, cached for a
// few minutes unless refresh is set.
func (g *Gateway) sessionDoc(ctx context.Context, r *http.Request, a *session.Active, refresh bool) (*jmap.SessionDoc, error) {
	if !refresh {
		g.mu.Lock()
		c, ok := g.cache[a.ID]
		g.mu.Unlock()
		if ok && g.now().Sub(c.at) < docTTL {
			return c.doc, nil
		}
	}
	doc, err := g.JMAP.Session(ctx, a.Address, a.Credential, g.clientIP(r))
	if err != nil {
		return nil, err
	}
	g.mu.Lock()
	if g.cache == nil || len(g.cache) >= maxDocCache {
		g.cache = map[string]cachedDoc{}
	}
	g.cache[a.ID] = cachedDoc{doc: doc, at: g.now()}
	g.mu.Unlock()
	return doc, nil
}

// Forget drops cached state of a session (logout, expiry).
func (g *Gateway) Forget(id string) {
	g.mu.Lock()
	delete(g.cache, id)
	g.mu.Unlock()
}

// accountID is the user's own JMAP account for a session; it is learned once
// from the session document and stored.
func (g *Gateway) accountID(ctx context.Context, r *http.Request, a *session.Active) (string, error) {
	if a.AccountID != "" {
		return a.AccountID, nil
	}
	doc, err := g.sessionDoc(ctx, r, a, true)
	if err != nil {
		return "", err
	}
	id := doc.OwnAccountID()
	if id == "" {
		return "", errNoAccount
	}
	if err := g.Store.SetAccountID(ctx, a.ID, id); err != nil {
		return "", err
	}
	a.AccountID = id
	return id, nil
}

var errNoAccount = errors.New("gateway: the mail server returned no mail account for this user")

// upstreamFailed answers a failed upstream call. A 401 from the mail server
// means the session credential is dead (password change, revocation, sweep):
// the webmail session ends (spec §3.3).
func (g *Gateway) upstreamFailed(w http.ResponseWriter, r *http.Request, a *session.Active, op string, err error) {
	switch {
	case errors.Is(err, jmap.ErrUnauthorized):
		g.count(op, "unauthorized")
		g.Sessions.Terminate(r.Context(), a.Session)
		g.Forget(a.ID)
		http.SetCookie(w, session.ClearCookie())
		httpx.Error(w, r, http.StatusUnauthorized, "unauthenticated", "Your session has ended. Sign in again.")
	case errors.Is(err, context.Canceled):
		g.count(op, "canceled")
		httpx.Error(w, r, 499, "canceled", "The request was canceled.")
	case errors.Is(err, errNoAccount):
		g.count(op, "no_account")
		g.Log.Error("no mail account", "address", a.Address)
		httpx.Error(w, r, http.StatusBadGateway, "no_mail_account", "This mailbox has no mail account on the server.")
	default:
		g.count(op, "error")
		g.Log.Warn("upstream failed", "op", op, "error", err, "session", a.PublicID)
		httpx.Error(w, r, http.StatusBadGateway, "upstream_unavailable", "The mail server is not reachable right now. Try again in a moment.")
	}
}
