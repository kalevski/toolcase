package acme

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/credstore"
)

// A daemon that allows both challenges issues DNS-01 and HTTP-01 certs side by
// side, picking per request.
func mixedConfig(t *testing.T) config.Acme {
	return config.Acme{
		Enabled: true, Email: "a@b.com", ConfigDir: t.TempDir(),
		Challenge:  config.ChallengeDNS,
		Challenges: []string{config.ChallengeDNS, config.ChallengeHTTP},
		DNS:        config.AcmeDNS{Provider: "digitalocean", PropagationSeconds: 30},
		HTTP:       config.AcmeHTTP{Webroot: "/var/www/acme"},
	}
}

func TestIssuePerRequestChallenge(t *testing.T) {
	store := credstore.New(t.TempDir())
	if err := store.Set("zonewright", "webapp-mk", []byte("dns_zonewright_url = https://ns1.example.net:9053\ndns_zonewright_token = zwt_x\n")); err != nil {
		t.Fatal(err)
	}
	c, cap := newClient(t, mixedConfig(t), store)

	// Default (no challenge named) is acme.challenge: dns.
	if _, err := c.Issue(context.Background(), "", []string{"example.com"}, IssueOptions{}); err != nil {
		t.Fatalf("default issue: %v", err)
	}
	if !hasFlagPair(cap.args, "--authenticator", "dns-digitalocean") || contains(cap.args, "--webroot") {
		t.Fatalf("default should be dns: %v", cap.args)
	}

	// HTTP-01 on the same daemon.
	if _, err := c.Issue(context.Background(), "", []string{"shop.example.org"}, IssueOptions{Challenge: config.ChallengeHTTP}); err != nil {
		t.Fatalf("http issue: %v", err)
	}
	if !contains(cap.args, "--webroot") || !hasFlagPair(cap.args, "-w", "/var/www/acme") || strings.Contains(strings.Join(cap.args, " "), "dns-") {
		t.Fatalf("http args wrong: %v", cap.args)
	}

	// DNS-01 through another provider + account, with a wildcard.
	if _, err := c.Issue(context.Background(), "", []string{"*.example.com", "example.com"},
		IssueOptions{Challenge: config.ChallengeDNS, Provider: "zonewright", Account: "webapp-mk"}); err != nil {
		t.Fatalf("dns zonewright issue: %v", err)
	}
	// A third-party plugin is selected with --authenticator: the --dns-zonewright
	// shortcut does not exist and certbot rejects it as ambiguous.
	if !hasFlagPair(cap.args, "--authenticator", "dns-zonewright") || contains(cap.args, "--dns-zonewright") ||
		!contains(cap.args, "--dns-zonewright-credentials") {
		t.Fatalf("zonewright args missing: %v", cap.args)
	}
}

func TestIssueRefusesDisallowedChallenge(t *testing.T) {
	cfg := mixedConfig(t)
	cfg.Challenges = nil // only the default, dns
	c, cap := newClient(t, cfg, nil)
	if _, err := c.Issue(context.Background(), "", []string{"example.com"}, IssueOptions{Challenge: config.ChallengeHTTP}); err == nil {
		t.Fatal("http must be refused when acme.challenges does not allow it")
	}
	if cap.name != "" {
		t.Fatalf("certbot ran for a refused challenge: %v", cap.args)
	}
	if _, err := c.Issue(context.Background(), "", []string{"example.com"}, IssueOptions{Challenge: "carrier-pigeon"}); err == nil {
		t.Fatal("unknown challenge must be refused")
	}
}

func TestWildcardFollowsRequestedChallenge(t *testing.T) {
	c, _ := newClient(t, mixedConfig(t), nil)
	if _, err := c.Issue(context.Background(), "", []string{"*.example.com"}, IssueOptions{Challenge: config.ChallengeHTTP}); err == nil {
		t.Fatal("a wildcard over http must be refused even when dns is the daemon default")
	}
}

func TestParseDNSPlugins(t *testing.T) {
	out := `Saving debug log to /var/log/letsencrypt/letsencrypt.log
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
* dns-cloudflare
Description: Obtain certificates using a DNS TXT record (if you are using
Cloudflare for DNS).
Interfaces: Authenticator, Plugin
Entry point: EntryPoint(name='dns-cloudflare', value='certbot_dns_cloudflare._internal.dns_cloudflare:Authenticator', group='certbot.plugins')

* dns-zonewright
Description: Obtain certificates using a DNS TXT record, if your domain's zone
is managed by zonewright.

* nginx
Description: Nginx Web Server plugin

* standalone
* webroot
`
	if got := parseDNSPlugins(out); !reflect.DeepEqual(got, []string{"cloudflare", "zonewright"}) {
		t.Fatalf("parseDNSPlugins = %v", got)
	}
	if got := parseDNSPlugins(""); got == nil || len(got) != 0 {
		t.Fatalf("empty output should give an empty, non-nil list: %#v", got)
	}
}

func TestProbeDNSPluginsOnceAndCached(t *testing.T) {
	calls := 0
	c := &Client{cfg: mixedConfig(t), dataDir: t.TempDir(), log: testLogger(), run: func(_ context.Context, _ []string, name string, args ...string) (string, error) {
		calls++
		if name != "certbot" || !contains(args, "plugins") {
			t.Errorf("unexpected invocation %s %v", name, args)
		}
		return "* dns-zonewright\n* webroot\n", nil
	}}
	if _, known, _ := c.DNSPlugins(); known {
		t.Fatal("known before the probe ran")
	}
	c.ProbeDNSPlugins(context.Background())
	c.ProbeDNSPlugins(context.Background())
	got, known, err := c.DNSPlugins()
	if !known || err != nil || !reflect.DeepEqual(got, []string{"zonewright"}) || calls != 1 {
		t.Fatalf("probe: %v %v %v, calls=%d", got, known, err, calls)
	}

	failing := &Client{cfg: mixedConfig(t), dataDir: t.TempDir(), log: testLogger(), run: func(context.Context, []string, string, ...string) (string, error) {
		return "", errors.New("exec: certbot: not found")
	}}
	failing.ProbeDNSPlugins(context.Background())
	if _, known, err := failing.DNSPlugins(); !known || err == nil {
		t.Fatalf("a failed probe should be known with an error: known=%v err=%v", known, err)
	}
}
