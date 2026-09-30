package nginxconf

import (
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

func TestProxyResolveRendersVariablePass(t *testing.T) {
	cfg := &config.Config{Proxies: []config.Proxy{{
		Domain:  "app.example.com",
		Pass:    "http://wmk-abc123:3000",
		Resolve: true,
	}}}
	out, err := Vhost(cfg, "app.example.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, want := range []string{
		"    resolver 127.0.0.11 valid=10s ipv6=off;\n    resolver_timeout 5s;\n",
		"    location / {\n        set $np_pass_0 http://wmk-abc123:3000;\n        proxy_pass $np_pass_0;\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n",
		"proxy_set_header X-Forwarded-Proto $scheme;",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q\n%s", want, out)
		}
	}
	if strings.Contains(out, "proxy_pass http://wmk-abc123:3000;") {
		t.Errorf("a resolve location must not render the load-time proxy_pass\n%s", out)
	}
}

func TestProxyResolvePerLocationAndOnce(t *testing.T) {
	off := false
	cfg := &config.Config{
		Nginx: config.Nginx{Resolver: config.Resolver{
			Addresses: []string{"10.0.0.2", "fd00::53", "[fd00::54]:5353"},
			Valid:     config.Duration(1500 * time.Millisecond),
			IPv6:      func() *bool { b := true; return &b }(),
			Timeout:   config.Duration(time.Minute),
		}},
		Proxies: []config.Proxy{{
			Domain:  "app.example.com",
			Pass:    "http://web:80",
			Resolve: true,
			Locations: []config.ProxyLocation{
				{Path: "/"},
				{Path: "/api", Pass: "http://api:8080"},
				{Path: "/static", Pass: "http://10.0.0.9:80"},
				{Path: "/legacy", Pass: "http://legacy:80", Resolve: &off},
			},
		}},
	}
	out, err := Vhost(cfg, "app.example.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if n := strings.Count(out, "resolver "); n != 1 {
		t.Errorf("resolver must be emitted once per server block, got %d\n%s", n, out)
	}
	for _, want := range []string{
		"resolver 10.0.0.2 [fd00::53] [fd00::54]:5353 valid=1500ms ipv6=on;",
		"resolver_timeout 60s;",
		"set $np_pass_0 http://web:80;\n        proxy_pass $np_pass_0;",
		"set $np_pass_1 http://api:8080;\n        proxy_pass $np_pass_1;",
		"location /static {\n        proxy_pass http://10.0.0.9:80;",
		"location /legacy {\n        proxy_pass http://legacy:80;",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q\n%s", want, out)
		}
	}
}

func TestProxyWithoutResolveHasNoResolver(t *testing.T) {
	for name, p := range map[string]config.Proxy{
		"off":        {Domain: "app.example.com", Pass: "http://web:80"},
		"ip literal": {Domain: "app.example.com", Pass: "http://10.0.0.4:3000", Resolve: true},
	} {
		cfg := &config.Config{Proxies: []config.Proxy{p}}
		out, err := Vhost(cfg, "app.example.com")
		if err != nil {
			t.Fatalf("%s: unexpected error: %v", name, err)
		}
		if strings.Contains(out, "resolver") || strings.Contains(out, "$np_pass_") {
			t.Errorf("%s: no resolver expected\n%s", name, out)
		}
		if !strings.Contains(out, "proxy_pass "+p.Pass+";") {
			t.Errorf("%s: plain proxy_pass expected\n%s", name, out)
		}
	}
}
