package admin

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

const validProxyInline = `proxies:
  - domain: api.example.com
    pass: http://127.0.0.1:9000
`

func TestCreateProxyInlinePassWritesFragmentAndReloads(t *testing.T) {
	env := newSitesEnv(t, "")
	rec := do(env, http.MethodPost, "/proxies", validProxyInline, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("want 201, got %d (%s)", rec.Code, rec.Body.String())
	}
	written, err := os.ReadFile(filepath.Join(env.sitesDir, "proxy-api.example.com.yml"))
	if err != nil {
		t.Fatalf("fragment not written: %v", err)
	}
	if string(written) != validProxyInline {
		t.Errorf("on-disk fragment differs from request body:\n%s", written)
	}
	if *env.reloads != 1 {
		t.Errorf("want exactly one reload, got %d", *env.reloads)
	}
}

// A proxy may reference a named upstream; the reference is resolved against the
// upstreams already in the running config, so the upstream must exist first
// (create-upstream-then-proxy is the natural control-plane order). The upstream
// is seeded into the running config directly because the test reload is a
// no-op (see sitesEnv.cfg).
func TestCreateProxyReferencingUpstream(t *testing.T) {
	env := newSitesEnv(t, "")
	env.cfg.Upstreams = []config.Upstream{{
		Name:    "api_pool",
		File:    env.cfg.Path,
		Servers: []config.UpstreamServer{{Address: "10.0.0.1:8080"}},
	}}
	proxy := "proxies:\n  - domain: api.example.com\n    upstream: api_pool\n"
	rec := do(env, http.MethodPost, "/proxies", proxy, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("want 201, got %d (%s)", rec.Code, rec.Body.String())
	}
}

func TestCreateProxyUnknownUpstreamRejected(t *testing.T) {
	env := newSitesEnv(t, "")
	proxy := "proxies:\n  - domain: api.example.com\n    upstream: ghost_pool\n"
	rec := do(env, http.MethodPost, "/proxies", proxy, "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for unknown upstream, got %d (%s)", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(filepath.Join(env.sitesDir, "proxy-api.example.com.yml")); !os.IsNotExist(err) {
		t.Error("rejected proxy must not be written to disk")
	}
}

// Sites and proxies share one domain namespace: a proxy whose domain collides
// with an existing site is a duplicate-domain 400.
func TestCreateProxyDuplicateDomainRejected(t *testing.T) {
	seed := config.Site{
		Domain: "api.example.com",
		File:   "/etc/nginxpilot/config.yml",
		Source: config.Source{Type: config.SourceGit, URL: "https://github.com/acme/site.git", Branch: "main"},
	}
	env := newSitesEnv(t, "", seed)
	rec := do(env, http.MethodPost, "/proxies", validProxyInline, "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for duplicate domain, got %d (%s)", rec.Code, rec.Body.String())
	}
	if *env.reloads != 0 {
		t.Errorf("rejected duplicate must not reload, got %d", *env.reloads)
	}
}

func TestCreateProxyRejectsNonSingle(t *testing.T) {
	env := newSitesEnv(t, "")
	cases := map[string]string{
		"zero proxies": "upstreams: []\n",
		"with upstream": validProxyInline + `upstreams:
  - name: api_pool
    servers:
      - address: 10.0.0.1:8080
`,
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			if rec := do(env, http.MethodPost, "/proxies", body, ""); rec.Code != http.StatusBadRequest {
				t.Fatalf("want 400, got %d (%s)", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestDeleteProxyRemovesFragmentAndReloads(t *testing.T) {
	env := newSitesEnv(t, "")
	if rec := do(env, http.MethodPost, "/proxies", validProxyInline, ""); rec.Code != http.StatusCreated {
		t.Fatalf("seed create: want 201, got %d", rec.Code)
	}
	*env.reloads = 0

	rec := do(env, http.MethodDelete, "/proxies/api.example.com", "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(filepath.Join(env.sitesDir, "proxy-api.example.com.yml")); !os.IsNotExist(err) {
		t.Error("fragment must be removed")
	}
	if *env.reloads != 1 {
		t.Errorf("want one reload, got %d", *env.reloads)
	}
}

func TestDeleteProxyUnknown404(t *testing.T) {
	env := newSitesEnv(t, "")
	rec := do(env, http.MethodDelete, "/proxies/nope.example.com", "", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("want 404, got %d", rec.Code)
	}
	if *env.reloads != 0 {
		t.Errorf("missing fragment must not reload, got %d", *env.reloads)
	}
}

// A site and a proxy on the same daemon never collide on one fragment file:
// the site keeps <domain>.yml and the proxy gets proxy-<domain>.yml, so a
// DELETE on one entity kind can't remove the other's file.
func TestSiteAndProxyUseDistinctFragmentFiles(t *testing.T) {
	env := newSitesEnv(t, "")
	if rec := post(env, validFragment, ""); rec.Code != http.StatusCreated {
		t.Fatalf("seed site: want 201, got %d (%s)", rec.Code, rec.Body.String())
	}
	// example.com is now a site; a proxy needs a different domain (shared
	// namespace), so this also exercises the namespacing of the filenames.
	proxy := "proxies:\n  - domain: gw.example.com\n    pass: http://127.0.0.1:9000\n"
	if rec := do(env, http.MethodPost, "/proxies", proxy, ""); rec.Code != http.StatusCreated {
		t.Fatalf("seed proxy: want 201, got %d (%s)", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(filepath.Join(env.sitesDir, "example.com.yml")); err != nil {
		t.Errorf("site fragment missing: %v", err)
	}
	if _, err := os.Stat(filepath.Join(env.sitesDir, "proxy-gw.example.com.yml")); err != nil {
		t.Errorf("proxy fragment missing: %v", err)
	}
}
