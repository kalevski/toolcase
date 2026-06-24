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
