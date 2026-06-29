package nginxconf

import (
	"errors"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// fakeCerts resolves a fixed set of domains.
type fakeCerts map[string][2]string

func (f fakeCerts) For(domain string) (string, string, bool) {
	if v, ok := f[domain]; ok {
		return v[0], v[1], true
	}
	return "", "", false
}

func proxy(domain string, w config.WebOptions) *config.Proxy {
	return &config.Proxy{Domain: domain, Pass: "http://127.0.0.1:9000", WebOptions: w}
}

func TestProxyTLSAutoWithCert(t *testing.T) {
	p := proxy("api.example.com", config.WebOptions{TLS: config.TLSAuto})
	opts := Options{Managed: true, Certs: fakeCerts{"api.example.com": {"/c/fullchain.pem", "/c/privkey.pem"}}}
	out, err := ProxyVhost(&config.Config{}, p, opts)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"listen 443 ssl;",
		"ssl_certificate     /c/fullchain.pem;",
		"ssl_certificate_key /c/privkey.pem;",
		"ssl_protocols TLSv1.2 TLSv1.3;",
		"listen 80;", // both http and https without force_ssl
	} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q\n%s", want, out)
		}
	}
}

func TestProxyTLSAutoNoCertManagedFallsBackToHTTP(t *testing.T) {
	p := proxy("api.example.com", config.WebOptions{TLS: config.TLSAuto})
	out, err := ProxyVhost(&config.Config{}, p, Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(out, "ssl") {
		t.Errorf("tls auto without a cert (managed) should serve plain HTTP\n%s", out)
	}
	if !strings.Contains(out, "listen 80;") {
		t.Errorf("expected plain listen 80\n%s", out)
	}
}

func TestProxyTLSRequiredNoCertErrors(t *testing.T) {
	p := proxy("api.example.com", config.WebOptions{TLS: config.TLSRequired})
	_, err := ProxyVhost(&config.Config{}, p, Options{Managed: true})
	if !errors.Is(err, ErrCertRequired) {
		t.Fatalf("want ErrCertRequired, got %v", err)
	}
}

func TestProxyForceSSLHTTP2HSTS(t *testing.T) {
	p := proxy("app.example.com", config.WebOptions{
		TLS: config.TLSAuto, ForceSSL: true, HTTP2: true,
		HSTS: config.HSTS{Enabled: true, Preload: true},
	})
	opts := Options{Managed: true, Certs: fakeCerts{"app.example.com": {"/c/f.pem", "/c/k.pem"}}}
	out, err := ProxyVhost(&config.Config{}, p, opts)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"return 301 https://$host$request_uri;",
		"http2 on;",
		"add_header Strict-Transport-Security \"max-age=63072000; includeSubDomains; preload\" always;",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q\n%s", want, out)
		}
	}
	// With force_ssl the main (https) server must not also listen on plain 80;
	// only the redirect server does.
	if strings.Count(out, "listen 80;") != 1 {
		t.Errorf("force_ssl should leave exactly one plain :80 (the redirect)\n%s", out)
	}
}

func TestProxyBlockExploitsManagedVsInline(t *testing.T) {
	p := proxy("x.example.com", config.WebOptions{BlockExploits: true})

	managed, _ := ProxyVhost(&config.Config{}, p, Options{Managed: true, IncludeDir: "/etc/nginx/conf.d/nginxpilot.d"})
	if !strings.Contains(managed, "include /etc/nginx/conf.d/nginxpilot.d/block-exploits.inc;") {
		t.Errorf("managed block_exploits should use an include\n%s", managed)
	}

	inline, _ := ProxyVhost(&config.Config{}, p, Options{})
	if strings.Contains(inline, "block-exploits.inc") {
		t.Errorf("print-vhost should inline the rules, not include\n%s", inline)
	}
	if !strings.Contains(inline, "return 403;") {
		t.Errorf("print-vhost should inline the deny rules\n%s", inline)
	}
}

func TestProxyCache(t *testing.T) {
	p := &config.Proxy{
		Domain: "cache.example.com", Pass: "http://127.0.0.1:9000",
		Cache: config.Cache{Enabled: true, Valid: []string{"200 10m", "404 1m"}, ZoneSize: "20m"},
	}
	out, _ := ProxyVhost(&config.Config{}, p, Options{Managed: true})
	for _, want := range []string{
		"proxy_cache cache_example_com;",
		"proxy_cache_valid 200 10m;",
		"proxy_cache_valid 404 1m;",
		"add_header X-Cache-Status $upstream_cache_status;",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q\n%s", want, out)
		}
	}

	cfg := &config.Config{Proxies: []config.Proxy{*p}}
	inc := CachePathInclude(cfg)
	if !strings.Contains(inc, "keys_zone=cache_example_com:20m") {
		t.Errorf("cache include missing zone\n%s", inc)
	}
}

func TestProxyWebsocketProxyLevelAllLocations(t *testing.T) {
	p := &config.Proxy{
		Domain:    "ws.example.com",
		Websocket: true,
		Locations: []config.ProxyLocation{
			{Path: "/", Pass: "http://127.0.0.1:3000"},
			{Path: "/api", Pass: "http://127.0.0.1:3001"},
		},
	}
	out, _ := ProxyVhost(&config.Config{}, p, Options{})
	if strings.Count(out, "proxy_set_header Upgrade $http_upgrade;") != 2 {
		t.Errorf("proxy-level websocket should apply to every location\n%s", out)
	}
}

func TestProxyGzipAndAdvanced(t *testing.T) {
	p := proxy("g.example.com", config.WebOptions{Gzip: true, Advanced: "add_header X-Frame-Options SAMEORIGIN;"})
	out, _ := ProxyVhost(&config.Config{}, p, Options{})
	if !strings.Contains(out, "gzip on;") {
		t.Errorf("missing gzip\n%s", out)
	}
	if !strings.Contains(out, "add_header X-Frame-Options SAMEORIGIN;") {
		t.Errorf("missing advanced passthrough\n%s", out)
	}
}

func TestPrintVhostTLSPlaceholderPaths(t *testing.T) {
	p := proxy("noc.example.com", config.WebOptions{TLS: config.TLSAuto})
	out, err := ProxyVhost(&config.Config{}, p, Options{}) // print-vhost, no certs
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "/etc/letsencrypt/live/noc.example.com/fullchain.pem") {
		t.Errorf("print-vhost should fall back to conventional certbot paths\n%s", out)
	}
}

func TestStaticSiteTLS(t *testing.T) {
	site := &config.Site{Domain: "s.example.com", WebOptions: config.WebOptions{TLS: config.TLSAuto}}
	opts := Options{Managed: true, Certs: fakeCerts{"s.example.com": {"/c/f.pem", "/c/k.pem"}}}
	out, err := StaticVhost(&config.Config{DataDir: "/var/lib/nginxpilot"}, site, opts)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "listen 443 ssl;") || !strings.Contains(out, "root /var/lib/nginxpilot/sites/s.example.com/current;") {
		t.Errorf("static TLS site render wrong\n%s", out)
	}
}
