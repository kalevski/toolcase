package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func resolveProxy(mutate func(*Proxy)) Config {
	cfg := minValidConfig()
	cfg.Upstreams = []Upstream{validUpstream()}
	p := Proxy{Domain: "app.example.com", Pass: "http://wmk-abc123:3000", Resolve: true, File: "test"}
	if mutate != nil {
		mutate(&p)
	}
	cfg.Proxies = []Proxy{p}
	return cfg
}

func TestResolverDefaults(t *testing.T) {
	var r Resolver
	if got := r.AddressesOrDefault(); len(got) != 1 || got[0] != "127.0.0.11" {
		t.Errorf("addresses default = %v, want [127.0.0.11]", got)
	}
	if r.ValidOrDefault() != 10*time.Second {
		t.Errorf("valid default = %s, want 10s", r.ValidOrDefault())
	}
	if r.IPv6Enabled() {
		t.Error("ipv6 must default to off")
	}
	if r.TimeoutOrDefault() != 5*time.Second {
		t.Errorf("timeout default = %s, want 5s", r.TimeoutOrDefault())
	}
}

func TestParseResolverAndProxyResolve(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nginxpilot.yml")
	body := `
data_dir: /tmp
nginx:
  resolver:
    addresses: ["10.0.0.2", "[fd00::53]:5353"]
    valid: 30s
    ipv6: true
    timeout: 2s
proxies:
  - domain: app.example.com
    pass: http://wmk-abc123:3000
    resolve: true
    locations:
      - path: /
      - path: /static
        pass: http://10.0.0.9:80
        resolve: false
`
	if err := os.WriteFile(path, []byte(body), 0o640); err != nil {
		t.Fatal(err)
	}
	res, err := Load(path)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	cfg := res.Config
	r := cfg.Nginx.Resolver
	if strings.Join(r.AddressesOrDefault(), ",") != "10.0.0.2,[fd00::53]:5353" || r.ValidOrDefault() != 30*time.Second ||
		!r.IPv6Enabled() || r.TimeoutOrDefault() != 2*time.Second {
		t.Fatalf("resolver not parsed: %+v", r)
	}
	p := cfg.Proxies[0]
	if !p.Resolve {
		t.Fatal("proxy resolve not parsed")
	}
	if p.Locations[0].Resolve != nil || p.Locations[1].Resolve == nil || *p.Locations[1].Resolve {
		t.Fatalf("location resolve not parsed: %+v", p.Locations)
	}
	if !p.ResolvesPerRequest(p.Locations[0]) {
		t.Error("an inheriting location must resolve per request")
	}
	if p.ResolvesPerRequest(p.Locations[1]) {
		t.Error("resolve: false must override the proxy")
	}
}

func TestResolvesPerRequestSkipsIPLiterals(t *testing.T) {
	p := Proxy{Domain: "a.example.com", Pass: "http://10.0.0.4:3000", Resolve: true}
	if p.ResolvesPerRequest(ProxyLocation{Path: "/"}) || p.UsesResolver() {
		t.Error("an IP-literal pass has nothing to resolve")
	}
	p.Pass = "http://[fd00::4]:3000"
	if p.UsesResolver() {
		t.Error("an IPv6-literal pass has nothing to resolve")
	}
	p.Pass = "http://wmk-abc123:3000"
	if !p.UsesResolver() {
		t.Error("a hostname pass with resolve must use the resolver")
	}
	on := true
	q := Proxy{Domain: "b.example.com", Pass: "http://web:80", Locations: []ProxyLocation{{Path: "/api", Resolve: &on}}}
	if !q.UsesResolver() {
		t.Error("a location may opt in without the proxy")
	}
}

func TestValidateResolveOK(t *testing.T) {
	for name, mutate := range map[string]func(*Proxy){
		"hostname":      nil,
		"https no port": func(p *Proxy) { p.Pass = "https://svc.internal" },
		"ip literal":    func(p *Proxy) { p.Pass = "http://10.0.0.4:3000" },
		"location overrides upstream default": func(p *Proxy) {
			p.Pass, p.Upstream = "", "api_pool"
			p.Locations = []ProxyLocation{{Path: "/", Pass: "http://wmk-abc123:3000"}}
		},
		"location opts out on upstream": func(p *Proxy) {
			off := false
			p.Pass, p.Upstream = "", "api_pool"
			p.Locations = []ProxyLocation{{Path: "/", Resolve: &off}}
		},
	} {
		cfg := resolveProxy(mutate)
		if err := Validate(&cfg); err != nil {
			t.Errorf("%s: unexpected error: %v", name, err)
		}
	}
}

func TestValidateResolveNeedsPass(t *testing.T) {
	on := true
	for name, mutate := range map[string]func(*Proxy){
		"proxy upstream": func(p *Proxy) { p.Pass, p.Upstream = "", "api_pool" },
		"location upstream": func(p *Proxy) {
			p.Resolve = false
			p.Locations = []ProxyLocation{{Path: "/api", Upstream: "api_pool", Resolve: &on}}
		},
	} {
		cfg := resolveProxy(mutate)
		err := Validate(&cfg)
		if err == nil || !strings.Contains(err.Error(), "resolve_needs_pass") {
			t.Errorf("%s: want resolve_needs_pass, got %v", name, err)
		}
	}
}

func TestValidateResolvePassPath(t *testing.T) {
	for _, pass := range []string{"http://wmk-abc123:3000/", "http://wmk-abc123:3000/api", "http://10.0.0.4:3000/v1/"} {
		cfg := resolveProxy(func(p *Proxy) { p.Pass = pass })
		err := Validate(&cfg)
		if err == nil || !strings.Contains(err.Error(), "resolve_pass_path") {
			t.Errorf("%s: want resolve_pass_path, got %v", pass, err)
		}
	}
	cfg := resolveProxy(func(p *Proxy) { p.Pass, p.Resolve = "http://wmk-abc123:3000/api", false })
	if err := Validate(&cfg); err != nil {
		t.Errorf("a path is fine without resolve: %v", err)
	}
}

func TestValidateResolverAddresses(t *testing.T) {
	for _, ok := range []string{"127.0.0.11", "10.0.0.2:5353", "::1", "[fd00::53]", "[fd00::53]:53"} {
		cfg := minValidConfig()
		cfg.Nginx.Resolver.Addresses = []string{ok}
		if err := Validate(&cfg); err != nil {
			t.Errorf("%q: unexpected error: %v", ok, err)
		}
	}
	for _, bad := range []string{"dns.example.com", "10.0.0.2:0", "10.0.0.2;", "", "[10.0.0.2]", "fe80::1%eth0"} {
		cfg := minValidConfig()
		cfg.Nginx.Resolver.Addresses = []string{bad}
		if err := Validate(&cfg); err == nil || !strings.Contains(err.Error(), "nginx.resolver.addresses") {
			t.Errorf("%q: want a resolver address error, got %v", bad, err)
		}
	}
}
