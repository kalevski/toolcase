package acme

import (
	"context"
	"io"
	"log/slog"
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
	if err := store.Set("digitalocean", []byte("dns_digitalocean_token = SECRET123\n")); err != nil {
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
	for _, want := range []string{"certonly", "--dns-digitalocean", "--staging", "--cert-name", "example.com"} {
		if !contains(cap.args, want) {
			t.Errorf("argv missing %q: %v", want, cap.args)
		}
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
}

func TestIssueRoute53UsesEnvNotFlag(t *testing.T) {
	store := credstore.New(t.TempDir())
	if err := store.Set("route53", []byte("[default]\naws_access_key_id = K\naws_secret_access_key = S\n")); err != nil {
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
	if err := store.Set("cloudflare", []byte("dns_cloudflare_api_token = CFTOKEN\n")); err != nil {
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
	if !contains(cap.args, "--dns-cloudflare") || contains(cap.args, "--dns-digitalocean") {
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
