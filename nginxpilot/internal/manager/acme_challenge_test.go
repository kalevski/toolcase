package manager

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/acme"
	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// IssueCert passes the requested challenge through to certbot; the issue
// timeout follows the challenge, the renewal timeout covers DNS-01 whenever
// it is allowed; AcmeStatus reports the probe result.
func TestIssueCertChallengeAndStatus(t *testing.T) {
	dir := t.TempDir()
	cfg := &config.Config{Acme: config.Acme{
		Enabled: true, Email: "ops@example.org", ConfigDir: dir,
		Challenge: config.ChallengeHTTP, Challenges: []string{config.ChallengeHTTP, config.ChallengeDNS},
		DNS: config.AcmeDNS{Provider: "digitalocean", PropagationSeconds: 30}, HTTP: config.AcmeHTTP{Webroot: "/var/www/acme"},
	}}
	var mu sync.Mutex
	var last []string
	run := func(_ context.Context, _ []string, _ string, args ...string) (string, error) {
		mu.Lock()
		defer mu.Unlock()
		last = args
		return "* dns-digitalocean\n* dns-zonewright\n", nil
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	m := &Manager{log: logger, cfg: cfg}
	client := acme.NewWithRun(cfg.Acme, nil, dir, logger, run)
	m.acme.Store(client)

	if err := m.IssueCert(context.Background(), "", []string{"*.example.com"}, acme.IssueOptions{Challenge: "dns"}); err != nil {
		t.Fatalf("dns issue: %v", err)
	}
	if !strings.Contains(strings.Join(last, " "), "--authenticator dns-digitalocean") {
		t.Fatalf("dns argv: %v", last)
	}
	if err := m.IssueCert(context.Background(), "", []string{"shop.example.org"}, acme.IssueOptions{}); err != nil {
		t.Fatalf("default issue: %v", err)
	}
	if !strings.Contains(strings.Join(last, " "), "--webroot") {
		t.Fatalf("default (http) argv: %v", last)
	}

	if m.IssueTimeout("dns", "") <= m.IssueTimeout("http", "") {
		t.Fatal("a dns issue must get the propagation-aware timeout")
	}
	if m.RenewTimeout() != m.IssueTimeout("dns", "") {
		t.Fatal("renewals replay dns lineages too, so the renewal timeout must cover dns when it is allowed")
	}

	st := m.AcmeStatus()
	if st.DNSProviders != nil {
		t.Fatalf("providers known before the probe: %v", st.DNSProviders)
	}
	client.ProbeDNSPlugins(context.Background())
	st = m.AcmeStatus()
	if !st.Enabled || st.Challenge != "http" || strings.Join(st.Challenges, ",") != "http,dns" ||
		st.DNSProvider != "digitalocean" || strings.Join(st.DNSProviders, ",") != "digitalocean,zonewright" {
		t.Fatalf("acme status: %+v", st)
	}
}

// RevokeCert runs certbot only for a real lineage: a flat upload is
// ErrManualCert and an unknown name os.ErrNotExist, both before certbot runs.
func TestRevokeCertLineageOnly(t *testing.T) {
	cfgDir, certDir := t.TempDir(), t.TempDir()
	cfg := &config.Config{
		Acme: config.Acme{Enabled: true, Email: "ops@example.org", ConfigDir: cfgDir, Challenge: config.ChallengeHTTP, HTTP: config.AcmeHTTP{Webroot: "/w"}},
		Tls:  config.Tls{CertDir: certDir},
	}
	var calls [][]string
	run := func(_ context.Context, _ []string, _ string, args ...string) (string, error) {
		calls = append(calls, args)
		return "", nil
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	m := &Manager{log: logger, cfg: cfg}
	m.acme.Store(acme.NewWithRun(cfg.Acme, nil, t.TempDir(), logger, run))

	if err := m.RevokeCert(context.Background(), "missing.example", "", false); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("unknown name: %v", err)
	}
	if err := os.WriteFile(filepath.Join(certDir, "flat.example.crt"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := m.RevokeCert(context.Background(), "flat.example", "", false); !errors.Is(err, ErrManualCert) {
		t.Fatalf("flat cert: %v", err)
	}
	if len(calls) != 0 {
		t.Fatalf("certbot ran for a refused revoke: %v", calls)
	}
	if err := os.MkdirAll(filepath.Join(cfgDir, "live", "wmk-1-g1"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := m.RevokeCert(context.Background(), "wmk-1-g1", "keycompromise", true); err != nil {
		t.Fatalf("lineage revoke: %v", err)
	}
	if len(calls) != 1 || !strings.Contains(strings.Join(calls[0], " "), "revoke --cert-name wmk-1-g1 --reason keycompromise") {
		t.Fatalf("revoke argv: %v", calls)
	}
}

// The issue timeout follows the requested provider's wait; the renewal timeout
// the longest configured one (a renewal may replay any provider).
func TestTimeoutsFollowProviderPropagation(t *testing.T) {
	cfg := &config.Config{Acme: config.Acme{
		Enabled: true, Email: "ops@example.org", ConfigDir: t.TempDir(), Challenge: config.ChallengeDNS,
		DNS: config.AcmeDNS{Provider: "cloudflare", PropagationSeconds: 60, PropagationSecondsByProvider: map[string]int{"zonewright": 10, "slowdns": 600}},
	}}
	m := &Manager{log: slog.New(slog.NewTextHandler(io.Discard, nil)), cfg: cfg}
	if got, want := m.IssueTimeout("dns", "zonewright"), 130*time.Second; got != want {
		t.Errorf("zonewright issue timeout = %s, want %s", got, want)
	}
	if got, want := m.IssueTimeout("dns", ""), 180*time.Second; got != want {
		t.Errorf("default provider issue timeout = %s, want %s", got, want)
	}
	if got, want := m.RenewTimeout(), 720*time.Second; got != want {
		t.Errorf("renew timeout = %s, want %s (the longest wait + 120s)", got, want)
	}
}

// With a config-referenced credential, /status says which provider account it
// serves and from where, and a request naming that provider explicitly is not
// refused for lacking a stored credential.
func TestConfigCredentialsReported(t *testing.T) {
	t.Setenv("NP_TEST_DNS_CREDS2", "dns_cloudflare_api_token = X")
	cfg := &config.Config{Acme: config.Acme{
		Enabled: true, Email: "ops@example.org", ConfigDir: t.TempDir(), Challenge: config.ChallengeDNS,
		DNS: config.AcmeDNS{Provider: "cloudflare", CredentialsEnv: "NP_TEST_DNS_CREDS2"},
	}}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	m := &Manager{log: logger, cfg: cfg}
	m.acme.Store(acme.NewWithRun(cfg.Acme, nil, t.TempDir(), logger, func(context.Context, []string, string, ...string) (string, error) { return "", nil }))

	st := m.AcmeStatus()
	if st.DNSConfigCredentials == nil || st.DNSConfigCredentials.Provider != "cloudflare" ||
		st.DNSConfigCredentials.Account != "default" || st.DNSConfigCredentials.Source != "env" {
		t.Fatalf("dns_config_credentials = %+v", st.DNSConfigCredentials)
	}
	if !m.HasAcmeCredentials("cloudflare", "") {
		t.Error("the config credential must count for the default provider")
	}
	if m.HasAcmeCredentials("zonewright", "") || m.HasAcmeCredentials("cloudflare", "edge") {
		t.Error("the config credential must not count for other providers or named accounts")
	}
}
