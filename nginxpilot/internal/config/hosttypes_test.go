package config

import (
	"reflect"
	"strings"
	"testing"
)

func validRedirect() Redirect {
	return Redirect{Domain: "old.example.com", To: "new.example.com"}
}

func redirectCfg(r Redirect) *Config {
	cfg := &Config{Redirects: []Redirect{r}}
	applyDefaults(cfg)
	return cfg
}

func TestValidateRedirects(t *testing.T) {
	cases := []struct {
		name    string
		mutate  func(*Redirect)
		wantErr string // "" = valid
	}{
		{"defaults are valid", func(r *Redirect) {}, ""},
		{"explicit 308", func(r *Redirect) { r.Code = 308 }, ""},
		{"target with port", func(r *Redirect) { r.To = "new.example.com:8443" }, ""},
		{"wildcard domain", func(r *Redirect) { r.Domain = "*.old.example.com" }, ""},
		{"bad code", func(r *Redirect) { r.Code = 305 }, "must be 301 | 302 | 303 | 307 | 308"},
		{"bad scheme", func(r *Redirect) { r.Scheme = "gopher" }, "must be http | https | auto"},
		{"missing to", func(r *Redirect) { r.To = "" }, "is required"},
		{"bad to port", func(r *Redirect) { r.To = "x.example.com:0" }, "port must be 1..65535"},
		{"self redirect", func(r *Redirect) { r.To = "old.example.com" }, "redirects to itself"},
		{"self redirect with port", func(r *Redirect) { r.To = "old.example.com:8080" }, "redirects to itself"},
		{"force_ssl rejected", func(r *Redirect) { r.ForceSSL = true; r.TLS = TLSAuto }, "force_ssl is not supported on a redirect"},
		{"metachar target", func(r *Redirect) { r.To = "x;}\nserver{" }, "invalid domain"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := validRedirect()
			c.mutate(&r)
			cfg := redirectCfg(r)
			// TLS consumers need a cert dir configured.
			if cfg.Redirects[0].WantsTLS() {
				cfg.Tls.CertDir = "/tmp/certs"
			}
			err := Validate(cfg)
			if c.wantErr == "" {
				if err != nil {
					t.Fatalf("expected valid, got %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), c.wantErr) {
				t.Fatalf("expected error containing %q, got %v", c.wantErr, err)
			}
		})
	}
}

func TestRedirectTargetNormalizedToPunycode(t *testing.T) {
	cfg := redirectCfg(Redirect{Domain: "old.example.com", To: "münchen.de:8080"})
	if err := Validate(cfg); err != nil {
		t.Fatalf("validate: %v", err)
	}
	if got := cfg.Redirects[0].To; got != "xn--mnchen-3ya.de:8080" {
		t.Fatalf("target not punycoded: %q", got)
	}
}

func TestRedirectDuplicateWithSiteDomain(t *testing.T) {
	cfg := &Config{
		Proxies:   []Proxy{{Domain: "app.example.com", Pass: "http://10.0.0.1:80"}},
		Redirects: []Redirect{{Domain: "app.example.com", To: "new.example.com"}},
	}
	applyDefaults(cfg)
	err := Validate(cfg)
	if err == nil || !strings.Contains(err.Error(), "duplicate domain") {
		t.Fatalf("expected duplicate-domain error, got %v", err)
	}
}

func TestValidateDeadHosts(t *testing.T) {
	mk := func(code int) *Config {
		cfg := &Config{DeadHosts: []DeadHost{{Domain: "gone.example.com", Code: code}}}
		applyDefaults(cfg)
		return cfg
	}
	for _, code := range []int{0, 404, 410, 444, 503} {
		if err := Validate(mk(code)); err != nil {
			t.Errorf("code %d should be valid: %v", code, err)
		}
	}
	if err := Validate(mk(405)); err == nil || !strings.Contains(err.Error(), "must be 404 | 410 | 444 | 503") {
		t.Errorf("code 405 should be rejected, got %v", err)
	}

	// force_ssl IS allowed on a dead host (with TLS).
	cfg := &Config{
		Tls:       Tls{CertDir: "/tmp/certs"},
		DeadHosts: []DeadHost{{Domain: "gone.example.com", WebOptions: WebOptions{TLS: TLSAuto, ForceSSL: true}}},
	}
	applyDefaults(cfg)
	if err := Validate(cfg); err != nil {
		t.Errorf("force_ssl on a dead host should be valid: %v", err)
	}
}

func TestDeadHostTLSRequiresCertDir(t *testing.T) {
	// A config whose ONLY TLS consumer is a dead host must still demand a cert
	// source (anyResourceWantsTLS coverage).
	cfg := &Config{DeadHosts: []DeadHost{{Domain: "gone.example.com", WebOptions: WebOptions{TLS: TLSRequired}}}}
	applyDefaults(cfg)
	err := Validate(cfg)
	if err == nil || !strings.Contains(err.Error(), "tls.cert_dir") {
		t.Fatalf("expected cert-dir error, got %v", err)
	}
	// Same for a redirect.
	cfg = &Config{Redirects: []Redirect{{Domain: "old.example.com", To: "new.example.com", WebOptions: WebOptions{TLS: TLSRequired}}}}
	applyDefaults(cfg)
	err = Validate(cfg)
	if err == nil || !strings.Contains(err.Error(), "tls.cert_dir") {
		t.Fatalf("expected cert-dir error for redirect, got %v", err)
	}
}

func TestNormalizeWildcardDomain(t *testing.T) {
	valid := map[string]string{
		"*.example.com": "*.example.com",
		"*.münchen.de":  "*.xn--mnchen-3ya.de",
		"example.com":   "example.com",
	}
	for in, want := range valid {
		got, err := NormalizeWildcardDomain(in)
		if err != nil || got != want {
			t.Errorf("NormalizeWildcardDomain(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, in := range []string{"a*.b.com", "*.*.com", "*", "*.", "a.*.com"} {
		if _, err := NormalizeWildcardDomain(in); err == nil {
			t.Errorf("NormalizeWildcardDomain(%q): expected error", in)
		}
	}
}

func TestWildcardSitesRejected(t *testing.T) {
	cfg := &Config{Sites: []Site{{Domain: "*.example.com", Source: Source{Type: SourceGit, URL: "https://x/y.git", Branch: "main"}}}}
	applyDefaults(cfg)
	err := Validate(cfg)
	if err == nil || !strings.Contains(err.Error(), "not here") {
		t.Fatalf("wildcard site should be rejected with the targeted message, got %v", err)
	}
}

func TestWildcardProxyAccepted(t *testing.T) {
	cfg := &Config{Proxies: []Proxy{{Domain: "*.example.com", Pass: "http://10.0.0.1:80"}}}
	applyDefaults(cfg)
	if err := Validate(cfg); err != nil {
		t.Fatalf("wildcard proxy should validate: %v", err)
	}
	// A wildcard and its apex/subdomain may coexist (nginx precedence governs).
	cfg = &Config{Proxies: []Proxy{
		{Domain: "*.example.com", Pass: "http://10.0.0.1:80"},
		{Domain: "app.example.com", Pass: "http://10.0.0.2:80"},
	}}
	applyDefaults(cfg)
	if err := Validate(cfg); err != nil {
		t.Fatalf("wildcard + exact should coexist: %v", err)
	}
}

func TestFileStem(t *testing.T) {
	if got := FileStem("*.example.com"); got != "_wildcard.example.com" {
		t.Errorf("FileStem wildcard: %q", got)
	}
	if got := FileStem("example.com"); got != "example.com" {
		t.Errorf("FileStem plain: %q", got)
	}
}

// TestFragmentKindsCoverEveryList locks FragmentKinds (and therefore the
// ParseFragment error text) to the actual Fragment struct — the original
// hand-maintained message went stale when streams were added.
func TestFragmentKindsCoverEveryList(t *testing.T) {
	typ := reflect.TypeOf(Fragment{})
	var tags []string
	for i := 0; i < typ.NumField(); i++ {
		tag := typ.Field(i).Tag.Get("yaml")
		if tag == "" || tag == "-" {
			continue
		}
		tags = append(tags, strings.Split(tag, ",")[0])
	}
	if !reflect.DeepEqual(tags, FragmentKinds) {
		t.Fatalf("FragmentKinds %v does not match Fragment yaml tags %v — update both together", FragmentKinds, tags)
	}
}

func TestParseFragmentAcceptsNewKinds(t *testing.T) {
	frag, err := ParseFragment([]byte("redirects:\n  - domain: a.com\n    to: b.com\n"), "t.yml")
	if err != nil {
		t.Fatalf("redirect fragment: %v", err)
	}
	if len(frag.Redirects) != 1 || frag.Redirects[0].File != "t.yml" {
		t.Fatalf("redirect provenance not set: %+v", frag.Redirects)
	}
	frag, err = ParseFragment([]byte("dead_hosts:\n  - domain: a.com\n"), "t.yml")
	if err != nil {
		t.Fatalf("dead_host fragment: %v", err)
	}
	if len(frag.DeadHosts) != 1 || frag.DeadHosts[0].File != "t.yml" {
		t.Fatalf("dead_host provenance not set: %+v", frag.DeadHosts)
	}
	// The strict-decode error names every kind.
	_, err = ParseFragment([]byte("nonsense: true\n"), "t.yml")
	if err == nil {
		t.Fatal("unknown key should error")
	}
	for _, kind := range FragmentKinds {
		if !strings.Contains(err.Error(), kind) {
			t.Errorf("fragment error text is missing %q: %v", kind, err)
		}
	}
}

func TestTargetCheckTier1Rejections(t *testing.T) {
	// proxy pass injection
	cfg := &Config{Proxies: []Proxy{{Domain: "a.example.com", Pass: "http://x;}\nserver {"}}}
	applyDefaults(cfg)
	if err := Validate(cfg); err == nil {
		t.Fatal("injection pass should be rejected")
	}
	// upstream server address with whitespace
	cfg = &Config{Upstreams: []Upstream{{Name: "u1", Servers: []UpstreamServer{{Address: "10.0.0.1:80 backup;"}}}}}
	applyDefaults(cfg)
	if err := Validate(cfg); err == nil {
		t.Fatal("metachar upstream address should be rejected")
	}
	// stream pass, previously accepted verbatim
	cfg = &Config{
		Nginx:   Nginx{},
		Streams: []Stream{{Name: "s1", Listen: 5432, Pass: "db;}\nstream {"}},
	}
	applyDefaults(cfg)
	if err := Validate(cfg); err == nil {
		t.Fatal("metachar stream pass should be rejected")
	}
}

func TestTargetChecksEnumValidatedInGenerateOnlyMode(t *testing.T) {
	cfg := &Config{Nginx: Nginx{TargetChecks: TargetChecks{DNS: "eror"}}} // manage: false!
	applyDefaults(cfg)
	err := Validate(cfg)
	if err == nil || !strings.Contains(err.Error(), "must be error | warn | off") {
		t.Fatalf("typo'd dns severity must fail in generate-only mode too, got %v", err)
	}
}

func TestReconcileConfigValidation(t *testing.T) {
	cfg := &Config{Nginx: Nginx{Reconcile: Reconcile{Interval: Duration(5 * 1e9)}}} // 5s < 15s min
	applyDefaults(cfg)
	if err := Validate(cfg); err == nil || !strings.Contains(err.Error(), "minimum is 15s") {
		t.Fatalf("expected reconcile interval minimum error, got %v", err)
	}
	cfg = &Config{Nginx: Nginx{Reconcile: Reconcile{OnFailure: "explode"}}}
	applyDefaults(cfg)
	if err := Validate(cfg); err == nil || !strings.Contains(err.Error(), "must be warn | disable") {
		t.Fatalf("expected on_failure enum error, got %v", err)
	}
}

func TestAcmeRenewalConfig(t *testing.T) {
	base := Acme{Enabled: true, Email: "a@b.c", AgreeTOS: true, Challenge: ChallengeHTTP, HTTP: AcmeHTTP{Webroot: "/var/www/acme"}}

	cfg := &Config{Acme: base}
	applyDefaults(cfg)
	if err := Validate(cfg); err != nil {
		t.Fatalf("defaults should validate: %v", err)
	}
	if got := cfg.Acme.Renewal.CheckIntervalOrDefault(); got != DefaultRenewalCheckInterval {
		t.Errorf("check interval default: %v", got)
	}
	if got := cfg.Acme.Renewal.RenewBeforeOrDefault(); got != DefaultRenewalRenewBefore {
		t.Errorf("renew before default: %v", got)
	}

	bad := base
	bad.Renewal = AcmeRenewal{CheckInterval: Duration(30 * 1e9)} // 30s < 1m
	cfg = &Config{Acme: bad}
	applyDefaults(cfg)
	if err := Validate(cfg); err == nil || !strings.Contains(err.Error(), "minimum is 1m") {
		t.Fatalf("expected check_interval minimum error, got %v", err)
	}
}
