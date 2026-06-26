package admin

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// do issues an arbitrary request against the admin handler, mirroring the
// `post` helper in sites_test.go but for any method/path so the upstream and
// proxy endpoints can be exercised with the same sitesEnv.
func do(env sitesEnv, method, path, body, token string) *httptest.ResponseRecorder {
	var r io.Reader
	if body != "" {
		r = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, r)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	env.h.ServeHTTP(rec, req)
	return rec
}

const validUpstream = `upstreams:
  - name: api_pool
    balancer: least_conn
    servers:
      - address: 10.0.0.1:8080
      - address: 10.0.0.2:8080
`

func TestCreateUpstreamWritesFragmentAndReloads(t *testing.T) {
	env := newSitesEnv(t, "")
	rec := do(env, http.MethodPost, "/upstreams", validUpstream, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("want 201, got %d (%s)", rec.Code, rec.Body.String())
	}
	written, err := os.ReadFile(filepath.Join(env.sitesDir, "upstream-api_pool.yml"))
	if err != nil {
		t.Fatalf("fragment not written: %v", err)
	}
	if string(written) != validUpstream {
		t.Errorf("on-disk fragment differs from request body:\n%s", written)
	}
	if *env.reloads != 1 {
		t.Errorf("want exactly one reload, got %d", *env.reloads)
	}
}

func TestCreateUpstreamOverwriteIsUpdate(t *testing.T) {
	env := newSitesEnv(t, "")
	if rec := do(env, http.MethodPost, "/upstreams", validUpstream, ""); rec.Code != http.StatusCreated {
		t.Fatalf("seed create: want 201, got %d", rec.Code)
	}
	rec := do(env, http.MethodPost, "/upstreams", validUpstream, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("overwrite: want 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "updated") {
		t.Errorf("want 'updated' body, got %q", rec.Body.String())
	}
}

func TestCreateUpstreamRejectsInvalidBeforeWriting(t *testing.T) {
	env := newSitesEnv(t, "")
	// No servers → validation failure.
	bad := "upstreams:\n  - name: empty_pool\n"
	rec := do(env, http.MethodPost, "/upstreams", bad, "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d (%s)", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(filepath.Join(env.sitesDir, "upstream-empty_pool.yml")); !os.IsNotExist(err) {
		t.Error("invalid fragment must not be written to disk")
	}
	if *env.reloads != 0 {
		t.Errorf("invalid fragment must not trigger a reload, got %d", *env.reloads)
	}
}

func TestCreateUpstreamRejectsNonSingle(t *testing.T) {
	env := newSitesEnv(t, "")
	cases := map[string]string{
		"zero upstreams": "proxies: []\n",
		"two upstreams": validUpstream + `  - name: other_pool
    servers:
      - address: 10.0.0.3:8080
`,
		"with site": validUpstream + `sites:
  - domain: example.com
    source:
      type: git
      url: https://github.com/acme/site.git
      branch: main
`,
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			if rec := do(env, http.MethodPost, "/upstreams", body, ""); rec.Code != http.StatusBadRequest {
				t.Fatalf("want 400, got %d (%s)", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestCreateUpstreamRollsBackOnReloadFailure(t *testing.T) {
	env := newSitesEnv(t, "")
	*env.reloadErr = errSentinel{}
	rec := do(env, http.MethodPost, "/upstreams", validUpstream, "")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("want 500, got %d (%s)", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(filepath.Join(env.sitesDir, "upstream-api_pool.yml")); !os.IsNotExist(err) {
		t.Error("fragment must be rolled back when the reload is rejected")
	}
}

func TestCreateUpstreamRequiresBearerWhenTokenSet(t *testing.T) {
	env := newSitesEnv(t, "secret")
	if rec := do(env, http.MethodPost, "/upstreams", validUpstream, ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("want 401 without token, got %d", rec.Code)
	}
	if rec := do(env, http.MethodPost, "/upstreams", validUpstream, "secret"); rec.Code != http.StatusCreated {
		t.Fatalf("want 201 with token, got %d (%s)", rec.Code, rec.Body.String())
	}
}

func TestDeleteUpstreamRemovesFragmentAndReloads(t *testing.T) {
	env := newSitesEnv(t, "")
	if rec := do(env, http.MethodPost, "/upstreams", validUpstream, ""); rec.Code != http.StatusCreated {
		t.Fatalf("seed create: want 201, got %d", rec.Code)
	}
	*env.reloads = 0

	rec := do(env, http.MethodDelete, "/upstreams/api_pool", "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(filepath.Join(env.sitesDir, "upstream-api_pool.yml")); !os.IsNotExist(err) {
		t.Error("fragment must be removed")
	}
	if *env.reloads != 1 {
		t.Errorf("want one reload, got %d", *env.reloads)
	}
}

func TestDeleteUpstreamUnknown404(t *testing.T) {
	env := newSitesEnv(t, "")
	rec := do(env, http.MethodDelete, "/upstreams/nope", "", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("want 404, got %d", rec.Code)
	}
	if *env.reloads != 0 {
		t.Errorf("missing fragment must not reload, got %d", *env.reloads)
	}
}

// An upstream still referenced by a proxy can't be deleted: it would make the
// on-disk config invalid. The API rejects with 409 and leaves the file in
// place so a restart never trips over a dangling reference. The upstream (with
// its on-disk file) and the referencing proxy are seeded into the running
// config directly because the test reload is a no-op (see sitesEnv.cfg).
func TestDeleteUpstreamStillReferencedConflicts(t *testing.T) {
	env := newSitesEnv(t, "")
	target := filepath.Join(env.sitesDir, "upstream-api_pool.yml")
	if err := os.WriteFile(target, []byte(validUpstream), 0o640); err != nil {
		t.Fatalf("seed upstream file: %v", err)
	}
	env.cfg.Upstreams = []config.Upstream{{
		Name:    "api_pool",
		File:    target,
		Servers: []config.UpstreamServer{{Address: "10.0.0.1:8080"}},
	}}
	env.cfg.Proxies = []config.Proxy{{
		Domain:   "api.example.com",
		Upstream: "api_pool",
		File:     env.cfg.Path,
	}}

	rec := do(env, http.MethodDelete, "/upstreams/api_pool", "", "")
	if rec.Code != http.StatusConflict {
		t.Fatalf("want 409 for referenced upstream, got %d (%s)", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(target); err != nil {
		t.Error("referenced upstream fragment must be left on disk")
	}
	if *env.reloads != 0 {
		t.Errorf("rejected delete must not reload, got %d", *env.reloads)
	}
}
