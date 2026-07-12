package nginxconf

import (
	"errors"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

func TestVhostStaticSite(t *testing.T) {
	cfg := &config.Config{
		DataDir: "/var/lib/nginxpilot",
		Sites:   []config.Site{{Domain: "example.com"}},
	}
	out, err := Vhost(cfg, "example.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, want := range []string{
		"server_name example.com;",
		"root /var/lib/nginxpilot/sites/example.com/current;",
		"try_files $uri $uri/ =404;",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("static vhost missing %q\n%s", want, out)
		}
	}
}

func TestVhostStaticSiteSPARouting(t *testing.T) {
	cfg := &config.Config{
		DataDir: "/var/lib/nginxpilot",
		Sites:   []config.Site{{Domain: "app.example.com", Routing: config.RoutingSPA}},
	}
	out, err := Vhost(cfg, "app.example.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "try_files $uri $uri/ /index.html;") {
		t.Errorf("spa vhost missing index.html fallback\n%s", out)
	}
	if strings.Contains(out, "=404") {
		t.Errorf("spa vhost must not 404 unknown paths\n%s", out)
	}
}

func TestVhostStaticSiteCleanURLsRouting(t *testing.T) {
	cfg := &config.Config{
		DataDir: "/var/lib/nginxpilot",
		Sites:   []config.Site{{Domain: "docs.example.com", Routing: config.RoutingCleanURLs}},
	}
	out, err := Vhost(cfg, "docs.example.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "try_files $uri $uri.html $uri/ =404;") {
		t.Errorf("clean-urls vhost missing $uri.html lookup\n%s", out)
	}
}

func TestVhostStaticSiteNotFoundPage(t *testing.T) {
	cfg := &config.Config{
		DataDir: "/var/lib/nginxpilot",
		Sites:   []config.Site{{Domain: "example.com", NotFound: "/404.html"}},
	}
	out, err := Vhost(cfg, "example.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "error_page 404 /404.html;") {
		t.Errorf("vhost missing custom error_page\n%s", out)
	}
}

func TestVhostStaticSiteCacheAssets(t *testing.T) {
	cfg := &config.Config{
		DataDir: "/var/lib/nginxpilot",
		Sites:   []config.Site{{Domain: "example.com", CacheAssets: true}},
	}
	out, err := Vhost(cfg, "example.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, want := range []string{
		"location ~* \\.(?:css|js|mjs|map|woff2?|ttf|otf|eot|ico|gif|jpe?g|png|webp|avif|svg|mp4|webm)$ {",
		`add_header Cache-Control "public, max-age=31536000, immutable";`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("cache_assets vhost missing %q\n%s", want, out)
		}
	}
}

func TestVhostStaticSiteDefaultHasNoExtras(t *testing.T) {
	cfg := &config.Config{
		DataDir: "/var/lib/nginxpilot",
		Sites:   []config.Site{{Domain: "example.com"}},
	}
	out, err := Vhost(cfg, "example.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, forbidden := range []string{"error_page", "Cache-Control", "/index.html;"} {
		if strings.Contains(out, forbidden) {
			t.Errorf("default vhost must not contain %q\n%s", forbidden, out)
		}
	}
}

func TestVhostUnknownDomain(t *testing.T) {
	cfg := &config.Config{}
	_, err := Vhost(cfg, "nope.com")
	if !errors.Is(err, ErrUnknownDomain) {
		t.Fatalf("want ErrUnknownDomain, got %v", err)
	}
}

func TestProxyVhostNamedUpstream(t *testing.T) {
	maxFails := 3
	cfg := &config.Config{
		Upstreams: []config.Upstream{{
			Name:      "api_pool",
			Balancer:  config.BalancerLeastConn,
			Keepalive: 32,
			Servers: []config.UpstreamServer{
				{Address: "10.0.0.1:8080", Weight: 2, MaxFails: &maxFails, FailTimeout: config.Duration(30e9)},
				{Address: "10.0.0.2:8080", Backup: true},
			},
		}},
		Proxies: []config.Proxy{{
			Domain:   "api.example.com",
			Upstream: "api_pool",
		}},
	}
	out, err := Vhost(cfg, "api.example.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, want := range []string{
		"upstream api_pool {",
		"least_conn;",
		"server 10.0.0.1:8080 weight=2 max_fails=3 fail_timeout=30s;",
		"server 10.0.0.2:8080 backup;",
		"keepalive 32;",
		"server_name api.example.com;",
		"location / {",
		"proxy_pass http://api_pool;",
		"proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("proxy vhost missing %q\n%s", want, out)
		}
	}
}

func TestProxyVhostInlinePass(t *testing.T) {
	cfg := &config.Config{
		Proxies: []config.Proxy{{
			Domain: "svc.example.com",
			Pass:   "http://127.0.0.1:9000",
		}},
	}
	out, err := Vhost(cfg, "svc.example.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "proxy_pass http://127.0.0.1:9000;") {
		t.Errorf("missing inline proxy_pass\n%s", out)
	}
	if strings.Contains(out, "upstream ") {
		t.Errorf("inline pass must not emit an upstream block\n%s", out)
	}
}

func TestProxyVhostWebsocketAndLocations(t *testing.T) {
	cfg := &config.Config{
		Proxies: []config.Proxy{{
			Domain: "app.example.com",
			Locations: []config.ProxyLocation{
				{Path: "/", Pass: "http://127.0.0.1:3000"},
				{Path: "/ws", Pass: "http://127.0.0.1:3001", Websocket: true},
			},
		}},
	}
	out, err := Vhost(cfg, "app.example.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "location /ws {") {
		t.Errorf("missing /ws location\n%s", out)
	}
	if !strings.Contains(out, `proxy_set_header Connection "upgrade";`) {
		t.Errorf("websocket location missing Connection upgrade header\n%s", out)
	}
	if strings.Count(out, "proxy_set_header Upgrade $http_upgrade;") != 1 {
		t.Errorf("Upgrade header should appear only in the websocket location\n%s", out)
	}
}

func TestReferencedUpstreamsDedup(t *testing.T) {
	p := &config.Proxy{
		Upstream: "pool_a",
		Locations: []config.ProxyLocation{
			{Path: "/", Upstream: "pool_a"},
			{Path: "/api", Upstream: "pool_b"},
		},
	}
	got := referencedUpstreams(p)
	want := []string{"pool_a", "pool_b"}
	if len(got) != len(want) {
		t.Fatalf("want %v, got %v", want, got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("want %v, got %v", want, got)
		}
	}
}
