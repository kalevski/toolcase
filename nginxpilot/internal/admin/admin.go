// Package admin serves the loopback admin surface (spec §6, Q5/Q25):
//
//	GET  /healthz             daemon liveness
//	GET  /status              per-site runtime status JSON
//	POST /sync/<domain>       force an immediate sync (tick-now)
//	GET  /vhost/<domain>      generated nginx config for a site or reverse proxy
//	POST /reload              diff-based config reload (same as SIGHUP)
//
// Config management — a control plane (Perch) drives the whole config over
// REST instead of writing fragment files into sites.d/ by hand:
//
//	GET    /sites             list configured sites
//	POST   /sites             write a site fragment and reload
//	DELETE /sites/{domain}    remove a site's fragment and reload
//	GET    /upstreams         list configured upstreams
//	POST   /upstreams         write an upstream fragment and reload
//	DELETE /upstreams/{name}  remove an upstream's fragment and reload
//	GET    /proxies           list configured reverse proxies
//	POST   /proxies           write a proxy fragment and reload
//	DELETE /proxies/{domain}  remove a proxy's fragment and reload
//	GET    /certs             list TLS certs discovered in the cert dir (read-only)
//
// Each write/delete validates the candidate merged config before touching disk,
// so an invalid fragment never lands in sites.d/ and the running config is the
// last known-good. Loopback only by default; an optional bearer token
// (admin.token_env) guards reverse-proxied setups.
package admin

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/manager"
	"github.com/kalevski/toolcase/nginxpilot/internal/nginxconf"
	"github.com/kalevski/toolcase/nginxpilot/internal/nginxctl"
)

// Server is the admin HTTP endpoint.
type Server struct {
	mgr    *manager.Manager
	token  string
	log    *slog.Logger
	reload func() error
	// jobs tracks async certbot issuances (POST /certs runs off the request path).
	jobs *certJobStore
}

// New builds the admin server. token may be empty only when no auth is
// configured (admin.token_env is unset). Callers must not pass an empty token
// when a token was expected — use resolveAdminToken in cmd/nginxpilot/run.go
// to enforce that invariant before constructing the server.
//
// reload performs a diff-based config reload — the same work SIGHUP triggers —
// and reports an error when the on-disk config fails to load/validate (in which
// case the running config is kept). It may be nil, which disables POST /reload.
func New(mgr *manager.Manager, token string, log *slog.Logger, reload func() error) *Server {
	return &Server{mgr: mgr, token: token, log: log, reload: reload, jobs: newCertJobStore()}
}

// Run serves until ctx is cancelled. An empty listen address disables the
// endpoint entirely.
func (s *Server) Run(ctx context.Context, listen string) error {
	if listen == "" {
		s.log.Info("admin endpoint disabled")
		<-ctx.Done()
		return nil
	}
	srv := &http.Server{
		Addr:              listen,
		Handler:           s.routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}
	errCh := make(chan error, 1)
	go func() {
		errCh <- srv.ListenAndServe()
	}()
	s.log.Info("admin endpoint listening", "addr", listen)
	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
		return nil
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}

func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = w.Write([]byte("ok\n"))
	})
	mux.HandleFunc("GET /status", s.auth(s.handleStatus))
	mux.HandleFunc("POST /sync/{domain}", s.auth(s.handleSync))
	mux.HandleFunc("GET /vhost/{domain}", s.auth(s.handleVhost))
	mux.HandleFunc("POST /reload", s.auth(s.handleReload))
	mux.HandleFunc("GET /sites", s.auth(s.handleListSites))
	mux.HandleFunc("POST /sites", s.auth(s.handleCreateSite))
	mux.HandleFunc("DELETE /sites/{domain}", s.auth(s.handleDeleteSite))
	mux.HandleFunc("GET /upstreams", s.auth(s.handleListUpstreams))
	mux.HandleFunc("POST /upstreams", s.auth(s.handleCreateUpstream))
	mux.HandleFunc("DELETE /upstreams/{name}", s.auth(s.handleDeleteUpstream))
	mux.HandleFunc("GET /proxies", s.auth(s.handleListProxies))
	mux.HandleFunc("POST /proxies", s.auth(s.handleCreateProxy))
	mux.HandleFunc("DELETE /proxies/{domain}", s.auth(s.handleDeleteProxy))
	mux.HandleFunc("GET /streams", s.auth(s.handleListStreams))
	mux.HandleFunc("POST /streams", s.auth(s.handleCreateStream))
	mux.HandleFunc("DELETE /streams/{name}", s.auth(s.handleDeleteStream))
	mux.HandleFunc("GET /stream-upstreams", s.auth(s.handleListStreamUpstreams))
	mux.HandleFunc("POST /stream-upstreams", s.auth(s.handleCreateStreamUpstream))
	mux.HandleFunc("DELETE /stream-upstreams/{name}", s.auth(s.handleDeleteStreamUpstream))
	mux.HandleFunc("POST /nginx/test", s.auth(s.handleNginxTest))
	mux.HandleFunc("GET /certs", s.auth(s.handleListCerts))
	mux.HandleFunc("POST /certs", s.auth(s.handleIssueCert))
	mux.HandleFunc("GET /certs/jobs", s.auth(s.handleListCertJobs))
	mux.HandleFunc("GET /certs/jobs/{id}", s.auth(s.handleCertJob))
	mux.HandleFunc("PUT /certs/{domain}", s.auth(s.handleUploadCert))
	mux.HandleFunc("POST /certs/renew", s.auth(s.handleRenewDue))
	mux.HandleFunc("POST /certs/{domain}/renew", s.auth(s.handleRenewCert))
	mux.HandleFunc("DELETE /certs/{domain}", s.auth(s.handleDeleteCert))
	mux.HandleFunc("GET /acme/credentials", s.auth(s.handleListCreds))
	mux.HandleFunc("PUT /acme/credentials/{provider}", s.auth(s.handleSetCreds))
	mux.HandleFunc("DELETE /acme/credentials/{provider}", s.auth(s.handleDeleteCreds))
	return mux
}

// auth enforces the optional bearer token (admin.token_env).
func (s *Server) auth(next http.HandlerFunc) http.HandlerFunc {
	if s.token == "" {
		return next
	}
	return func(w http.ResponseWriter, r *http.Request) {
		got := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if subtle.ConstantTimeCompare([]byte(got), []byte(s.token)) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

func (s *Server) handleStatus(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	payload := map[string]any{"sites": s.mgr.Status()}
	// Managed mode: surface the last apply's per-resource states (active /
	// disabled with the nginx -t reason) so a control plane sees quarantined
	// resources.
	if managed, resources := s.mgr.NginxStatus(); managed {
		disabled := 0
		for _, r := range resources {
			if r.State == "disabled" {
				disabled++
			}
		}
		if resources == nil {
			resources = []nginxctl.ResourceResult{}
		}
		payload["nginx"] = map[string]any{
			"managed":        true,
			"resources":      resources,
			"disabled_count": disabled,
		}
	}
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	if err := enc.Encode(payload); err != nil {
		s.log.Warn("status encode failed", "error", err)
	}
}

// handleNginxTest runs a managed-mode dry-run apply (render + validate, no
// swap/reload) and returns the per-resource pass/fail set, so a control plane
// can preview before committing. 501 when managed mode is off.
func (s *Server) handleNginxTest(w http.ResponseWriter, r *http.Request) {
	res, managed, err := s.mgr.NginxTest(r.Context())
	if !managed {
		http.Error(w, "managed mode is off (nginx.manage: false)", http.StatusNotImplemented)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	out := map[string]any{"resources": res.Resources}
	if err != nil {
		out["error"] = err.Error()
	}
	if err := enc.Encode(out); err != nil {
		s.log.Warn("nginx test encode failed", "error", err)
	}
}

func (s *Server) handleSync(w http.ResponseWriter, r *http.Request) {
	domain := r.PathValue("domain")
	if s.mgr.Kick(domain) {
		s.log.Info("manual sync triggered", "domain", domain)
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte("sync scheduled\n"))
		return
	}
	// Not a managed site. Distinguish a configured reverse proxy (which has no
	// content to sync) from a genuinely unknown domain so the caller isn't told
	// a domain it can see in /vhost is "unknown".
	cfg := s.mgr.Config()
	for i := range cfg.Proxies {
		if cfg.Proxies[i].Domain == domain {
			http.Error(w, "domain is a reverse proxy, not a synced site", http.StatusBadRequest)
			return
		}
	}
	http.Error(w, "unknown domain", http.StatusNotFound)
}

// handleVhost renders the nginx config for a site or reverse proxy. The
// daemon only generates text here — it never writes nginx config or reloads.
func (s *Server) handleVhost(w http.ResponseWriter, r *http.Request) {
	domain := r.PathValue("domain")
	out, err := nginxconf.Vhost(s.mgr.Config(), domain)
	if err != nil {
		if errors.Is(err, nginxconf.ErrUnknownDomain) {
			http.Error(w, "unknown domain", http.StatusNotFound)
			return
		}
		s.log.Warn("vhost generation failed", "domain", domain, "error", err)
		http.Error(w, "vhost generation failed", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte(out))
}

// handleReload runs a diff-based config reload — the REST equivalent of SIGHUP —
// so a separate process (e.g. Perch) can apply config changes without signalling
// the daemon directly. An invalid on-disk config is rejected wholesale and the
// running config stays active (spec §6).
func (s *Server) handleReload(w http.ResponseWriter, _ *http.Request) {
	if s.reload == nil {
		http.Error(w, "reload not available", http.StatusNotImplemented)
		return
	}
	if err := s.reload(); err != nil {
		http.Error(w, "reload rejected; running config kept", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("reloaded\n"))
}
