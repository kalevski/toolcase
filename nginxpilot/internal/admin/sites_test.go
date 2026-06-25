package admin

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/manager"
	"github.com/kalevski/toolcase/nginxpilot/internal/state"
)

// sitesEnv wires an admin handler whose config has a real sites.d/ include so
// POST/DELETE /sites can write and remove fragment files on a temp dir.
type sitesEnv struct {
	h         http.Handler
	sitesDir  string
	reloads   *int
	reloadErr *error
}

func newSitesEnv(t *testing.T, token string, seed ...config.Site) sitesEnv {
	t.Helper()
	root := t.TempDir()
	sitesDir := filepath.Join(root, "sites.d")
	if err := os.MkdirAll(sitesDir, 0o750); err != nil {
		t.Fatalf("mkdir sites.d: %v", err)
	}
	cfg := &config.Config{
		Path:     filepath.Join(root, "config.yml"),
		Include:  []string{"sites.d/*.yml"},
		LogLevel: "info",
		Defaults: config.Defaults{KeepReleases: 3},
		DataDir:  filepath.Join(root, "data"),
		Sites:    seed,
	}
	store, err := state.NewStore(cfg.DataDir)
	if err != nil {
		t.Fatalf("state store: %v", err)
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	mgr := manager.New(cfg, store, log)

	n := 0
	var rerr error
	reload := func() error {
		n++
		return rerr
	}
	return sitesEnv{
		h:         New(mgr, token, log, reload).routes(),
		sitesDir:  sitesDir,
		reloads:   &n,
		reloadErr: &rerr,
	}
}

const validFragment = `sites:
  - domain: example.com
    source:
      type: git
      url: https://github.com/acme/site.git
      branch: main
`

func post(env sitesEnv, body, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/sites", strings.NewReader(body))
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	env.h.ServeHTTP(rec, req)
	return rec
}

func TestCreateSiteWritesFragmentAndReloads(t *testing.T) {
	env := newSitesEnv(t, "")
	rec := post(env, validFragment, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("want 201, got %d (%s)", rec.Code, rec.Body.String())
	}
	written, err := os.ReadFile(filepath.Join(env.sitesDir, "example.com.yml"))
	if err != nil {
		t.Fatalf("fragment not written: %v", err)
	}
	// The bytes on disk are exactly what was POSTed — the file-drop and REST
	// paths are byte-identical.
	if string(written) != validFragment {
		t.Errorf("on-disk fragment differs from request body:\n%s", written)
	}
	if *env.reloads != 1 {
		t.Errorf("want exactly one reload, got %d", *env.reloads)
	}
}

func TestCreateSiteOverwriteIsUpdate(t *testing.T) {
	env := newSitesEnv(t, "")
	if rec := post(env, validFragment, ""); rec.Code != http.StatusCreated {
		t.Fatalf("seed create: want 201, got %d", rec.Code)
	}
	rec := post(env, validFragment, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("overwrite: want 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "updated") {
		t.Errorf("want 'updated' body, got %q", rec.Body.String())
	}
}

func TestCreateSiteRejectsInvalidFragmentBeforeWriting(t *testing.T) {
	env := newSitesEnv(t, "")
	// Missing source.url / branch → validation failure.
	bad := "sites:\n  - domain: broken.example.com\n    source:\n      type: git\n"
	rec := post(env, bad, "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d (%s)", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(filepath.Join(env.sitesDir, "broken.example.com.yml")); !os.IsNotExist(err) {
		t.Error("invalid fragment must not be written to disk")
	}
	if *env.reloads != 0 {
		t.Errorf("invalid fragment must not trigger a reload, got %d", *env.reloads)
	}
}

func TestCreateSiteRejectsUnknownKeys(t *testing.T) {
	env := newSitesEnv(t, "")
	// Strict decoding: an unknown field is a 400, same as the file-drop loader.
	bad := "sites:\n  - domain: example.com\n    bogus: true\n"
	if rec := post(env, bad, ""); rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for unknown key, got %d (%s)", rec.Code, rec.Body.String())
	}
}

func TestCreateSiteRejectsNonSingleSite(t *testing.T) {
	env := newSitesEnv(t, "")
	cases := map[string]string{
		"zero sites": "upstreams: []\n",
		"two sites": validFragment + `  - domain: other.example.com
    source:
      type: git
      url: https://github.com/acme/other.git
      branch: main
`,
		"with proxy": validFragment + `proxies:
  - domain: api.example.com
    pass: http://127.0.0.1:9000
`,
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			if rec := post(env, body, ""); rec.Code != http.StatusBadRequest {
				t.Fatalf("want 400, got %d (%s)", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestCreateSiteDuplicateDomainRejected(t *testing.T) {
	// A site already declared in the main config (a different file) collides.
	seed := config.Site{
		Domain: "example.com",
		File:   "/etc/nginxpilot/config.yml",
		Source: config.Source{Type: config.SourceGit, URL: "https://github.com/acme/site.git", Branch: "main"},
	}
	env := newSitesEnv(t, "", seed)
	rec := post(env, validFragment, "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for duplicate domain, got %d (%s)", rec.Code, rec.Body.String())
	}
	if *env.reloads != 0 {
		t.Errorf("rejected duplicate must not reload, got %d", *env.reloads)
	}
}

func TestCreateSiteRollsBackOnReloadFailure(t *testing.T) {
	env := newSitesEnv(t, "")
	*env.reloadErr = errSentinel{}
	rec := post(env, validFragment, "")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("want 500, got %d (%s)", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(filepath.Join(env.sitesDir, "example.com.yml")); !os.IsNotExist(err) {
		t.Error("fragment must be rolled back when the reload is rejected")
	}
}

func TestCreateSiteRequiresBearerWhenTokenSet(t *testing.T) {
	env := newSitesEnv(t, "secret")
	if rec := post(env, validFragment, ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("want 401 without token, got %d", rec.Code)
	}
	if rec := post(env, validFragment, "secret"); rec.Code != http.StatusCreated {
		t.Fatalf("want 201 with token, got %d (%s)", rec.Code, rec.Body.String())
	}
}

func TestDeleteSiteRemovesFragmentAndReloads(t *testing.T) {
	env := newSitesEnv(t, "")
	if rec := post(env, validFragment, ""); rec.Code != http.StatusCreated {
		t.Fatalf("seed create: want 201, got %d", rec.Code)
	}
	*env.reloads = 0

	rec := httptest.NewRecorder()
	env.h.ServeHTTP(rec, httptest.NewRequest(http.MethodDelete, "/sites/example.com", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(filepath.Join(env.sitesDir, "example.com.yml")); !os.IsNotExist(err) {
		t.Error("fragment must be removed")
	}
	if *env.reloads != 1 {
		t.Errorf("want one reload, got %d", *env.reloads)
	}
}

func TestDeleteSiteUnknownDomain404(t *testing.T) {
	env := newSitesEnv(t, "")
	rec := httptest.NewRecorder()
	env.h.ServeHTTP(rec, httptest.NewRequest(http.MethodDelete, "/sites/nope.example.com", nil))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("want 404, got %d", rec.Code)
	}
	if *env.reloads != 0 {
		t.Errorf("missing fragment must not reload, got %d", *env.reloads)
	}
}

type errSentinel struct{}

func (errSentinel) Error() string { return "reload rejected" }
