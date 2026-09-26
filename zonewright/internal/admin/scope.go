package admin

import (
	"context"
	"crypto/subtle"
	"net/http"
	"slices"
	"strings"

	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/manager"
)

// ScopedToken is a resolved admin.scoped_tokens entry.
type ScopedToken struct {
	Name  string
	Token string
	Scope string
	// Zones limits the token to these (normalized) zones; empty = none.
	Zones []string
	// AllZones lets the token reach every zone (exclusive with Zones).
	AllZones bool
	// Source is "config" (admin.scoped_tokens, this server only) or "api"
	// (created over the API, replicated to every server).
	Source string
}

// acmeLabel is the owner-name label an ACME DNS-01 challenge lives under.
const acmeLabel = "_acme-challenge"

// SetScopedTokens enables limited bearer tokens next to the admin token.
func (s *Server) SetScopedTokens(tokens []ScopedToken) { s.scoped = tokens }

type scopedKey struct{}

// scopedFrom returns the scoped token that authenticated r, or nil when the
// request came in with the full admin token (or no auth is configured).
func scopedFrom(ctx context.Context) *ScopedToken {
	t, _ := ctx.Value(scopedKey{}).(*ScopedToken)
	return t
}

// matchScoped finds the scoped token got belongs to: first the config tokens
// (compared all, so the time taken does not depend on which one matched),
// then the API-created ones, looked up by the SHA-256 of got.
func (s *Server) matchScoped(got string) *ScopedToken {
	var match *ScopedToken
	for i := range s.scoped {
		if subtle.ConstantTimeCompare([]byte(got), []byte(s.scoped[i].Token)) == 1 {
			match = &s.scoped[i]
		}
	}
	if match != nil || got == "" {
		return match
	}
	t, ok, err := s.mgr.Store().TokenByHash(hashToken(got))
	if err != nil {
		s.log.Error("token lookup failed", "error", err)
		return nil
	}
	if !ok {
		return nil
	}
	return &ScopedToken{Name: t.Name, Scope: t.Scope, Zones: t.Zones, AllZones: t.AllZones, Source: "api"}
}

// allowsZone reports whether the token may touch zone (already normalized).
func (t *ScopedToken) allowsZone(zone string) bool {
	return t.AllZones || slices.Contains(t.Zones, zone)
}

// admitScoped runs the endpoint- and zone-level checks for a scoped token,
// writing 403 and returning false when the request is outside its scope.
// Record-level checks (type and name) happen in the handlers, once the body
// and the path have been normalized — see permitRecord.
func admitScoped(w http.ResponseWriter, r *http.Request, e endpoint, t *ScopedToken) bool {
	if !e.acme {
		writeError(w, http.StatusForbidden, "token "+t.Name+" (scope "+t.Scope+") may not call "+e.method+" "+e.pattern)
		return false
	}
	if raw := r.PathValue("zone"); raw != "" {
		zone, err := config.NormalizeZoneName(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return false
		}
		if !t.allowsZone(zone) {
			writeError(w, http.StatusForbidden, "token "+t.Name+" may not change zone "+zone)
			return false
		}
	}
	return true
}

// permitRecord refuses (403) a record write a scoped token is not allowed to
// make. name is the normalized relative owner name, typ the upper-case type.
func permitRecord(r *http.Request, name, typ string) error {
	t := scopedFrom(r.Context())
	if t == nil {
		return nil
	}
	if typ == "TXT" && (name == acmeLabel || strings.HasPrefix(name, acmeLabel+".")) {
		return nil
	}
	return manager.Errorf(http.StatusForbidden, "token %s (scope %s) may only write TXT records named %s or %s.<name>, not %s %s",
		t.Name, t.Scope, acmeLabel, acmeLabel, name, typ)
}

// Lookup is the GET /lookup payload: the zone that holds a name, and the
// name relative to it.
type Lookup struct {
	Zone   string `json:"zone"`
	Name   string `json:"name"`
	Source string `json:"source"`
	// Writable is false for a local zone (declared in a config file), which
	// the API cannot change.
	Writable bool `json:"writable"`
}

// handleLookup answers GET /lookup?name=<fqdn> with the most specific zone
// the name falls in. A scoped token only sees the zones it is allowed.
func (s *Server) handleLookup(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimSpace(r.URL.Query().Get("name"))
	if raw == "" {
		writeError(w, http.StatusBadRequest, "?name= is required")
		return
	}
	fqdn := strings.ToLower(strings.TrimSuffix(raw, "."))
	t := scopedFrom(r.Context())
	eff, _ := s.mgr.Effective()
	var best *config.Zone
	for i := range eff.Zones {
		z := &eff.Zones[i]
		if fqdn != z.Name && !strings.HasSuffix(fqdn, "."+z.Name) {
			continue
		}
		if t != nil && !t.allowsZone(z.Name) {
			continue
		}
		if best == nil || len(z.Name) > len(best.Name) {
			best = z
		}
	}
	if best == nil {
		writeError(w, http.StatusNotFound, "no zone holds "+fqdn)
		return
	}
	name, err := config.NormalizeOwner(fqdn+".", best.Name)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	src := source(best)
	writeJSON(w, http.StatusOK, Lookup{Zone: best.Name, Name: name, Source: src, Writable: src == "replicated"}, s)
}
