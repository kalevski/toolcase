// Package admin serves the loopback admin surface (spec §6, Q5/Q25):
//
//	GET  /healthz        daemon liveness
//	GET  /status         per-site status JSON
//	POST /sync/<domain>  force an immediate sync (tick-now)
//
// Loopback only by default; an optional bearer token (admin.token_env)
// guards reverse-proxied setups.
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

	"github.com/kalevski/toolcase/nginx-static-server/internal/manager"
)

// Server is the admin HTTP endpoint.
type Server struct {
	mgr   *manager.Manager
	token string
	log   *slog.Logger
}

// New builds the admin server. token may be empty (no auth).
func New(mgr *manager.Manager, token string, log *slog.Logger) *Server {
	return &Server{mgr: mgr, token: token, log: log}
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
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	if err := enc.Encode(map[string]any{"sites": s.mgr.Status()}); err != nil {
		s.log.Warn("status encode failed", "error", err)
	}
}

func (s *Server) handleSync(w http.ResponseWriter, r *http.Request) {
	domain := r.PathValue("domain")
	if !s.mgr.Kick(domain) {
		http.Error(w, "unknown domain", http.StatusNotFound)
		return
	}
	s.log.Info("manual sync triggered", "domain", domain)
	w.WriteHeader(http.StatusAccepted)
	_, _ = w.Write([]byte("sync scheduled\n"))
}
