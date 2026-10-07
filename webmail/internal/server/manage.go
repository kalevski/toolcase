package server

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/kalevski/toolcase/webmail/internal/branding"
	"github.com/kalevski/toolcase/webmail/internal/httpx"
	"github.com/kalevski/toolcase/webmail/internal/store"
)

// The platform's admin API (/admin/v1, bearer WEBMAIL_API_TOKEN): it registers
// mail domains by pushing their brandings. It has no cookies and no CSRF; the
// token is the only credential.

const (
	maxAdminBody = 1 << 20
	defaultPage  = 25
	maxPage      = 100
)

func (s *Server) adminAPIRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /admin/v1/health", s.adminAuth(s.handleAdminHealth))
	mux.HandleFunc("GET /admin/v1/brandings", s.adminAuth(s.handleAdminList))
	mux.HandleFunc("POST /admin/v1/brandings", s.adminAuth(s.handleAdminCreate))
	mux.HandleFunc("GET /admin/v1/brandings/{domain}", s.adminAuth(s.handleAdminGet))
	mux.HandleFunc("PUT /admin/v1/brandings/{domain}", s.adminAuth(s.handleAdminUpdate))
	mux.HandleFunc("DELETE /admin/v1/brandings/{domain}", s.adminAuth(s.handleAdminDelete))
}

func (s *Server) tokenOK(r *http.Request) bool {
	h := r.Header.Get("Authorization")
	if len(h) < 8 || !strings.EqualFold(h[:7], "bearer ") {
		return false
	}
	got := sha256.Sum256([]byte(strings.TrimSpace(h[7:])))
	want := sha256.Sum256([]byte(s.cfg.APIToken))
	return subtle.ConstantTimeCompare(got[:], want[:]) == 1
}

// adminAuth wraps a handler: per-address window limit first, then the bearer
// token. Wrong tokens count as failures, so guessing is throttled.
func (s *Server) adminAuth(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		ip := httpx.ClientIP(r, s.cfg.TrustedProxies)
		if d, err := s.apiLim.Hit(ctx, ip); err == nil && !d.Allowed {
			s.rateLimited(w, r, d)
			return
		}
		if d, err := s.apiAuthFail.Check(ctx, ip); err == nil && !d.Allowed {
			s.rateLimited(w, r, d)
			return
		}
		if !s.tokenOK(r) {
			_ = s.apiAuthFail.Fail(ctx, ip)
			w.Header().Set("WWW-Authenticate", `Bearer realm="webmail-admin"`)
			httpx.Error(w, r, http.StatusUnauthorized, "unauthorized", "A valid API token is required.")
			return
		}
		h(w, r)
	}
}

func (s *Server) adminFailed(w http.ResponseWriter, r *http.Request, err error) {
	var fe *branding.FieldError
	switch {
	case errors.As(err, &fe):
		httpx.Error(w, r, http.StatusUnprocessableEntity, "invalid_branding", fe.Error())
	case errors.Is(err, store.ErrNotFound):
		httpx.Error(w, r, http.StatusNotFound, "not_found", "That domain is not registered.")
	case errors.Is(err, store.ErrExists):
		httpx.Error(w, r, http.StatusConflict, "exists", "That domain is already registered.")
	default:
		s.log.Error("admin api", "path", r.URL.Path, "error", err)
		httpx.Error(w, r, http.StatusInternalServerError, "internal", "Something went wrong.")
	}
}

func pathDomain(r *http.Request) (string, error) {
	d := branding.NormalizeDomain(r.PathValue("domain"))
	if !branding.ValidDomain(d) {
		return "", &branding.FieldError{Field: "domain", Msg: "is not a valid domain name"}
	}
	return d, nil
}

func (s *Server) handleAdminHealth(w http.ResponseWriter, r *http.Request) {
	n, err := s.store.CountBrandings(r.Context())
	if err != nil {
		s.adminFailed(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "version": s.build.Version, "domains": n})
}

type brandingPage struct {
	Items      []branding.Admin `json:"items"`
	Total      int              `json:"total"`
	NextCursor string           `json:"nextCursor"`
}

func (s *Server) handleAdminList(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit := defaultPage
	if raw := q.Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n >= 1 && n <= maxPage {
			limit = n
		} else {
			httpx.Error(w, r, http.StatusBadRequest, "bad_request", "limit must be between 1 and 100.")
			return
		}
	}
	after := ""
	if raw := q.Get("cursor"); raw != "" {
		if b, err := base64.RawURLEncoding.DecodeString(raw); err == nil && len(b) <= 253 {
			after = string(b)
		}
	}
	rows, total, err := s.store.ListBrandings(r.Context(), strings.ToLower(strings.TrimSpace(q.Get("q"))), after, limit+1)
	if err != nil {
		s.adminFailed(w, r, err)
		return
	}
	out := brandingPage{Items: []branding.Admin{}, Total: total}
	if len(rows) > limit {
		rows = rows[:limit]
		out.NextCursor = base64.RawURLEncoding.EncodeToString([]byte(rows[limit-1].Domain))
	}
	for _, b := range rows {
		out.Items = append(out.Items, branding.ToAdmin(b))
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (s *Server) handleAdminCreate(w http.ResponseWriter, r *http.Request) {
	var in branding.Input
	if err := httpx.ReadJSON(w, r, maxAdminBody, &in); err != nil {
		httpx.BadJSON(w, r, err)
		return
	}
	b, err := branding.Validate(in, branding.NormalizeDomain(in.Domain))
	if err == nil {
		err = s.store.InsertBranding(r.Context(), b)
	}
	if err != nil {
		s.adminFailed(w, r, err)
		return
	}
	s.hosts.Forget(b.Domain)
	s.adminReply(w, r, http.StatusCreated, b.Domain)
}

func (s *Server) handleAdminGet(w http.ResponseWriter, r *http.Request) {
	d, err := pathDomain(r)
	if err != nil {
		s.adminFailed(w, r, store.ErrNotFound)
		return
	}
	s.adminReply(w, r, http.StatusOK, d)
}

func (s *Server) handleAdminUpdate(w http.ResponseWriter, r *http.Request) {
	d, err := pathDomain(r)
	if err != nil {
		s.adminFailed(w, r, err)
		return
	}
	var in branding.Input
	if err := httpx.ReadJSON(w, r, maxAdminBody, &in); err != nil {
		httpx.BadJSON(w, r, err)
		return
	}
	if in.Domain != "" && branding.NormalizeDomain(in.Domain) != d {
		s.adminFailed(w, r, &branding.FieldError{Field: "domain", Msg: "does not match the address"})
		return
	}
	b, err := branding.Validate(in, d)
	if err == nil {
		err = s.store.UpdateBranding(r.Context(), b)
	}
	if err != nil {
		s.adminFailed(w, r, err)
		return
	}
	s.hosts.Forget(d)
	s.adminReply(w, r, http.StatusOK, d)
}

func (s *Server) adminReply(w http.ResponseWriter, r *http.Request, status int, domain string) {
	b, err := s.store.GetBranding(r.Context(), domain)
	if err != nil {
		s.adminFailed(w, r, err)
		return
	}
	httpx.JSON(w, status, branding.ToAdmin(b))
}

func (s *Server) handleAdminDelete(w http.ResponseWriter, r *http.Request) {
	d, err := pathDomain(r)
	if err == nil {
		err = s.store.DeleteBranding(r.Context(), d)
	}
	if err != nil {
		s.adminFailed(w, r, err)
		return
	}
	s.hosts.Forget(d)
	w.WriteHeader(http.StatusNoContent)
}
