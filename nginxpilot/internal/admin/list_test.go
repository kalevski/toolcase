package admin

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// The GET collection endpoints serialize the running merged config so a control
// plane can read current state. They must reflect every entity, never leak
// secret material or internal provenance (the File field), and emit durations
// and sizes in their human string form. The config is seeded directly (the
// test reload is a no-op — see sitesEnv.cfg).
func TestListEndpointsSerializeRunningConfig(t *testing.T) {
	site := config.Site{
		Domain: "example.com",
		File:   "/etc/nginxpilot/config.yml",
		Source: config.Source{Type: config.SourceGit, URL: "https://github.com/acme/site.git", Branch: "main"},
	}
	env := newSitesEnv(t, "", site)
	env.cfg.Upstreams = []config.Upstream{{
		Name:     "api_pool",
		Balancer: "least_conn",
		File:     env.cfg.Path,
		Servers:  []config.UpstreamServer{{Address: "10.0.0.1:8080"}},
	}}
	env.cfg.Proxies = []config.Proxy{{
		Domain: "api.example.com",
		Pass:   "http://127.0.0.1:9000",
		File:   env.cfg.Path,
	}}

	var sites struct {
		Sites []struct {
			Domain string `json:"domain"`
		} `json:"sites"`
	}
	rec := do(env, http.MethodGet, "/sites", "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /sites: want 200, got %d", rec.Code)
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &sites); err != nil {
		t.Fatalf("decode /sites: %v", err)
	}
	if len(sites.Sites) != 1 || sites.Sites[0].Domain != "example.com" {
		t.Fatalf("unexpected sites payload: %s", rec.Body.String())
	}
	// Internal provenance must never leak over the API.
	if strings.Contains(rec.Body.String(), "\"File\"") {
		t.Errorf("File provenance leaked into the API payload: %s", rec.Body.String())
	}

	var ups struct {
		Upstreams []struct {
			Name     string `json:"name"`
			Balancer string `json:"balancer"`
		} `json:"upstreams"`
	}
	rec = do(env, http.MethodGet, "/upstreams", "", "")
	if err := json.Unmarshal(rec.Body.Bytes(), &ups); err != nil {
		t.Fatalf("decode /upstreams: %v", err)
	}
	if len(ups.Upstreams) != 1 || ups.Upstreams[0].Name != "api_pool" || ups.Upstreams[0].Balancer != "least_conn" {
		t.Fatalf("unexpected upstreams payload: %s", rec.Body.String())
	}

	var prox struct {
		Proxies []struct {
			Domain string `json:"domain"`
			Pass   string `json:"pass"`
		} `json:"proxies"`
	}
	rec = do(env, http.MethodGet, "/proxies", "", "")
	if err := json.Unmarshal(rec.Body.Bytes(), &prox); err != nil {
		t.Fatalf("decode /proxies: %v", err)
	}
	if len(prox.Proxies) != 1 || prox.Proxies[0].Domain != "api.example.com" || prox.Proxies[0].Pass != "http://127.0.0.1:9000" {
		t.Fatalf("unexpected proxies payload: %s", rec.Body.String())
	}
}

// Durations and byte sizes serialize as human strings ("5m", "512MiB"), keeping
// the read-API symmetric with the YAML the write-API accepts.
func TestListEndpointDurationsAndSizesAreStrings(t *testing.T) {
	env := newSitesEnv(t, "")
	env.cfg.Proxies = []config.Proxy{{
		Domain:            "api.example.com",
		Pass:              "http://127.0.0.1:9000",
		ReadTimeout:       config.Duration(60 * 1e9), // 60s
		ClientMaxBodySize: 20 << 20,                  // 20MiB
		File:              env.cfg.Path,
	}}
	rec := do(env, http.MethodGet, "/proxies", "", "")
	body := rec.Body.String()
	if !strings.Contains(body, "\"1m0s\"") {
		t.Errorf("read_timeout not rendered as a duration string: %s", body)
	}
	if !strings.Contains(body, "\"20MiB\"") {
		t.Errorf("client_max_body_size not rendered as a size string: %s", body)
	}
}

// Empty config serializes the collections as [] (a JSON array), never null, so
// clients can iterate without a nil guard.
func TestListEndpointsEmptyAreArrays(t *testing.T) {
	env := newSitesEnv(t, "")
	for _, path := range []string{"/sites", "/upstreams", "/proxies"} {
		rec := do(env, http.MethodGet, path, "", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("GET %s: want 200, got %d", path, rec.Code)
		}
		if strings.Contains(rec.Body.String(), "null") {
			t.Errorf("GET %s emitted null, want []: %s", path, rec.Body.String())
		}
	}
}
