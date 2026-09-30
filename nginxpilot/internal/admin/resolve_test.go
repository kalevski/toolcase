package admin

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

func TestStatusReportsProxyResolveFeature(t *testing.T) {
	h := newTestServer(t, &config.Config{})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/status", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Features map[string]bool `json:"features"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if !out.Features["proxy_resolve"] {
		t.Fatalf("features.proxy_resolve should be true: %s", rec.Body.String())
	}
}

const resolveProxyFragment = `proxies:
  - domain: app.example.com
    pass: http://wmk-abc123:3000
    resolve: true
    locations:
      - path: /
      - path: /static
        pass: http://10.0.0.9:80
        resolve: false
`

func TestCreateProxyWithResolve(t *testing.T) {
	env := newSitesEnv(t, "")
	rec := do(env, http.MethodPost, "/proxies?skip_target_checks=true", resolveProxyFragment, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("want 201, got %d (%s)", rec.Code, rec.Body.String())
	}
	written, err := os.ReadFile(filepath.Join(env.sitesDir, "proxy-app.example.com.yml"))
	if err != nil {
		t.Fatalf("fragment not written: %v", err)
	}
	frag, err := config.ParseFragment(written, "written")
	if err != nil {
		t.Fatalf("written fragment does not parse: %v", err)
	}
	p := frag.Proxies[0]
	if !p.Resolve || p.Locations[1].Resolve == nil || *p.Locations[1].Resolve {
		t.Fatalf("resolve lost in the written fragment: %+v", p)
	}
}

func TestCreateProxyResolveRejections(t *testing.T) {
	env := newSitesEnv(t, "")
	env.cfg.Upstreams = []config.Upstream{{
		Name:    "api_pool",
		File:    env.cfg.Path,
		Servers: []config.UpstreamServer{{Address: "10.0.0.1:8080"}},
	}}
	for body, code := range map[string]string{
		"proxies:\n  - domain: a.example.com\n    pass: http://wmk-abc123:3000/api\n    resolve: true\n": "resolve_pass_path",
		"proxies:\n  - domain: b.example.com\n    upstream: api_pool\n    resolve: true\n":               "resolve_needs_pass",
	} {
		rec := do(env, http.MethodPost, "/proxies?skip_target_checks=true", body, "")
		if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), code) {
			t.Errorf("want 400 mentioning %q, got %d %s", code, rec.Code, rec.Body.String())
		}
	}
}

func TestListProxiesCarriesResolve(t *testing.T) {
	env := newSitesEnv(t, "")
	off := false
	env.cfg.Proxies = []config.Proxy{{
		Domain: "app.example.com", Pass: "http://wmk-abc123:3000", Resolve: true,
		Locations: []config.ProxyLocation{{Path: "/"}, {Path: "/static", Pass: "http://10.0.0.9:80", Resolve: &off}},
	}}
	rec := do(env, http.MethodGet, "/proxies", "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("list: %d %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Proxies []struct {
			Resolve   bool `json:"resolve"`
			Locations []struct {
				Path    string `json:"path"`
				Resolve *bool  `json:"resolve"`
			} `json:"locations"`
		} `json:"proxies"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	p := out.Proxies[0]
	if !p.Resolve || p.Locations[0].Resolve != nil || p.Locations[1].Resolve == nil || *p.Locations[1].Resolve {
		t.Fatalf("resolve not serialized as expected: %s", rec.Body.String())
	}
}
