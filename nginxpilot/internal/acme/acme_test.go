package acme

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/credstore"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// capture records the last certbot invocation for assertions.
type capture struct {
	env  []string
	name string
	args []string
}

func newClient(t *testing.T, cfg config.Acme, store *credstore.Store) (*Client, *capture) {
	t.Helper()
	cap := &capture{}
	run := func(_ context.Context, env []string, name string, args ...string) (string, error) {
		cap.env, cap.name, cap.args = env, name, args
		return "", nil
	}
	return &Client{cfg: cfg, store: store, dataDir: t.TempDir(), run: run, log: testLogger()}, cap
}

func hasFlagPair(args []string, flag, val string) bool {
	for i := 0; i+1 < len(args); i++ {
		if args[i] == flag && args[i+1] == val {
			return true
		}
	}
	return false
}

func contains(args []string, v string) bool {
	for _, a := range args {
		if a == v {
			return true
		}
	}
	return false
}

func TestIssueDNSDigitalOceanArgv(t *testing.T) {
	store := credstore.New(t.TempDir())
	if err := store.Set("digitalocean", "", []byte("dns_digitalocean_token = SECRET123\n")); err != nil {
		t.Fatal(err)
	}
	cfg := config.Acme{
		Enabled: true, Email: "a@b.com", Challenge: config.ChallengeDNS,
		ConfigDir: t.TempDir(),
		DNS:       config.AcmeDNS{Provider: "digitalocean", PropagationSeconds: 45},
	}
	c, cap := newClient(t, cfg, store)

	if _, err := c.Issue(context.Background(), "", []string{"*.example.com", "example.com"}, IssueOptions{Staging: true}); err != nil {
		t.Fatalf("Issue: %v", err)
	}

	if cap.name != "certbot" {
		t.Fatalf("binary = %q, want certbot", cap.name)
	}
	for _, want := range []string{"certonly", "--staging", "--cert-name", "example.com"} {
		if !contains(cap.args, want) {
			t.Errorf("argv missing %q: %v", want, cap.args)
		}
	}
	if !hasFlagPair(cap.args, "--authenticator", "dns-digitalocean") || contains(cap.args, "--dns-digitalocean") {
		t.Errorf("plugin must be selected with --authenticator dns-digitalocean: %v", cap.args)
	}
	if !hasFlagPair(cap.args, "--dns-digitalocean-propagation-seconds", "45") {
		t.Errorf("propagation-seconds not 45: %v", cap.args)
	}
	if !hasFlagPair(cap.args, "-d", "*.example.com") || !hasFlagPair(cap.args, "-d", "example.com") {
		t.Errorf("domains missing: %v", cap.args)
	}
	// credentials are passed by PATH; the secret body must never be in argv.
	joined := strings.Join(cap.args, " ")
	if strings.Contains(joined, "SECRET123") {
		t.Errorf("credential secret leaked into argv: %v", cap.args)
	}
	if !contains(cap.args, "--dns-digitalocean-credentials") {
		t.Errorf("credentials flag missing: %v", cap.args)
	}
}

func TestIssueWildcardRequiresDNS(t *testing.T) {
	cfg := config.Acme{
		Enabled: true, Email: "a@b.com", Challenge: config.ChallengeHTTP,
		ConfigDir: t.TempDir(), HTTP: config.AcmeHTTP{Webroot: "/var/www/acme"},
	}
	c, _ := newClient(t, cfg, nil)
	if _, err := c.Issue(context.Background(), "", []string{"*.example.com"}, IssueOptions{}); err == nil {
		t.Fatal("expected error for wildcard with http challenge")
	}
}

func TestIssueHTTPWebrootArgv(t *testing.T) {
	cfg := config.Acme{
		Enabled: true, Email: "a@b.com", Challenge: config.ChallengeHTTP,
		ConfigDir: t.TempDir(), HTTP: config.AcmeHTTP{Webroot: "/var/www/acme"},
	}
	c, cap := newClient(t, cfg, nil)
	if _, err := c.Issue(context.Background(), "site", []string{"example.com"}, IssueOptions{}); err != nil {
		t.Fatalf("Issue: %v", err)
	}
	if !hasFlagPair(cap.args, "-w", "/var/www/acme") || !contains(cap.args, "--webroot") {
		t.Errorf("webroot args missing: %v", cap.args)
	}
	if contains(cap.args, "--staging") {
		t.Errorf("unexpected --staging: %v", cap.args)
	}
	if contains(cap.args, "--dry-run") {
		t.Errorf("unexpected --dry-run: %v", cap.args)
	}
}

// DryRun adds certbot's --dry-run to an otherwise identical certonly: against
// staging by default, against acme.server when one is configured (certbot runs
// a dry run against any non-production directory it is pointed at).
func TestIssueDryRunArgv(t *testing.T) {
	cfg := config.Acme{
		Enabled: true, Email: "a@b.com", Challenge: config.ChallengeHTTP,
		ConfigDir: t.TempDir(), HTTP: config.AcmeHTTP{Webroot: "/var/www/acme"},
	}
	c, cap := newClient(t, cfg, nil)
	if _, err := c.Issue(context.Background(), "wmk-test-1", []string{"t1.example.com"}, IssueOptions{DryRun: true, Staging: true}); err != nil {
		t.Fatalf("Issue: %v", err)
	}
	for _, want := range []string{"certonly", "--dry-run", "--staging", "--webroot"} {
		if !contains(cap.args, want) {
			t.Errorf("argv missing %q: %v", want, cap.args)
		}
	}
	if !hasFlagPair(cap.args, "--cert-name", "wmk-test-1") {
		t.Errorf("cert-name missing: %v", cap.args)
	}

	cfg.Server = "https://localhost:14000/dir"
	c, cap = newClient(t, cfg, nil)
	if _, err := c.Issue(context.Background(), "", []string{"t2.example.com"}, IssueOptions{DryRun: true}); err != nil {
		t.Fatalf("Issue: %v", err)
	}
	if !contains(cap.args, "--dry-run") || !hasFlagPair(cap.args, "--server", cfg.Server) || contains(cap.args, "--staging") {
		t.Errorf("dry run against acme.server: %v", cap.args)
	}
}

func TestIssueRoute53UsesEnvNotFlag(t *testing.T) {
	store := credstore.New(t.TempDir())
	if err := store.Set("route53", "", []byte("[default]\naws_access_key_id = K\naws_secret_access_key = S\n")); err != nil {
		t.Fatal(err)
	}
	cfg := config.Acme{
		Enabled: true, Email: "a@b.com", Challenge: config.ChallengeDNS,
		ConfigDir: t.TempDir(), DNS: config.AcmeDNS{Provider: "route53"},
	}
	c, cap := newClient(t, cfg, store)
	if _, err := c.Issue(context.Background(), "", []string{"example.com"}, IssueOptions{}); err != nil {
		t.Fatalf("Issue: %v", err)
	}
	foundEnv := false
	for _, e := range cap.env {
		if strings.HasPrefix(e, "AWS_SHARED_CREDENTIALS_FILE=") {
			foundEnv = true
		}
	}
	if !foundEnv {
		t.Errorf("route53 should pass AWS_SHARED_CREDENTIALS_FILE env: %v", cap.env)
	}
	if contains(cap.args, "--dns-route53-credentials") {
		t.Errorf("route53 must not use a --credentials flag: %v", cap.args)
	}
	if contains(cap.args, "--dns-route53-propagation-seconds") {
		t.Errorf("route53 must not use propagation-seconds: %v", cap.args)
	}
}

// TestIssueOptionOverrides asserts the per-call Email + Provider overrides win
// over the config defaults: a different ACME account email and a different DNS
// plugin (with that provider's stored credential), not the configured ones.
func TestIssueOptionOverrides(t *testing.T) {
	store := credstore.New(t.TempDir())
	if err := store.Set("cloudflare", "", []byte("dns_cloudflare_api_token = CFTOKEN\n")); err != nil {
		t.Fatal(err)
	}
	cfg := config.Acme{
		Enabled: true, Email: "config@b.com", Challenge: config.ChallengeDNS,
		ConfigDir: t.TempDir(),
		DNS:       config.AcmeDNS{Provider: "digitalocean"},
	}
	c, cap := newClient(t, cfg, store)

	opts := IssueOptions{Email: "ops@example.org", Provider: "cloudflare"}
	if _, err := c.Issue(context.Background(), "", []string{"example.com"}, opts); err != nil {
		t.Fatalf("Issue: %v", err)
	}
	if !hasFlagPair(cap.args, "-m", "ops@example.org") {
		t.Errorf("override email not used: %v", cap.args)
	}
	if hasFlagPair(cap.args, "-m", "config@b.com") {
		t.Errorf("config email should be overridden: %v", cap.args)
	}
	if !hasFlagPair(cap.args, "--authenticator", "dns-cloudflare") || hasFlagPair(cap.args, "--authenticator", "dns-digitalocean") {
		t.Errorf("override provider not used: %v", cap.args)
	}
	if !contains(cap.args, "--dns-cloudflare-credentials") {
		t.Errorf("cloudflare stored credential not passed: %v", cap.args)
	}
	if strings.Contains(strings.Join(cap.args, " "), "CFTOKEN") {
		t.Errorf("secret leaked into argv: %v", cap.args)
	}
}

func TestCertName(t *testing.T) {
	if got := CertName([]string{"*.example.com", "example.com"}); got != "example.com" {
		t.Errorf("CertName = %q, want example.com", got)
	}
	if got := CertName([]string{"a.example.com"}); got != "a.example.com" {
		t.Errorf("CertName = %q", got)
	}
}

// Revoke goes to the directory that issued the lineage (renewal/<name>.conf),
// passes the reason, and never deletes unless asked.
func TestRevokeArgv(t *testing.T) {
	cfgDir := t.TempDir()
	cfg := config.Acme{Enabled: true, Email: "a@b.com", ConfigDir: cfgDir, Staging: true}
	if err := os.MkdirAll(filepath.Join(cfgDir, "renewal"), 0o755); err != nil {
		t.Fatal(err)
	}
	conf := "version = 2.11.0\narchive_dir = /x\n[renewalparams]\nserver = https://acme-staging-v02.api.letsencrypt.org/directory\n"
	if err := os.WriteFile(filepath.Join(cfgDir, "renewal", "wmk-1-g1.conf"), []byte(conf), 0o644); err != nil {
		t.Fatal(err)
	}
	c, cap := newClient(t, cfg, nil)

	if _, err := c.Revoke(context.Background(), "wmk-1-g1", "", false); err != nil {
		t.Fatalf("Revoke: %v", err)
	}
	if !contains(cap.args, "revoke") || !hasFlagPair(cap.args, "--cert-name", "wmk-1-g1") ||
		!hasFlagPair(cap.args, "--reason", "unspecified") || !contains(cap.args, "--no-delete-after-revoke") {
		t.Errorf("revoke argv: %v", cap.args)
	}
	if !hasFlagPair(cap.args, "--server", "https://acme-staging-v02.api.letsencrypt.org/directory") || contains(cap.args, "--staging") {
		t.Errorf("revoke must target the lineage's own server: %v", cap.args)
	}

	if _, err := c.Revoke(context.Background(), "other", "superseded", true); err != nil {
		t.Fatalf("Revoke: %v", err)
	}
	if !contains(cap.args, "--delete-after-revoke") || !hasFlagPair(cap.args, "--reason", "superseded") || !contains(cap.args, "--staging") {
		t.Errorf("no renewal conf → daemon server flags; delete honoured: %v", cap.args)
	}

	cap.args = nil
	if _, err := c.Revoke(context.Background(), "wmk-1-g1", "because", false); err == nil || cap.args != nil {
		t.Errorf("an unknown reason must be refused before certbot runs (err=%v argv=%v)", err, cap.args)
	}
}

// A provider's own propagation entry wins over the global value in the argv.
func TestIssuePropagationPerProvider(t *testing.T) {
	store := credstore.New(t.TempDir())
	for _, p := range []string{"zonewright", "cloudflare"} {
		if err := store.Set(p, "", []byte("k = v\n")); err != nil {
			t.Fatal(err)
		}
	}
	cfg := config.Acme{
		Enabled: true, Email: "a@b.com", Challenge: config.ChallengeDNS, ConfigDir: t.TempDir(),
		DNS: config.AcmeDNS{Provider: "cloudflare", PropagationSeconds: 45, PropagationSecondsByProvider: map[string]int{"zonewright": 10}},
	}
	c, cap := newClient(t, cfg, store)
	if _, err := c.Issue(context.Background(), "", []string{"example.com"}, IssueOptions{Provider: "zonewright"}); err != nil {
		t.Fatalf("Issue: %v", err)
	}
	if !hasFlagPair(cap.args, "--dns-zonewright-propagation-seconds", "10") {
		t.Errorf("zonewright wait not 10: %v", cap.args)
	}
	if _, err := c.Issue(context.Background(), "", []string{"example.com"}, IssueOptions{}); err != nil {
		t.Fatalf("Issue: %v", err)
	}
	if !hasFlagPair(cap.args, "--dns-cloudflare-propagation-seconds", "45") {
		t.Errorf("default provider must fall back to the global 45: %v", cap.args)
	}
}

func flagValue(args []string, flag string) string {
	for i := 0; i+1 < len(args); i++ {
		if args[i] == flag {
			return args[i+1]
		}
	}
	return ""
}

// A config-referenced credential serves only acme.dns.provider's default
// account, lives at a stable 0600 path that survives the run (certbot's renewal
// config points at it), and is rewritten from the current secret before every
// renewal.
func TestConfigCredentialsScopedAndStable(t *testing.T) {
	t.Setenv("NP_TEST_DNS_CREDS", "dns_cloudflare_api_token = FIRST")
	store := credstore.New(t.TempDir())
	if err := store.Set("zonewright", "", []byte("dns_zonewright_token = STORE\n")); err != nil {
		t.Fatal(err)
	}
	if err := store.Set("cloudflare", "edge", []byte("dns_cloudflare_api_token = NAMED\n")); err != nil {
		t.Fatal(err)
	}
	cfg := config.Acme{
		Enabled: true, Email: "a@b.com", Challenge: config.ChallengeDNS, ConfigDir: t.TempDir(),
		DNS: config.AcmeDNS{Provider: "cloudflare", CredentialsEnv: "NP_TEST_DNS_CREDS"},
	}
	c, cap := newClient(t, cfg, store)

	if _, err := c.Issue(context.Background(), "", []string{"example.com"}, IssueOptions{}); err != nil {
		t.Fatalf("Issue: %v", err)
	}
	path := flagValue(cap.args, "--dns-cloudflare-credentials")
	if path != c.ConfigCredentialsPath() {
		t.Fatalf("default provider must use the stable config path %q, got %q", c.ConfigCredentialsPath(), path)
	}
	fi, err := os.Stat(path)
	if err != nil {
		t.Fatalf("config credential must outlive the run (renewals re-read it): %v", err)
	}
	if fi.Mode().Perm() != 0o600 {
		t.Errorf("config credential mode = %v, want 0600", fi.Mode().Perm())
	}

	if _, err := c.Issue(context.Background(), "", []string{"example.org"}, IssueOptions{Provider: "zonewright"}); err != nil {
		t.Fatalf("Issue zonewright: %v", err)
	}
	if got := flagValue(cap.args, "--dns-zonewright-credentials"); got == "" || got == c.ConfigCredentialsPath() {
		t.Errorf("another provider must use its stored credential, got %q", got)
	}
	if _, err := c.Issue(context.Background(), "", []string{"example.net"}, IssueOptions{Account: "edge"}); err != nil {
		t.Fatalf("Issue named account: %v", err)
	}
	if got := flagValue(cap.args, "--dns-cloudflare-credentials"); got == c.ConfigCredentialsPath() {
		t.Errorf("a named account must use its stored credential, got the config one")
	}

	t.Setenv("NP_TEST_DNS_CREDS", "dns_cloudflare_api_token = ROTATED")
	if _, err := c.Renew(context.Background(), "example.com"); err != nil {
		t.Fatalf("Renew: %v", err)
	}
	body, _ := os.ReadFile(path)
	if !strings.Contains(string(body), "ROTATED") {
		t.Errorf("renewal must refresh the config credential, file has %q", body)
	}
	if !c.UsesConfigCredentials("cloudflare", "") || c.UsesConfigCredentials("cloudflare", "edge") || c.UsesConfigCredentials("zonewright", "") {
		t.Errorf("UsesConfigCredentials scope wrong")
	}
}
