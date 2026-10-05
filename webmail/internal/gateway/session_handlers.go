package gateway

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/kalevski/toolcase/webmail/internal/httpx"
	"github.com/kalevski/toolcase/webmail/internal/jmap"
	"github.com/kalevski/toolcase/webmail/internal/platform"
	"github.com/kalevski/toolcase/webmail/internal/session"
)

// Prefs are the per-mailbox preferences kept in SQLite (spec §3.4).
type Prefs struct {
	Language       string   `json:"language"`
	Theme          string   `json:"theme"`   // light | dark | system
	Density        string   `json:"density"` // comfortable | compact
	Layout         string   `json:"layout"`  // list | right | bottom
	ImagePolicy    string   `json:"imagePolicy"`
	TrustedSenders []string `json:"trustedSenders"`
}

// DefaultPrefs are used until the user saves settings.
func DefaultPrefs() Prefs {
	return Prefs{Theme: "system", Density: "comfortable", Layout: "right", ImagePolicy: "ask", TrustedSenders: []string{}}
}

const (
	maxPrefsBytes     = 32 << 10
	maxTrustedSenders = 500
)

func oneOf(v string, allowed ...string) bool {
	for _, a := range allowed {
		if v == a {
			return true
		}
	}
	return false
}

// Validate normalises p in place and reports the first problem.
func (p *Prefs) Validate() string {
	d := DefaultPrefs()
	if p.Theme == "" {
		p.Theme = d.Theme
	}
	if p.Density == "" {
		p.Density = d.Density
	}
	if p.Layout == "" {
		p.Layout = d.Layout
	}
	if p.ImagePolicy == "" {
		p.ImagePolicy = d.ImagePolicy
	}
	switch {
	case !oneOf(p.Theme, "light", "dark", "system"):
		return "theme must be light, dark or system"
	case !oneOf(p.Density, "comfortable", "compact"):
		return "density must be comfortable or compact"
	case !oneOf(p.Layout, "list", "right", "bottom"):
		return "layout must be list, right or bottom"
	case !oneOf(p.ImagePolicy, "ask", "always", "never"):
		return "imagePolicy must be ask, always or never"
	case p.Language != "" && (len(p.Language) > 16 || strings.ContainsAny(p.Language, " <>\"'&")):
		return "language is not valid"
	case len(p.TrustedSenders) > maxTrustedSenders:
		return "too many trusted senders"
	}
	seen := map[string]bool{}
	clean := make([]string, 0, len(p.TrustedSenders))
	for _, s := range p.TrustedSenders {
		s = strings.ToLower(strings.TrimSpace(s))
		if s == "" || len(s) > 254 || strings.ContainsAny(s, " <>\"'\r\n") || !strings.Contains(s, "@") {
			return "a trusted sender is not an email address"
		}
		if !seen[s] {
			seen[s] = true
			clean = append(clean, s)
		}
	}
	p.TrustedSenders = clean
	return ""
}

func (g *Gateway) loadPrefs(r *http.Request, address string) Prefs {
	p := DefaultPrefs()
	raw, err := g.Store.GetPrefs(r.Context(), address)
	if err != nil {
		g.Log.Error("load prefs", "error", err)
		return p
	}
	if raw != "" {
		_ = json.Unmarshal([]byte(raw), &p)
		if p.Validate() != "" {
			p = DefaultPrefs()
		}
	}
	return p
}

// SessionResponse is the body of GET /api/session.
type SessionResponse struct {
	Address   string                   `json:"address"`
	SessionID string                   `json:"sessionId"`
	CSRF      string                   `json:"csrf"`
	JMAP      *jmap.SessionDoc         `json:"jmap"`
	Branding  *platform.PublicBranding `json:"branding"`
	Prefs     Prefs                    `json:"prefs"`
	Limits    map[string]int64         `json:"limits"`
}

func (g *Gateway) handleSession(w http.ResponseWriter, r *http.Request, a *session.Active) {
	doc, err := g.sessionDoc(r.Context(), r, a, true)
	if err != nil {
		g.upstreamFailed(w, r, a, "session", err)
		return
	}
	acct := doc.OwnAccountID()
	if acct == "" {
		g.upstreamFailed(w, r, a, "session", errNoAccount)
		return
	}
	if a.AccountID != acct {
		if err := g.Store.SetAccountID(r.Context(), a.ID, acct); err != nil {
			g.Log.Error("store account id", "error", err)
		}
	}
	b, err := g.Branding.Get(r.Context(), a.Domain)
	if err != nil {
		g.Log.Warn("branding unavailable", "domain", a.Domain, "error", err)
	}
	g.count("session", "ok")
	httpx.JSON(w, http.StatusOK, SessionResponse{
		Address: a.Address, SessionID: a.PublicID, CSRF: a.CSRF,
		JMAP:     doc.Rewrite(acct, a.Address),
		Branding: platform.Public(a.Domain, b),
		Prefs:    g.loadPrefs(r, a.Address),
		Limits: map[string]int64{
			"maxUploadBytes": g.MaxUploadBytes, "maxCallsInRequest": jmap.MaxCalls, "maxBodyBytes": jmap.MaxBodyBytes,
		},
	})
}

func (g *Gateway) handlePutPrefs(w http.ResponseWriter, r *http.Request, a *session.Active) {
	var p Prefs
	if err := httpx.ReadJSON(w, r, maxPrefsBytes, &p); err != nil {
		httpx.BadJSON(w, r, err)
		return
	}
	if msg := p.Validate(); msg != "" {
		httpx.Error(w, r, http.StatusBadRequest, "invalid_prefs", "Invalid settings: "+msg+".")
		return
	}
	b, _ := json.Marshal(p)
	if err := g.Store.PutPrefs(r.Context(), a.Address, string(b), g.now()); err != nil {
		g.Log.Error("store prefs", "error", err)
		httpx.Error(w, r, http.StatusInternalServerError, "internal", "Could not save settings.")
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}
