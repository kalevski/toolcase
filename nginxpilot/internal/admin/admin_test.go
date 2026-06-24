package admin

import (
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
	cfg.DataDir = t.TempDir()
	store, err := state.NewStore(cfg.DataDir)
	if err != nil {
		t.Fatalf("state store: %v", err)
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	mgr := manager.New(cfg, store, log)
	return New(mgr, "", log).routes()
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
