package admin

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/manager"
	"github.com/kalevski/toolcase/zonewright/internal/store"
)

// tokenPrefix marks zonewright API tokens so they are recognisable in
// configs and secret scanners.
const tokenPrefix = "zwt_"

// TokenView is a scoped token as the API lists it. The secret is never
// returned, except once in the response that creates or rotates it.
type TokenView struct {
	Name     string   `json:"name"`
	Scope    string   `json:"scope"`
	Zones    []string `json:"zones"`
	AllZones bool     `json:"all_zones"`
	Source   string   `json:"source"` // config | api
	Created  string   `json:"created_at,omitempty"`
}

// tokenBody is the POST /tokens and PUT /tokens/{name} body. A token reaches
// the listed zones, or every zone with all_zones — never by omission: no
// zones and no all_zones is a token that can change nothing (yet).
type tokenBody struct {
	Name     string   `json:"name"`
	Scope    string   `json:"scope"`
	Zones    []string `json:"zones"`
	AllZones bool     `json:"all_zones"`
}

func hashToken(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}

func newTokenSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return tokenPrefix + hex.EncodeToString(b), nil
}

func viewOf(t store.Token) TokenView {
	zones := t.Zones
	if zones == nil {
		zones = []string{}
	}
	return TokenView{Name: t.Name, Scope: t.Scope, Zones: zones, AllZones: t.AllZones, Source: "api", Created: t.Created}
}

func (s *Server) configToken(name string) *ScopedToken {
	for i := range s.scoped {
		if s.scoped[i].Name == name {
			return &s.scoped[i]
		}
	}
	return nil
}

// checkTokenBody validates a token body's scope and zones.
func checkTokenBody(b *tokenBody) error {
	if b.Scope == "" {
		b.Scope = config.ScopeACME
	}
	if b.Scope != config.ScopeACME {
		return manager.Errorf(http.StatusBadRequest, "scope %q is not supported (only %q)", b.Scope, config.ScopeACME)
	}
	if b.AllZones && len(b.Zones) > 0 {
		return manager.Errorf(http.StatusBadRequest, "set zones or all_zones: true, not both")
	}
	zones, err := config.NormalizeTokenZones(b.Zones)
	if err != nil {
		return manager.Errorf(http.StatusBadRequest, "%v", err)
	}
	b.Zones = zones
	return nil
}

// handleListTokens lists every scoped token this server accepts: its own
// config tokens and the replicated API tokens.
func (s *Server) handleListTokens(w http.ResponseWriter, _ *http.Request) {
	out := []TokenView{}
	for _, t := range s.scoped {
		zones := t.Zones
		if zones == nil {
			zones = []string{}
		}
		out = append(out, TokenView{Name: t.Name, Scope: t.Scope, Zones: zones, AllZones: t.AllZones, Source: "config"})
	}
	api, err := s.mgr.Store().Tokens()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	for _, t := range api {
		out = append(out, viewOf(t))
	}
	writeJSON(w, http.StatusOK, map[string]any{"tokens": out}, s)
}

// handleCreateToken creates a replicated scoped token and returns its secret
// — the only time it is ever shown.
func (s *Server) handleCreateToken(w http.ResponseWriter, r *http.Request) {
	if s.token == "" {
		writeError(w, http.StatusConflict, "API tokens need an admin token (admin.token_env or admin.token_file): without one the API is unauthenticated")
		return
	}
	var body tokenBody
	if !decodeJSON(w, r, &body) {
		return
	}
	if !config.ValidTokenName(body.Name) {
		writeError(w, http.StatusBadRequest, "name must match [a-z0-9-]+ (at most 64 characters)")
		return
	}
	if err := checkTokenBody(&body); err != nil {
		s.writeTokenError(w, err)
		return
	}
	if s.configToken(body.Name) != nil {
		writeError(w, http.StatusConflict, "token "+body.Name+" is defined in this server's config")
		return
	}
	if _, exists, err := s.mgr.Store().Token(body.Name); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	} else if exists {
		writeError(w, http.StatusConflict, "token "+body.Name+" already exists (rotate it, or delete it first)")
		return
	}
	secret, err := newTokenSecret()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	p := store.TokenPayload{Hash: hashToken(secret), Scope: body.Scope, Zones: body.Zones, AllZones: body.AllZones, Created: time.Now().UTC().Format(time.RFC3339)}
	s.commitToken(w, r, body.Name, p, http.StatusCreated, secret)
}

// handleUpdateToken replaces an API token's scope and zones; its secret stays.
func (s *Server) handleUpdateToken(w http.ResponseWriter, r *http.Request) {
	cur, ok := s.apiToken(w, r)
	if !ok {
		return
	}
	var body tokenBody
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.Name != "" && body.Name != cur.Name {
		writeError(w, http.StatusBadRequest, "body names token "+body.Name+" but the path names "+cur.Name)
		return
	}
	if err := checkTokenBody(&body); err != nil {
		s.writeTokenError(w, err)
		return
	}
	p := store.TokenPayload{Hash: cur.Hash, Scope: body.Scope, Zones: body.Zones, AllZones: body.AllZones, Created: cur.Created}
	s.commitToken(w, r, cur.Name, p, http.StatusOK, "")
}

// handleRotateToken gives an API token a new secret; the old one stops
// working as soon as each server has the change.
func (s *Server) handleRotateToken(w http.ResponseWriter, r *http.Request) {
	cur, ok := s.apiToken(w, r)
	if !ok {
		return
	}
	secret, err := newTokenSecret()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	p := store.TokenPayload{Hash: hashToken(secret), Scope: cur.Scope, Zones: cur.Zones, AllZones: cur.AllZones, Created: cur.Created}
	s.commitToken(w, r, cur.Name, p, http.StatusOK, secret)
}

// handleDeleteToken revokes an API token on every server.
func (s *Server) handleDeleteToken(w http.ResponseWriter, r *http.Request) {
	cur, ok := s.apiToken(w, r)
	if !ok {
		return
	}
	ops, err := s.mgr.WriteToken(cur.Name, store.TokenPayload{Deleted: true})
	if err != nil {
		s.writeTokenError(w, err)
		return
	}
	resp := map[string]any{"status": "deleted", "name": cur.Name}
	code := http.StatusOK
	if s.waitReplicated(r, ops, resp) {
		code = http.StatusAccepted
	}
	writeJSON(w, code, resp, s)
}

// apiToken resolves {name} to a live API token, writing 404 (or 409 for a
// config token, which is read-only over the API).
func (s *Server) apiToken(w http.ResponseWriter, r *http.Request) (store.Token, bool) {
	name := r.PathValue("name")
	t, ok, err := s.mgr.Store().Token(name)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return store.Token{}, false
	}
	if ok {
		return t, true
	}
	if s.configToken(name) != nil {
		writeError(w, http.StatusConflict, "token "+name+" is defined in this server's config and is read-only over the API")
		return store.Token{}, false
	}
	writeError(w, http.StatusNotFound, "token "+name+" not found")
	return store.Token{}, false
}

func (s *Server) commitToken(w http.ResponseWriter, r *http.Request, name string, p store.TokenPayload, code int, secret string) {
	ops, err := s.mgr.WriteToken(name, p)
	if err != nil {
		s.writeTokenError(w, err)
		return
	}
	v := viewOf(store.Token{Name: name, Hash: p.Hash, Scope: p.Scope, Zones: p.Zones, AllZones: p.AllZones, Created: p.Created})
	resp := map[string]any{
		"status": map[int]string{http.StatusCreated: "created", http.StatusOK: "updated"}[code],
		"name":   v.Name, "scope": v.Scope, "zones": v.Zones, "all_zones": v.AllZones, "source": v.Source, "created_at": v.Created,
	}
	if secret != "" {
		resp["token"] = secret
	}
	if s.waitReplicated(r, ops, resp) {
		code = http.StatusAccepted
	}
	writeJSON(w, code, resp, s)
}

func (s *Server) writeTokenError(w http.ResponseWriter, err error) {
	var we *manager.WriteError
	if errors.As(err, &we) {
		writeError(w, we.Code, we.Msg)
		return
	}
	s.log.Error("token write failed", "error", err)
	writeError(w, http.StatusInternalServerError, err.Error())
}
