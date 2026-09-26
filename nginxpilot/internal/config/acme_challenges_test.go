package config

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestAcmeChallengesDefaultToTheSingleChallenge(t *testing.T) {
	cfg := &Config{Acme: Acme{Enabled: true, Email: "a@b.c", AgreeTOS: true, Challenge: ChallengeHTTP}}
	applyDefaults(cfg)
	if err := Validate(cfg); err != nil {
		t.Fatalf("single-challenge config: %v", err)
	}
	if got := cfg.Acme.ChallengesOrDefault(); !reflect.DeepEqual(got, []string{ChallengeHTTP}) {
		t.Fatalf("ChallengesOrDefault = %v", got)
	}
	if cfg.Acme.AllowsChallenge(ChallengeDNS) {
		t.Fatal("dns must not be allowed when only http is configured")
	}
	if cfg.Acme.DNS.Provider != "" {
		t.Fatalf("a dns provider default was filled for an http-only daemon: %q", cfg.Acme.DNS.Provider)
	}
}

func TestAcmeChallengesMixed(t *testing.T) {
	cfg := &Config{Acme: Acme{Enabled: true, Email: "a@b.c", AgreeTOS: true, Challenge: ChallengeDNS,
		Challenges: []string{ChallengeDNS, ChallengeHTTP}}}
	applyDefaults(cfg)
	if err := Validate(cfg); err != nil {
		t.Fatalf("mixed config: %v", err)
	}
	a := cfg.Acme
	if !a.AllowsChallenge(ChallengeDNS) || !a.AllowsChallenge(ChallengeHTTP) || a.AllowsChallenge(ChallengeStandalone) {
		t.Fatalf("allowed set wrong: %v", a.ChallengesOrDefault())
	}
	// Defaults are filled for every allowed challenge, not only the default one.
	if a.DNS.Provider != DefaultAcmeProvider || a.HTTP.Webroot != DefaultAcmeWebroot || a.DNS.PropagationSeconds != DefaultAcmePropagationSeconds {
		t.Fatalf("defaults not filled for both challenges: %+v", a)
	}
}

func TestAcmeChallengesRejected(t *testing.T) {
	base := func() *Config {
		return &Config{Acme: Acme{Enabled: true, Email: "a@b.c", AgreeTOS: true, Challenge: ChallengeDNS,
			Challenges: []string{ChallengeDNS, ChallengeHTTP},
			DNS:        AcmeDNS{Provider: "cloudflare"}, HTTP: AcmeHTTP{Webroot: "/var/www/acme"}}}
	}
	cases := map[string]struct {
		mutate func(*Acme)
		want   string
	}{
		"unknown entry":            {func(a *Acme) { a.Challenges = []string{ChallengeDNS, "tls-alpn"} }, "acme.challenges"},
		"duplicate entry":          {func(a *Acme) { a.Challenges = []string{ChallengeDNS, ChallengeDNS} }, "listed twice"},
		"default not in the set":   {func(a *Acme) { a.Challenges = []string{ChallengeHTTP} }, "must be one of acme.challenges"},
		"dns allowed, no provider": {func(a *Acme) { a.DNS.Provider = "" }, "acme.dns.provider"},
		"http allowed, no webroot": {func(a *Acme) { a.HTTP.Webroot = "" }, "acme.http.webroot"},
	}
	for name, c := range cases {
		cfg := base()
		c.mutate(&cfg.Acme)
		// validateAcme without applyDefaults, which would fill the provider/webroot.
		if err := validateAcme(cfg); err == nil || !strings.Contains(err.Error(), c.want) {
			t.Errorf("%s: got %v, want an error mentioning %q", name, err, c.want)
		}
	}
}

func TestAcmeChallengesParse(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nginxpilot.yml")
	body := `acme:
  enabled: true
  email: ops@example.org
  agree_tos: true
  challenge: dns
  challenges: [dns, http]
  dns:
    provider: zonewright
`
	if err := os.WriteFile(path, []byte(body), 0o640); err != nil {
		t.Fatal(err)
	}
	res, err := Load(path)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	a := res.Config.Acme
	if !reflect.DeepEqual(a.Challenges, []string{"dns", "http"}) || a.DNS.Provider != "zonewright" || a.HTTP.Webroot != DefaultAcmeWebroot {
		t.Fatalf("parsed acme: %+v", a)
	}
}

// propagation_seconds_by_provider overrides the global wait per plugin (an
// explicit 0 included), and the renewal bound covers the longest of them.
func TestPropagationSecondsPerProvider(t *testing.T) {
	d := AcmeDNS{PropagationSeconds: 45, PropagationSecondsByProvider: map[string]int{"zonewright": 10, "slowdns": 300, "instant": 0}}
	for provider, want := range map[string]int{"zonewright": 10, "slowdns": 300, "instant": 0, "cloudflare": 45} {
		if got := d.PropagationSecondsFor(provider); got != want {
			t.Errorf("PropagationSecondsFor(%q) = %d, want %d", provider, got, want)
		}
	}
	if got := d.MaxPropagationSeconds(); got != 300 {
		t.Errorf("MaxPropagationSeconds = %d, want 300", got)
	}
	if got := (AcmeDNS{}).PropagationSecondsFor("x"); got != DefaultAcmePropagationSeconds {
		t.Errorf("unset → default %d, got %d", DefaultAcmePropagationSeconds, got)
	}
}

func TestPropagationSecondsPerProviderValidation(t *testing.T) {
	base := func(m map[string]int) *Config {
		cfg := &Config{Acme: Acme{
			Enabled: true, Email: "a@b.c", AgreeTOS: true, Challenge: ChallengeDNS,
			DNS: AcmeDNS{Provider: "cloudflare", PropagationSecondsByProvider: m},
		}}
		applyDefaults(cfg)
		return cfg
	}
	if err := Validate(base(map[string]int{"zonewright": 10, "cloudflare": 0})); err != nil {
		t.Fatalf("valid map rejected: %v", err)
	}
	for _, c := range []struct {
		m    map[string]int
		want string
	}{
		{map[string]int{"Zone_Wright": 10}, "not a plugin name"},
		{map[string]int{"zonewright": -1}, "between 0 and 3600"},
		{map[string]int{"zonewright": 7200}, "between 0 and 3600"},
	} {
		if err := Validate(base(c.m)); err == nil || !strings.Contains(err.Error(), c.want) {
			t.Errorf("%v: got %v, want an error mentioning %q", c.m, err, c.want)
		}
	}
}
