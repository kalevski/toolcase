package admin

import (
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/manager"
	"github.com/kalevski/toolcase/nginxpilot/internal/state"
)

func newTestServer(t *testing.T, cfg *config.Config) http.Handler {
	t.Helper()
	return newTestServerReload(t, cfg, func() error { return nil })
}

func newTestServerReload(t *testing.T, cfg *config.Config, reload func() error) http.Handler {
	t.Helper()
	cfg.DataDir = t.TempDir()
	store, err := state.NewStore(cfg.DataDir)
	if err != nil {
		t.Fatalf("state store: %v", err)
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	mgr := manager.New(cfg, store, log)
	return New(mgr, "", log, reload).routes()
}

func TestVhostEndpointProxy(t *testing.T) {
	cfg := &config.Config{
		Proxies: []config.Proxy{{Domain: "api.example.com", Pass: "http://127.0.0.1:9000"}},
	}
	h := newTestServer(t, cfg)

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/vhost/api.example.com", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "text/plain; charset=utf-8" {
		t.Errorf("want text/plain, got %q", ct)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "proxy_pass http://127.0.0.1:9000;") || !strings.Contains(body, "server_name api.example.com;") {
		t.Errorf("unexpected body:\n%s", body)
	}
}

func TestVhostEndpointUnknownDomain404(t *testing.T) {
	h := newTestServer(t, &config.Config{})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/vhost/nope.example.com", nil))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("want 404, got %d", rec.Code)
	}
}

// A proxy domain is configured but has no content to sync — the caller must
// get a precise 400, not a misleading "unknown domain" 404 for a domain it can
// see via /vhost.
func TestSyncEndpointProxyIsBadRequest(t *testing.T) {
	cfg := &config.Config{
		Proxies: []config.Proxy{{Domain: "api.example.com", Pass: "http://127.0.0.1:9000"}},
	}
	h := newTestServer(t, cfg)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/sync/api.example.com", nil))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for a proxy domain, got %d (%s)", rec.Code, rec.Body.String())
	}
}

func TestSyncEndpointUnknownDomain404(t *testing.T) {
	h := newTestServer(t, &config.Config{})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/sync/nope.example.com", nil))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("want 404, got %d", rec.Code)
	}
}

// A successful reload returns 200 and invokes the injected reload (the same work
// SIGHUP triggers).
func TestReloadEndpointOK(t *testing.T) {
	called := false
	h := newTestServerReload(t, &config.Config{}, func() error {
		called = true
		return nil
	})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/reload", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	if !called {
		t.Fatal("reload was not invoked")
	}
	if !strings.Contains(rec.Body.String(), "reloaded") {
		t.Errorf("unexpected body: %q", rec.Body.String())
	}
}

// An invalid on-disk config is rejected wholesale: the running config stays
// active and the caller gets a 500 rather than a silent success.
func TestReloadEndpointRejectedConfigIs500(t *testing.T) {
	h := newTestServerReload(t, &config.Config{}, func() error {
		return errors.New("invalid config")
	})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/reload", nil))
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("want 500, got %d (%s)", rec.Code, rec.Body.String())
	}
}

// GET is not allowed on the reload endpoint — it is a state-changing POST.
func TestReloadEndpointRejectsGet(t *testing.T) {
	h := newTestServer(t, &config.Config{})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/reload", nil))
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("want 405, got %d", rec.Code)
	}
}
