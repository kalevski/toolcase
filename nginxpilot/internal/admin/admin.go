// Package admin serves the loopback admin surface (spec §6, Q5/Q25):
//
//	GET  /healthz             daemon liveness
//	GET  /status              per-site runtime status JSON
//	POST /sync/<domain>       force an immediate sync (tick-now)
//	GET  /vhost/<domain>      generated nginx config for a site or reverse proxy
//	POST /reload              diff-based config reload (same as SIGHUP)
//
// Config management — a control plane (Quaykeeper) drives the whole config over
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
//	GET    /certs/bundle/{domain}  export one cert with its chain and private key
//	POST   /certs/{domain}/revoke  revoke a certbot-issued cert at its CA (optionally delete it)
//
// Each write/delete validates the candidate merged config before touching disk,
// so an invalid fragment never lands in sites.d/ and the running config is the
// last known-good. Loopback only by default; an optional bearer token
// (admin.token_env / admin.token_file) guards the TCP listener. The same routes
// are also served on a local Unix socket (admin.socket) with no token, which is
// what the in-container CLI uses.
package admin

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/admintoken"
	"github.com/kalevski/toolcase/nginxpilot/internal/manager"
	"github.com/kalevski/toolcase/nginxpilot/internal/nginxconf"
	"github.com/kalevski/toolcase/nginxpilot/internal/nginxctl"
)

// Server is the admin HTTP endpoint.
type Server struct {
	mgr    *manager.Manager
	token  admintoken.Hash
	log    *slog.Logger
	reload func() error
	// jobs tracks async certbot issuances (POST /certs runs off the request path).
	jobs *certJobStore
	// Version is reported on GET /status so a control plane can show it.
	Version string
}

// New builds the admin server. token is the stored hash; it may be nil only when
// no auth is configured (neither admin.token_env nor admin.token_file is set).
// Callers must not pass nil when a token was expected — admintoken.Resolve
// enforces that invariant before the server is constructed.
//
// reload performs a diff-based config reload — the same work SIGHUP triggers —
// and reports an error when the on-disk config fails to load/validate (in which
// case the running config is kept). It may be nil, which disables POST /reload.
func New(mgr *manager.Manager, token admintoken.Hash, log *slog.Logger, reload func() error) *Server {
	s := &Server{mgr: mgr, token: token, log: log, reload: reload, jobs: newCertJobStore()}
	if dataDir := mgr.Config().DataDir; dataDir != "" {
		s.jobs = openCertJobStore(filepath.Join(dataDir, "acme", "jobs.json"), log, s.certInfoFor)
	}
	return s
}

// Run serves until ctx is cancelled. An empty listen address disables the TCP
// endpoint; an empty socket path disables the Unix socket. A socket that cannot
// be created is logged and skipped rather than taking the daemon down.
func (s *Server) Run(ctx context.Context, listen, socket string) error {
	errCh := make(chan error, 2)
	var servers []*http.Server

	if listen == "" {
		s.log.Info("admin endpoint disabled")
	} else {
		srv := &http.Server{Addr: listen, Handler: s.routes(true), ReadHeaderTimeout: 5 * time.Second}
		servers = append(servers, srv)
		go func() { errCh <- srv.ListenAndServe() }()
		s.log.Info("admin endpoint listening", "addr", listen)
	}

	if socket != "" {
		ln, err := listenSocket(socket)
		if err != nil {
			s.log.Warn("admin socket unavailable; the local CLI cannot reach the daemon", "socket", socket, "error", err)
		} else {
			srv := &http.Server{Handler: s.routes(false), ReadHeaderTimeout: 5 * time.Second}
			servers = append(servers, srv)
			go func() { errCh <- srv.Serve(ln) }()
			s.log.Info("admin socket listening", "socket", socket)
			defer os.Remove(socket)
		}
	}

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		for _, srv := range servers {
			_ = srv.Shutdown(shutdownCtx)
		}
		return nil
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}

// listenSocket binds the admin Unix socket: a stale file from a previous run is
// removed, the directory is created 0750 and the socket itself chmod'ed 0600,
// so only the daemon user (and root) can connect.
func listenSocket(path string) (net.Listener, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return nil, err
	}
	if info, err := os.Lstat(path); err == nil && info.Mode()&os.ModeSocket != 0 {
		_ = os.Remove(path)
	}
	ln, err := net.Listen("unix", path)
	if err != nil {
		return nil, err
	}
	if err := os.Chmod(path, 0o600); err != nil {
		ln.Close()
		return nil, err
	}
	return ln, nil
}

// endpoint is one admin route. The table below is the single source of truth
// for the surface: routes() registers it, GET /schema documents it, and a test
// asserts the two can never drift (every endpoint must carry schema docs).
type endpoint struct {
	method  string
	pattern string // net/http pattern, {param} placeholders included
	auth    bool
	handler func(s *Server) http.HandlerFunc
}

// endpoints returns the full admin surface in registration order.
func endpoints() []endpoint {
	return []endpoint{
		{"GET", "/healthz", false, func(s *Server) http.HandlerFunc { return s.handleHealthz }},
		{"GET", "/schema", false, func(s *Server) http.HandlerFunc { return s.handleSchema }},
		{"GET", "/status", true, func(s *Server) http.HandlerFunc { return s.handleStatus }},
		{"POST", "/sync/{domain}", true, func(s *Server) http.HandlerFunc { return s.handleSync }},
		{"GET", "/vhost/{domain}", true, func(s *Server) http.HandlerFunc { return s.handleVhost }},
		{"POST", "/reload", true, func(s *Server) http.HandlerFunc { return s.handleReload }},
		{"GET", "/sites", true, func(s *Server) http.HandlerFunc { return s.handleListSites }},
		{"POST", "/sites", true, func(s *Server) http.HandlerFunc { return s.handleCreateSite }},
		{"DELETE", "/sites/{domain}", true, func(s *Server) http.HandlerFunc { return s.handleDeleteSite }},
		{"GET", "/apps", true, func(s *Server) http.HandlerFunc { return s.handleListApps }},
		{"POST", "/apps", true, func(s *Server) http.HandlerFunc { return s.handleCreateApp }},
		{"DELETE", "/apps/{domain}", true, func(s *Server) http.HandlerFunc { return s.handleDeleteApp }},
		{"DELETE", "/apps/{domain}/data", true, func(s *Server) http.HandlerFunc { return s.handleDeleteAppData }},
		{"GET", "/upstreams", true, func(s *Server) http.HandlerFunc { return s.handleListUpstreams }},
		{"POST", "/upstreams", true, func(s *Server) http.HandlerFunc { return s.handleCreateUpstream }},
		{"DELETE", "/upstreams/{name}", true, func(s *Server) http.HandlerFunc { return s.handleDeleteUpstream }},
		{"GET", "/proxies", true, func(s *Server) http.HandlerFunc { return s.handleListProxies }},
		{"POST", "/proxies", true, func(s *Server) http.HandlerFunc { return s.handleCreateProxy }},
		{"DELETE", "/proxies/{domain}", true, func(s *Server) http.HandlerFunc { return s.handleDeleteProxy }},
		{"GET", "/redirects", true, func(s *Server) http.HandlerFunc { return s.handleListRedirects }},
		{"POST", "/redirects", true, func(s *Server) http.HandlerFunc { return s.handleCreateRedirect }},
		{"DELETE", "/redirects/{domain}", true, func(s *Server) http.HandlerFunc { return s.handleDeleteRedirect }},
		{"GET", "/dead-hosts", true, func(s *Server) http.HandlerFunc { return s.handleListDeadHosts }},
		{"POST", "/dead-hosts", true, func(s *Server) http.HandlerFunc { return s.handleCreateDeadHost }},
		{"DELETE", "/dead-hosts/{domain}", true, func(s *Server) http.HandlerFunc { return s.handleDeleteDeadHost }},
		{"GET", "/access-lists", true, func(s *Server) http.HandlerFunc { return s.handleListAccessLists }},
		{"POST", "/access-lists", true, func(s *Server) http.HandlerFunc { return s.handleCreateAccessList }},
		{"DELETE", "/access-lists/{name}", true, func(s *Server) http.HandlerFunc { return s.handleDeleteAccessList }},
		{"PUT", "/access-lists/{name}/users/{username}", true, func(s *Server) http.HandlerFunc { return s.handleSetAccessListUser }},
		{"GET", "/streams", true, func(s *Server) http.HandlerFunc { return s.handleListStreams }},
		{"POST", "/streams", true, func(s *Server) http.HandlerFunc { return s.handleCreateStream }},
		{"DELETE", "/streams/{name}", true, func(s *Server) http.HandlerFunc { return s.handleDeleteStream }},
		{"GET", "/stream-upstreams", true, func(s *Server) http.HandlerFunc { return s.handleListStreamUpstreams }},
		{"POST", "/stream-upstreams", true, func(s *Server) http.HandlerFunc { return s.handleCreateStreamUpstream }},
		{"DELETE", "/stream-upstreams/{name}", true, func(s *Server) http.HandlerFunc { return s.handleDeleteStreamUpstream }},
		{"GET", "/log-destinations", true, func(s *Server) http.HandlerFunc { return s.handleListLogDests }},
		{"POST", "/log-destinations", true, func(s *Server) http.HandlerFunc { return s.handleCreateLogDest }},
		{"DELETE", "/log-destinations/{name}", true, func(s *Server) http.HandlerFunc { return s.handleDeleteLogDest }},
		{"POST", "/log-destinations/test", true, func(s *Server) http.HandlerFunc { return s.handleTestLogDest }},
		{"POST", "/log-destinations/{name}/test", true, func(s *Server) http.HandlerFunc { return s.handleTestSavedLogDest }},
		{"GET", "/logs/status", true, func(s *Server) http.HandlerFunc { return s.handleLogsStatus }},
		{"POST", "/nginx/test", true, func(s *Server) http.HandlerFunc { return s.handleNginxTest }},
		{"GET", "/certs", true, func(s *Server) http.HandlerFunc { return s.handleListCerts }},
		{"POST", "/certs", true, func(s *Server) http.HandlerFunc { return s.handleIssueCert }},
		{"GET", "/certs/jobs", true, func(s *Server) http.HandlerFunc { return s.handleListCertJobs }},
		{"GET", "/certs/jobs/{id}", true, func(s *Server) http.HandlerFunc { return s.handleCertJob }},
		{"GET", "/certs/bundle/{domain}", true, func(s *Server) http.HandlerFunc { return s.handleCertBundle }},
		{"PUT", "/certs/{domain}", true, func(s *Server) http.HandlerFunc { return s.handleUploadCert }},
		{"POST", "/certs/renew", true, func(s *Server) http.HandlerFunc { return s.handleRenewDue }},
		{"POST", "/certs/{domain}/renew", true, func(s *Server) http.HandlerFunc { return s.handleRenewCert }},
		{"POST", "/certs/{domain}/revoke", true, func(s *Server) http.HandlerFunc { return s.handleRevokeCert }},
		{"DELETE", "/certs/{domain}", true, func(s *Server) http.HandlerFunc { return s.handleDeleteCert }},
		{"GET", "/acme/credentials", true, func(s *Server) http.HandlerFunc { return s.handleListCreds }},
		{"PUT", "/acme/credentials/{provider}", true, func(s *Server) http.HandlerFunc { return s.handleSetCreds }},
		{"PUT", "/acme/credentials/{provider}/{account}", true, func(s *Server) http.HandlerFunc { return s.handleSetCreds }},
		{"DELETE", "/acme/credentials/{provider}", true, func(s *Server) http.HandlerFunc { return s.handleDeleteCreds }},
		{"DELETE", "/acme/credentials/{provider}/{account}", true, func(s *Server) http.HandlerFunc { return s.handleDeleteCreds }},
		{"GET", "/git-credentials", true, func(s *Server) http.HandlerFunc { return s.handleListGitCreds }},
		{"PUT", "/git-credentials/{name}", true, func(s *Server) http.HandlerFunc { return s.handleSetGitCred }},
		{"DELETE", "/git-credentials/{name}", true, func(s *Server) http.HandlerFunc { return s.handleDeleteGitCred }},
	}
}

func (s *Server) handleHealthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("ok\n"))
}

// routes builds the mux. authenticated is false only for the Unix socket,
// which never asks for the token.
func (s *Server) routes(authenticated bool) http.Handler {
	mux := http.NewServeMux()
	for _, e := range endpoints() {
		handler := e.handler(s)
		if e.auth && authenticated {
			handler = s.auth(handler)
		}
		mux.HandleFunc(e.method+" "+e.pattern, handler)
	}
	return mux
}

// auth enforces the optional bearer token against its stored hash.
func (s *Server) auth(next http.HandlerFunc) http.HandlerFunc {
	if s.token == nil {
		return next
	}
	return func(w http.ResponseWriter, r *http.Request) {
		got := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !s.token.Matches(got) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

func (s *Server) handleStatus(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	payload := map[string]any{"sites": s.mgr.Status(), "version": s.Version}
	// Managed mode: surface the last apply's per-resource states (active /
	// disabled / at_risk with the nginx -t or pre-flight reason) so a control
	// plane sees quarantined and at-risk resources.
	if managed, resources := s.mgr.NginxStatus(); managed {
		disabled, atRisk := 0, 0
		for _, r := range resources {
			switch r.State {
			case nginxctl.StateDisabled:
				disabled++
			case nginxctl.StateAtRisk:
				atRisk++
			}
		}
		if resources == nil {
			resources = []nginxctl.ResourceResult{}
		}
		payload["nginx"] = map[string]any{
			"managed":        true,
			"resources":      resources,
			"disabled_count": disabled,
			"at_risk_count":  atRisk,
			"reconcile":      s.mgr.ReconcileStatus(),
			"real_ip":        s.mgr.RealIPStatus(),
		}
	}
	// Renewal scheduler summary (present whether or not acme is enabled, so a
	// control plane can tell "disabled" from "missing").
	renewal := s.mgr.RenewalStatus()
	certsRenewal := map[string]any{
		"enabled":        renewal.Enabled,
		"check_interval": renewal.CheckInterval.String(),
		"renew_before":   renewal.RenewBefore.String(),
	}
	if !renewal.NextCheck.IsZero() {
		certsRenewal["next_check"] = renewal.NextCheck
	}
	payload["certs_renewal"] = certsRenewal
	payload["acme"] = s.mgr.AcmeStatus()

	// Log shipping stats (per-destination shipped/dropped/last_error plus
	// intake health) — same spirit as per-site sync state.
	payload["logs"] = s.mgr.LogsStatus()

	// PHP runtime + per-app pool health. Present whether or not php is enabled,
	// so a control plane can tell "this realm cannot serve php" from "this realm
	// is an older nginxpilot that does not report it".
	payload["php"] = s.mgr.PHPStatus()

	// Capabilities of this build a control plane gates on before sending a
	// field an older nginxpilot would reject as unknown (strict decoding).
	// proxy_resolve: proxies and locations accept resolve (per-request DNS).
	payload["features"] = map[string]any{"proxy_resolve": true}

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
	// Not a managed site. Distinguish a configured reverse proxy / redirect /
	// dead host (none of which have content to sync) from a genuinely unknown
	// domain so the caller isn't told a domain it can see in /vhost is "unknown".
	cfg := s.mgr.Config()
	for i := range cfg.Proxies {
		if cfg.Proxies[i].Domain == domain {
			http.Error(w, "domain is a reverse proxy, not a synced site", http.StatusBadRequest)
			return
		}
	}
	for i := range cfg.Redirects {
		if cfg.Redirects[i].Domain == domain {
			http.Error(w, "domain is a redirect, not a synced site", http.StatusBadRequest)
			return
		}
	}
	for i := range cfg.DeadHosts {
		if cfg.DeadHosts[i].Domain == domain {
			http.Error(w, "domain is a dead host (parked), not a synced site", http.StatusBadRequest)
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
// so a separate process (e.g. Quaykeeper) can apply config changes without signalling
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
