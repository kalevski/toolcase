package nginxconf

import (
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

const acmeLocation = "location ^~ /.well-known/acme-challenge/ {"

// withHTTP01 turns on ACME with http among the allowed challenges, plus an
// access list that would refuse the CA's validator if it applied.
func withHTTP01(cfg *config.Config) *config.Config {
	cfg.Acme = config.Acme{
		Enabled: true, Challenge: config.ChallengeDNS,
		Challenges: []string{config.ChallengeDNS, config.ChallengeHTTP},
		DNS:        config.AcmeDNS{Provider: "cloudflare"},
		HTTP:       config.AcmeHTTP{Webroot: "/var/www/acme"},
	}
	cfg.AccessLists = []config.AccessList{{
		Name:  "staff",
		Rules: []config.AccessRule{{Allow: "10.0.0.0/8"}},
		Users: []config.AccessListUser{{Username: "ops", PasswordHash: "$apr1$abc$def"}},
	}}
	return cfg
}

var forceSSL = config.WebOptions{TLS: config.TLSAuto, ForceSSL: true}

func assertBalanced(t *testing.T, name, out string) {
	t.Helper()
	if strings.Count(out, "{") != strings.Count(out, "}") {
		t.Errorf("%s: unbalanced braces\n%s", name, out)
	}
}

// serverLevelReturn reports whether a server block answers with a bare
// top-level return (4-space indent) — which would pre-empt the challenge.
func serverLevelReturn(out string) bool {
	for _, line := range strings.Split(out, "\n") {
		if strings.HasPrefix(line, "    return ") {
			return true
		}
	}
	return false
}

func TestHTTP01ServedByEveryVhostType(t *testing.T) {
	cfg := withHTTP01(&config.Config{DataDir: "/var/lib/nginxpilot"})
	cfg.PHP = config.PHP{Enabled: true, Version: "8.3", PoolDir: "/etc/php/pool.d", SocketDir: "/run/php"}
	_, app := phpApp("php.example.com")
	app.WebOptions = forceSSL

	render := map[string]func() (string, error){
		"site": func() (string, error) {
			return StaticVhost(cfg, &config.Site{Domain: "www.example.com", WebOptions: forceSSL}, Options{})
		},
		"proxy": func() (string, error) {
			p := proxy("api.example.com", forceSSL)
			p.AccessList = "staff"
			return ProxyVhost(cfg, p, Options{})
		},
		"redirect": func() (string, error) {
			return RedirectVhost(cfg, &config.Redirect{Domain: "old.example.com", To: "new.example.com", WebOptions: config.WebOptions{TLS: config.TLSAuto}}, Options{})
		},
		"dead host": func() (string, error) {
			return DeadHostVhost(cfg, &config.DeadHost{Domain: "parked.example.com", Code: 410, AccessList: "staff", WebOptions: forceSSL}, Options{})
		},
		"php app": func() (string, error) { return AppVhost(cfg, app, Options{}) },
	}
	for name, fn := range render {
		out, err := fn()
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		assertBalanced(t, name, out)
		if !strings.Contains(out, acmeLocation) || !strings.Contains(out, "        root /var/www/acme;") {
			t.Errorf("%s: no ACME webroot location\n%s", name, out)
			continue
		}
		for _, want := range []string{"        allow all;", "        auth_basic off;", "        try_files $uri =404;"} {
			if !strings.Contains(out, want) {
				t.Errorf("%s: challenge location lacks %q\n%s", name, want, out)
			}
		}
		if serverLevelReturn(out) {
			t.Errorf("%s: a server-level return would answer before the challenge location\n%s", name, out)
		}
	}
}

func TestHTTP01ForceSSLRedirectMovesIntoLocation(t *testing.T) {
	cfg := withHTTP01(&config.Config{DataDir: "/var/lib/nginxpilot"})
	out, err := StaticVhost(cfg, &config.Site{Domain: "www.example.com", WebOptions: forceSSL}, Options{})
	if err != nil {
		t.Fatal(err)
	}
	// Both the :80 redirect server and the :443 server answer challenges (the
	// CA follows the redirect to https when the :80 one is not reached first).
	if n := strings.Count(out, acmeLocation); n != 2 {
		t.Fatalf("want the challenge location in both server blocks, got %d\n%s", n, out)
	}
	if !strings.Contains(out, "    location / {\n        return 301 https://$host$request_uri;\n    }") {
		t.Fatalf("redirect not moved into location /\n%s", out)
	}
	redirectBlock := out[:strings.Index(out, "return 301")]
	if !strings.Contains(redirectBlock, acmeLocation) {
		t.Fatalf("the challenge location must come before the redirect\n%s", out)
	}
}

func TestHTTP01RedirectAndDeadHostBodiesMoveIntoLocation(t *testing.T) {
	cfg := withHTTP01(&config.Config{})
	out, err := RedirectVhost(cfg, &config.Redirect{Domain: "old.example.com", To: "new.example.com"}, Options{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "    location / {\n        return 301 $scheme://new.example.com$request_uri;\n    }") {
		t.Fatalf("redirect body not inside location /\n%s", out)
	}
	out, err = DeadHostVhost(cfg, &config.DeadHost{Domain: "parked.example.com", Code: 444}, Options{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "    location / {\n        return 444;\n    }") {
		t.Fatalf("dead host body not inside location /\n%s", out)
	}
}

func TestHTTP01ProxyChallengePrecedesRoutes(t *testing.T) {
	cfg := withHTTP01(&config.Config{})
	p := proxy("api.example.com", config.WebOptions{})
	p.AccessList = "staff"
	out, err := ProxyVhost(cfg, p, Options{})
	if err != nil {
		t.Fatal(err)
	}
	ch, route := strings.Index(out, acmeLocation), strings.Index(out, "proxy_pass")
	if ch < 0 || route < 0 || ch > route {
		t.Fatalf("challenge location missing or after the proxied routes\n%s", out)
	}
	access := strings.Index(out, "deny all;")
	if access < 0 || access > ch {
		t.Fatalf("expected the access list first, then the challenge location lifting it\n%s", out)
	}
}

// Without HTTP-01 in use nothing changes: the same output as before the
// feature, byte for byte.
func TestHTTP01OffLeavesVhostsUnchanged(t *testing.T) {
	base := &config.Config{DataDir: "/var/lib/nginxpilot"}
	site := &config.Site{Domain: "www.example.com", WebOptions: forceSSL}
	want, err := StaticVhost(base, site, Options{})
	if err != nil {
		t.Fatal(err)
	}
	for name, a := range map[string]config.Acme{
		"acme off":         {Enabled: false, Challenge: config.ChallengeHTTP, HTTP: config.AcmeHTTP{Webroot: "/var/www/acme"}},
		"dns only":         {Enabled: true, Challenge: config.ChallengeDNS, DNS: config.AcmeDNS{Provider: "cloudflare"}},
		"dns + standalone": {Enabled: true, Challenge: config.ChallengeDNS, Challenges: []string{config.ChallengeDNS, config.ChallengeStandalone}},
	} {
		cfg := &config.Config{DataDir: "/var/lib/nginxpilot", Acme: a}
		got, err := StaticVhost(cfg, site, Options{})
		if err != nil {
			t.Fatal(err)
		}
		if got != want {
			t.Errorf("%s: output changed\n--- want\n%s\n--- got\n%s", name, want, got)
		}
	}
	red, _ := RedirectVhost(base, &config.Redirect{Domain: "old.example.com", To: "new.example.com"}, Options{})
	if !strings.Contains(red, "\n    return 301 $scheme://new.example.com$request_uri;\n}") || strings.Contains(red, acmeLocation) {
		t.Fatalf("redirect without HTTP-01 must keep its server-level return\n%s", red)
	}
}
