package nginxconf

import (
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

func boolPtr(b bool) *bool { return &b }

func TestRedirectVhostDefaults(t *testing.T) {
	r := &config.Redirect{Domain: "old.example.com", To: "new.example.com"}
	out, err := RedirectVhost(&config.Config{}, r, Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"server_name old.example.com;",
		"return 301 $scheme://new.example.com$request_uri;",
		"listen 80;",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in:\n%s", want, out)
		}
	}
}

func TestRedirectVhostVariants(t *testing.T) {
	// 308 + explicit https + no path preservation.
	r := &config.Redirect{
		Domain: "old.example.com", To: "new.example.com:8443",
		Code: 308, Scheme: config.RedirectSchemeHTTPS, PreservePath: boolPtr(false),
	}
	out, err := RedirectVhost(&config.Config{}, r, Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "return 308 https://new.example.com:8443;") {
		t.Errorf("wrong return directive:\n%s", out)
	}
	if strings.Contains(out, "$request_uri") {
		t.Errorf("preserve_path off must drop $request_uri:\n%s", out)
	}
}

// A TLS-enabled redirect carries the same listener/SSL frame a proxy with the
// same WebOptions gets — the shared renderSimpleVhost helpers guarantee it.
func TestRedirectVhostTLS(t *testing.T) {
	certs := fakeCerts{"old.example.com": {"/c/old.crt", "/c/old.key"}}
	r := &config.Redirect{
		Domain: "old.example.com", To: "new.example.com",
		WebOptions: config.WebOptions{TLS: config.TLSRequired, HSTS: config.HSTS{Enabled: true}},
	}
	out, err := RedirectVhost(&config.Config{}, r, Options{Managed: true, Certs: certs})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"listen 443 ssl;",
		"ssl_certificate     /c/old.crt;",
		"Strict-Transport-Security",
		"return 301",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in:\n%s", want, out)
		}
	}
}

// tls: required with no cert → ErrCertRequired, so the engine quarantines it.
func TestRedirectVhostCertRequired(t *testing.T) {
	r := &config.Redirect{Domain: "old.example.com", To: "new.example.com",
		WebOptions: config.WebOptions{TLS: config.TLSRequired}}
	_, err := RedirectVhost(&config.Config{}, r, Options{Managed: true})
	if err != ErrCertRequired {
		t.Fatalf("expected ErrCertRequired, got %v", err)
	}
}

func TestDeadHostVhost(t *testing.T) {
	d := &config.DeadHost{Domain: "gone.example.com"}
	out, err := DeadHostVhost(&config.Config{}, d, Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"server_name gone.example.com;", "return 404;"} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in:\n%s", want, out)
		}
	}

	d = &config.DeadHost{Domain: "gone.example.com", Code: 444}
	out, _ = DeadHostVhost(&config.Config{}, d, Options{Managed: true})
	if !strings.Contains(out, "return 444;") {
		t.Errorf("wrong code:\n%s", out)
	}
}

func TestVhostOptsFindsNewTypes(t *testing.T) {
	cfg := &config.Config{
		Redirects: []config.Redirect{{Domain: "r.example.com", To: "x.example.com"}},
		DeadHosts: []config.DeadHost{{Domain: "d.example.com"}},
	}
	if out, err := VhostOpts(cfg, "r.example.com", Options{}); err != nil || !strings.Contains(out, "return 301") {
		t.Errorf("redirect lookup failed: %v", err)
	}
	if out, err := VhostOpts(cfg, "d.example.com", Options{}); err != nil || !strings.Contains(out, "return 404") {
		t.Errorf("dead host lookup failed: %v", err)
	}
}

func TestLocationAdvanced(t *testing.T) {
	p := &config.Proxy{
		Domain: "adv.example.com",
		Locations: []config.ProxyLocation{{
			Path: "/", Pass: "http://10.0.0.1:80",
			Advanced: "add_header X-Loc on always;\nadd_header X-Two two;",
		}},
	}
	out, err := ProxyVhost(&config.Config{}, p, Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"        # advanced (raw passthrough)",
		"        add_header X-Loc on always;",
		"        add_header X-Two two;",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q (8-space location indent) in:\n%s", want, out)
		}
	}
}

func TestWildcardServerNameAndPlaceholder(t *testing.T) {
	p := &config.Proxy{Domain: "*.example.com", Pass: "http://10.0.0.1:80",
		WebOptions: config.WebOptions{TLS: config.TLSAuto}}
	// print-vhost path (not managed): the placeholder cert path must use the
	// *.-stripped certbot live-dir name.
	out, err := ProxyVhost(&config.Config{}, p, Options{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "server_name *.example.com;") {
		t.Errorf("wildcard server_name missing:\n%s", out)
	}
	if !strings.Contains(out, "/etc/letsencrypt/live/example.com/fullchain.pem") {
		t.Errorf("placeholder path must strip the wildcard label:\n%s", out)
	}
	if strings.Contains(out, "live/*.example.com") {
		t.Errorf("literal wildcard live path must never render:\n%s", out)
	}
}
