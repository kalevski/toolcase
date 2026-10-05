// Package server wires webmail together: configuration, SQLite, the platform
// and JMAP clients, sessions, rate limits, the gateway, the SPA, health and
// metrics, and the public and admin listeners (spec §3.2, §3.9).
package server

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"runtime"
	"sync"
	"time"

	"github.com/kalevski/toolcase/webmail/internal/config"
	"github.com/kalevski/toolcase/webmail/internal/gateway"
	"github.com/kalevski/toolcase/webmail/internal/httpx"
	"github.com/kalevski/toolcase/webmail/internal/jmap"
	"github.com/kalevski/toolcase/webmail/internal/obs"
	"github.com/kalevski/toolcase/webmail/internal/platform"
	"github.com/kalevski/toolcase/webmail/internal/ratelimit"
	"github.com/kalevski/toolcase/webmail/internal/session"
	"github.com/kalevski/toolcase/webmail/internal/store"
	"github.com/kalevski/toolcase/webmail/internal/web"
)

// Build identifies the binary.
type Build struct{ Version, Commit string }

// Option tweaks a Server (tests).
type Option func(*Server)

// WithMinFailDelay sets the minimum duration of a failed sign-in response.
func WithMinFailDelay(d time.Duration) Option { return func(s *Server) { s.minFailDelay = d } }

// WithClock replaces the clock used by sessions and rate limits.
func WithClock(now func() time.Time) Option { return func(s *Server) { s.now = now } }

// Server is the running application.
type Server struct {
	cfg   *config.Config
	log   *slog.Logger
	build Build

	store    *store.Store
	platform *platform.Client
	branding *platform.BrandingCache
	jmap     *jmap.Client
	sessions *session.Manager
	gw       *gateway.Gateway

	loginIP     *ratelimit.Failures
	loginAddr   *ratelimit.Failures
	pwdIP       *ratelimit.Failures
	pwdAddr     *ratelimit.Failures
	brandingLim *ratelimit.Window
	inviteLim   *ratelimit.Window

	reg     *obs.Registry
	reqs    *obs.CounterVec
	latency *obs.HistogramVec
	logins  *obs.CounterVec

	pub   *httpx.Server
	admin *httpx.Server

	minFailDelay time.Duration
	now          func() time.Time
	spaBuilt     bool
	closeOnce    sync.Once
}

// New opens the database, builds every component and binds both listeners
// immediately (so address errors surface at boot).
func New(ctx context.Context, cfg *config.Config, log *slog.Logger, build Build, opts ...Option) (*Server, error) {
	s := &Server{cfg: cfg, log: log, build: build, minFailDelay: 400 * time.Millisecond}
	for _, o := range opts {
		o(s)
	}
	st, err := store.Open(ctx, cfg.DataDir, store.Options{Now: s.now})
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	s.store = st
	s.platform = platform.New(cfg.PlatformURL, cfg.PlatformToken, cfg.UpstreamTimeout)
	s.branding = &platform.BrandingCache{Source: s.platform, TTL: cfg.BrandingTTL, Now: s.now}
	s.jmap = jmap.New(cfg.JMAPURL, cfg.UpstreamTimeout)
	s.sessions = &session.Manager{
		Store: st, Key: cfg.SessionKey, PublicURL: cfg.PublicURL, Now: s.now, Revoker: s.platform, Log: log,
		Settings: session.Settings{Idle: cfg.SessionIdle, RememberIdle: cfg.RememberIdle, Max: cfg.SessionMax},
	}
	const window = 15 * time.Minute
	s.loginIP = &ratelimit.Failures{Store: st, Bucket: "login_ip", Limit: cfg.IPFailLimit, Window: window, FreeFailures: 5, Now: s.now}
	s.loginAddr = &ratelimit.Failures{Store: st, Bucket: "login_addr", Limit: cfg.AddressFailLimit, Window: window, FreeFailures: 2, Now: s.now}
	s.pwdIP = &ratelimit.Failures{Store: st, Bucket: "pwd_ip", Limit: cfg.IPFailLimit, Window: window, FreeFailures: 5, Now: s.now}
	s.pwdAddr = &ratelimit.Failures{Store: st, Bucket: "pwd_addr", Limit: cfg.AddressFailLimit, Window: window, FreeFailures: 2, Now: s.now}
	s.brandingLim = &ratelimit.Window{Store: st, Bucket: "branding", Limit: 60, Span: time.Minute, Now: s.now}
	s.inviteLim = &ratelimit.Window{Store: st, Bucket: "invite", Limit: 10, Span: time.Minute, Now: s.now}

	s.reg = obs.NewRegistry()
	s.reqs = s.reg.Counter("webmail_http_requests_total", "HTTP requests by route and status.", "route", "status")
	s.latency = s.reg.Histogram("webmail_http_request_duration_seconds", "HTTP request latency.", nil, "route")
	s.logins = s.reg.Counter("webmail_logins_total", "Sign-in attempts by result.", "result")
	upstream := s.reg.Counter("webmail_upstream_requests_total", "Gateway calls to the mail server by operation and result.", "op", "result")
	s.reg.GaugeFunc("webmail_sessions", "Stored sessions.", nil, func() []obs.Sample {
		n, _ := st.CountSessions(context.Background())
		return []obs.Sample{{Value: float64(n)}}
	})
	s.reg.GaugeFunc("webmail_build_info", "Build information.", []string{"version", "commit", "go"}, func() []obs.Sample {
		return []obs.Sample{{Labels: []string{build.Version, build.Commit, runtime.Version()}, Value: 1}}
	})

	s.gw = &gateway.Gateway{
		Sessions: s.sessions, JMAP: s.jmap, Store: st, Branding: s.branding,
		MaxUploadBytes: cfg.MaxUploadBytes(), Trusted: cfg.TrustedProxies, Log: log, Now: s.now, Upstream: upstream,
	}

	files, built := web.Assets()
	s.spaBuilt = built
	if !built {
		log.Warn("no web app embedded: serving the placeholder page (build webmail/web, then rebuild the binary)")
	}
	wrapOpts := httpx.Options{
		Log: log, Trusted: cfg.TrustedProxies,
		Quiet: func(r *http.Request) bool { return r.URL.Path == "/_healthz" },
		OnDone: func(i *httpx.Info, d time.Duration) {
			route := i.Route
			if route == "" {
				route = "unmatched"
			}
			s.reqs.Inc(route, fmt.Sprint(i.Status))
			s.latency.Observe(d.Seconds(), route)
		},
	}
	s.pub, err = httpx.NewServer(httpx.ServerConfig{
		Name: "public", Addr: cfg.Listen, Log: log,
		Handler: httpx.Wrap(securityHeaders(s.routes(files), cfg.Secure()), wrapOpts),
	})
	if err != nil {
		st.Close()
		return nil, fmt.Errorf("listen %s: %w", cfg.Listen, err)
	}
	s.admin, err = httpx.NewServer(httpx.ServerConfig{Name: "admin", Addr: cfg.AdminListen, Log: log, Handler: s.adminRoutes()})
	if err != nil {
		s.pub.Close()
		st.Close()
		return nil, fmt.Errorf("listen %s: %w", cfg.AdminListen, err)
	}
	return s, nil
}

// Addr is the public listener's address (tests use :0).
func (s *Server) Addr() string { return s.pub.Addr().String() }

// AdminAddr is the admin listener's address.
func (s *Server) AdminAddr() string { return s.admin.Addr().String() }

func (s *Server) routes(files fs.FS) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /_healthz", s.handleHealth)
	mux.HandleFunc("GET /_version", s.handleVersion)
	mux.HandleFunc("GET /api/branding", s.handleBranding)
	mux.HandleFunc("GET /api/logo", s.handleLogo)
	mux.HandleFunc("POST /api/login", s.handleLogin)
	mux.HandleFunc("POST /api/logout", s.handleLogout)
	mux.HandleFunc("POST /api/invite", s.handleInvite)
	mux.HandleFunc("GET /api/sessions", s.sessions.Require(s.handleListSessions))
	mux.HandleFunc("DELETE /api/sessions/{id}", s.sessions.Require(s.handleEndSession))
	mux.HandleFunc("POST /api/password", s.sessions.Require(s.handlePassword))
	s.gw.Routes(mux)
	mux.Handle("/", spaHandler(files))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mux.ServeHTTP(w, r)
		httpx.From(r.Context()).Route = r.Pattern
	})
}

func (s *Server) adminRoutes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /_metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		_, _ = s.reg.WriteTo(w)
	})
	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	if err := s.store.Ping(ctx); err != nil {
		httpx.JSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleVersion(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, http.StatusOK, map[string]any{
		"name": "webmail", "version": s.build.Version, "commit": s.build.Commit, "go": runtime.Version(),
		"schema": store.SchemaVersion(), "webApp": s.spaBuilt,
	})
}

// Run serves until ctx ends, then drains.
func (s *Server) Run(ctx context.Context) error {
	errc := make(chan error, 2)
	go func() { errc <- s.pub.Serve() }()
	go func() { errc <- s.admin.Serve() }()
	go s.reaper(ctx)
	s.log.Info("listening", "public", s.pub.Addr().String(), "admin", s.admin.Addr().String(), "web_app", s.spaBuilt)

	var runErr error
	select {
	case <-ctx.Done():
	case runErr = <-errc:
	}
	sctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	_ = s.pub.Shutdown(sctx)
	_ = s.admin.Shutdown(sctx)
	s.Close()
	if runErr != nil && !errors.Is(runErr, http.ErrServerClosed) {
		return runErr
	}
	return nil
}

// Close releases the database after background revocations finish.
func (s *Server) Close() {
	s.closeOnce.Do(func() {
		s.sessions.Wait()
		_ = s.pub.Close()
		_ = s.admin.Close()
		_ = s.store.Close()
	})
}

// reaper ends expired sessions (revoking their platform credentials) and
// sweeps old rate-limit counters.
func (s *Server) reaper(ctx context.Context) {
	t := time.NewTicker(time.Minute)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			s.Reap(ctx)
		}
	}
}

// Reap runs one sweep.
func (s *Server) Reap(ctx context.Context) {
	dead, err := s.sessions.Reap(ctx)
	if err != nil {
		s.log.Error("reap sessions", "error", err)
	}
	for _, d := range dead {
		s.gw.Forget(d.ID)
		s.sessions.Revoke(d)
	}
	if len(dead) > 0 {
		s.log.Info("expired sessions ended", "count", len(dead))
	}
	if err := s.store.RLSweep(ctx, s.clock().Add(-time.Hour)); err != nil {
		s.log.Error("sweep rate limits", "error", err)
	}
}

func (s *Server) clock() time.Time {
	if s.now != nil {
		return s.now()
	}
	return time.Now()
}
