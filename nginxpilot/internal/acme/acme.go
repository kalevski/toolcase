// Package acme is a thin, testable wrapper around the certbot binary: it issues,
// renews and deletes certificates for managed/consumed TLS. It mirrors
// internal/nginxctl's RunFunc injection so the constructed argv can be asserted
// in tests without a real certbot.
//
// Credentials for DNS-01 are resolved at issue time in this order: explicit
// config refs (acme.dns.credentials_env / _file) → the runtime credentials
// store (credstore) → ambient SDK env (route53/google). Credentials never
// appear in argv: file-based creds are passed by path, SDK creds via process
// env.
package acme

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/credstore"
	"log/slog"
)

// RunFunc runs certbot with extra environment and returns combined output.
// env entries ("KEY=VALUE") are appended to os.Environ() (nil for the common
// flag-credential case). Injected so tests assert argv without a real certbot.
type RunFunc func(ctx context.Context, env []string, name string, args ...string) (string, error)

// Client drives certbot for one daemon configuration.
type Client struct {
	cfg     config.Acme
	store   *credstore.Store // runtime credentials (may be nil)
	dataDir string           // holds acme/config-credentials/ (the config-referenced credential)
	run     RunFunc
	log     *slog.Logger
	plugins pluginProbe
}

// New builds a Client. store may be nil (only config-ref / ambient creds then).
func New(cfg config.Acme, store *credstore.Store, dataDir string, log *slog.Logger) *Client {
	return &Client{cfg: cfg, store: store, dataDir: dataDir, run: defaultRun, log: log}
}

// NewWithRun builds a Client with an injected RunFunc, so out-of-package tests
// (e.g. the manager's renewal scheduler) can assert certbot argv without a
// real certbot binary — the same seam acme's own tests use.
func NewWithRun(cfg config.Acme, store *credstore.Store, dataDir string, log *slog.Logger, run RunFunc) *Client {
	c := New(cfg, store, dataDir, log)
	c.run = run
	return c
}

func defaultRun(ctx context.Context, env []string, name string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	if len(env) > 0 {
		cmd.Env = append(os.Environ(), env...)
	}
	out, err := cmd.CombinedOutput()
	return string(out), err
}

// CertName derives the certbot --cert-name (and live/<name>/ dir) from the first
// domain, stripping a leading "*." so a wildcard cert lands under its base name.
func CertName(domains []string) string {
	if len(domains) == 0 {
		return ""
	}
	return strings.TrimPrefix(domains[0], "*.")
}

// IssueOptions carries the per-call overrides for Issue. A zero-value field falls
// back to the daemon config: Email → acme.email, Provider → acme.dns.provider.
// Staging is the per-call staging flag (OR'd with acme.staging in serverArgs).
type IssueOptions struct {
	// Email overrides acme.email for this cert's ACME account registration (-m).
	Email string
	// Provider overrides acme.dns.provider — the certbot DNS plugin (--dns-<provider>)
	// and which stored credential is used. DNS-01 only; ignored for the
	// http/nginx/standalone challenges.
	Provider string
	// Account picks which of that provider's stored credentials to use. Empty
	// means credstore.DefaultAccount, which is the legacy single-credential slot.
	Account string
	Staging bool
	// Challenge picks the challenge for this issuance (dns | http | nginx |
	// standalone). Empty means acme.challenge; anything else must be in
	// acme.challenges. certbot records it in the cert's renewal config, so
	// renewals keep using it.
	Challenge string
	// DryRun runs certbot with --dry-run: the whole ACME exchange (account,
	// order, challenge, validation) against the staging directory — or the
	// configured acme.server — without saving a certificate or touching any
	// lineage. It proves a challenge and its credentials work at no cost to
	// production rate limits.
	DryRun bool
}

// EffectiveChallenge resolves a requested challenge against the config: empty
// → acme.challenge; a challenge outside acme.challenges is an error.
func EffectiveChallenge(cfg config.Acme, requested string) (string, error) {
	if requested == "" {
		return cfg.ChallengeOrDefault(), nil
	}
	if !cfg.AllowsChallenge(requested) {
		return "", fmt.Errorf("challenge %q is not allowed here (acme.challenges: %s)", requested, strings.Join(cfg.ChallengesOrDefault(), ", "))
	}
	return requested, nil
}

// Issue runs `certbot certonly` for one cert (>=1 domains; wildcards only with
// the dns challenge). name defaults to CertName(domains) when empty. opts carries
// per-call overrides (email / DNS provider / staging) that fall back to config.
func (c *Client) Issue(ctx context.Context, name string, domains []string, opts IssueOptions) (string, error) {
	if len(domains) == 0 {
		return "", fmt.Errorf("at least one domain is required")
	}
	if name == "" {
		name = CertName(domains)
	}
	challenge, err := EffectiveChallenge(c.cfg, opts.Challenge)
	if err != nil {
		return "", err
	}
	if challenge != config.ChallengeDNS {
		for _, d := range domains {
			if strings.HasPrefix(d, "*.") {
				return "", fmt.Errorf("wildcard domain %q requires challenge: dns (current: %s)", d, challenge)
			}
		}
	}

	email := opts.Email
	if email == "" {
		email = c.cfg.Email
	}

	args := c.baseArgs()
	args = append(args, "certonly", "--agree-tos", "-m", email, "--cert-name", name)
	args = append(args, c.serverArgs(opts.Staging)...)
	if opts.DryRun {
		args = append(args, "--dry-run")
	}

	chArgs, env, cleanup, err := c.challengeArgs(challenge, opts.Provider, opts.Account)
	if err != nil {
		return "", err
	}
	if cleanup != nil {
		defer cleanup()
	}
	args = append(args, chArgs...)
	for _, d := range domains {
		args = append(args, "-d", d)
	}

	out, err := c.run(ctx, env, "certbot", args...)
	if err != nil {
		return out, fmt.Errorf("certbot certonly failed: %s", lastLines(out, err))
	}
	return out, nil
}

// Renew force-renews one cert by name (the authenticator + creds path are taken
// from the stored renewal config, so the credential must still exist on disk —
// the credstore path is stable; a config-env tmp path is not).
func (c *Client) Renew(ctx context.Context, name string) (string, error) {
	if _, err := c.RefreshConfigCredentials(); err != nil {
		return "", err
	}
	args := c.baseArgs()
	args = append(args, "renew", "--cert-name", name, "--force-renewal", "--no-random-sleep-on-renew")
	out, err := c.run(ctx, nil, "certbot", args...)
	if err != nil {
		return out, fmt.Errorf("certbot renew failed: %s", lastLines(out, err))
	}
	return out, nil
}

// RevokeReasons are the reasons certbot's --reason accepts (RFC 5280 codes
// Let's Encrypt honours), in certbot's spelling.
var RevokeReasons = []string{"unspecified", "keycompromise", "affiliationchanged", "superseded", "cessationofoperation"}

// ValidRevokeReason reports whether r is one of RevokeReasons.
func ValidRevokeReason(r string) bool {
	for _, v := range RevokeReasons {
		if r == v {
			return true
		}
	}
	return false
}

// Revoke revokes one certbot lineage at its CA (`certbot revoke --cert-name`).
// The request goes to the directory that issued the cert: the `server` recorded
// in renewal/<name>.conf, so a staging or acme.server lineage is revoked where
// it came from; only when that file has none does it fall back to the daemon's
// own server flags. deleteAfter also removes the lineage (--delete-after-revoke);
// otherwise it stays on disk, still served but revoked.
func (c *Client) Revoke(ctx context.Context, name, reason string, deleteAfter bool) (string, error) {
	if reason == "" {
		reason = "unspecified"
	}
	if !ValidRevokeReason(reason) {
		return "", fmt.Errorf("invalid revoke reason %q (one of %s)", reason, strings.Join(RevokeReasons, ", "))
	}
	args := c.baseArgs()
	args = append(args, "revoke", "--cert-name", name, "--reason", reason)
	if server := c.lineageServer(name); server != "" {
		args = append(args, "--server", server)
	} else {
		args = append(args, c.serverArgs(false)...)
	}
	if deleteAfter {
		args = append(args, "--delete-after-revoke")
	} else {
		args = append(args, "--no-delete-after-revoke")
	}
	out, err := c.run(ctx, nil, "certbot", args...)
	if err != nil {
		return out, fmt.Errorf("certbot revoke failed: %s", lastLines(out, err))
	}
	return out, nil
}

// lineageServer reads the ACME directory a lineage was issued from out of
// certbot's renewal/<name>.conf ("server = https://…"); "" when the file or the
// key is missing.
func (c *Client) lineageServer(name string) string {
	data, err := os.ReadFile(filepath.Join(c.cfg.ConfigDirOrDefault(), "renewal", name+".conf"))
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(data), "\n") {
		key, value, ok := strings.Cut(line, "=")
		if ok && strings.TrimSpace(key) == "server" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

// RenewDue renews every cert near expiry (`certbot renew`).
func (c *Client) RenewDue(ctx context.Context) (string, error) {
	if _, err := c.RefreshConfigCredentials(); err != nil {
		return "", err
	}
	args := c.baseArgs()
	args = append(args, "renew", "--no-random-sleep-on-renew")
	out, err := c.run(ctx, nil, "certbot", args...)
	if err != nil {
		return out, fmt.Errorf("certbot renew failed: %s", lastLines(out, err))
	}
	return out, nil
}

// Delete removes a cert (`certbot delete --cert-name <name>`).
func (c *Client) Delete(ctx context.Context, name string) (string, error) {
	args := c.baseArgs()
	args = append(args, "delete", "--cert-name", name)
	out, err := c.run(ctx, nil, "certbot", args...)
	if err != nil {
		return out, fmt.Errorf("certbot delete failed: %s", lastLines(out, err))
	}
	return out, nil
}

// baseArgs are shared by every certbot invocation: non-interactive and the
// daemon-writable config/work/logs dirs.
func (c *Client) baseArgs() []string {
	cfgDir := c.cfg.ConfigDirOrDefault()
	return []string{
		"--non-interactive",
		"--config-dir", cfgDir,
		"--work-dir", filepath.Join(cfgDir, ".work"),
		"--logs-dir", filepath.Join(cfgDir, ".logs"),
	}
}

// serverArgs selects the ACME endpoint: an explicit server URL wins, else
// --staging when requested (per-call or config default).
func (c *Client) serverArgs(staging bool) []string {
	if c.cfg.Server != "" {
		return []string{"--server", c.cfg.Server}
	}
	if staging || c.cfg.Staging {
		return []string{"--staging"}
	}
	return nil
}

// challengeArgs builds the authenticator flags + any process env for one
// challenge, plus a cleanup func that removes a materialized config-env creds
// file.
func (c *Client) challengeArgs(challenge, provider, account string) (args []string, env []string, cleanup func(), err error) {
	switch challenge {
	case config.ChallengeHTTP:
		return []string{"--webroot", "-w", c.cfg.HTTP.Webroot}, nil, nil, nil
	case config.ChallengeNginx:
		return []string{"-a", "nginx"}, nil, nil, nil
	case config.ChallengeStandalone:
		return []string{"--standalone"}, nil, nil, nil
	case config.ChallengeDNS:
		return c.dnsArgs(provider, account)
	default:
		return nil, nil, nil, fmt.Errorf("unknown challenge %q", challenge)
	}
}

// dnsArgs assembles --dns-<provider> plus the credentials flag/env, resolving
// the credential source (config ref → store → ambient). providerOverride wins
// over acme.dns.provider when non-empty (so a caller can pick which stored
// credential certbot uses for this issuance).
func (c *Client) dnsArgs(providerOverride, account string) (args []string, env []string, cleanup func(), err error) {
	provider := providerOverride
	if provider == "" {
		provider = c.cfg.DNS.Provider
	}
	// --authenticator dns-<provider> selects any installed DNS plugin. The
	// --dns-<provider> shortcut only exists for certbot's own bundled plugins:
	// for a third-party one (certbot-dns-zonewright) argparse reads it as an
	// ambiguous abbreviation of --dns-<provider>-credentials / -propagation-seconds
	// and certbot refuses to start.
	args = []string{"--authenticator", "dns-" + provider}

	credPath, cleanup, err := c.resolveCredPath(provider, account)
	if err != nil {
		return nil, nil, nil, err
	}

	mechanism := credstore.Mechanism(provider)
	if credPath != "" {
		switch mechanism {
		case credstore.MechanismAWS:
			env = append(env, "AWS_SHARED_CREDENTIALS_FILE="+credPath)
		case credstore.MechanismGoogle:
			env = append(env, "GOOGLE_APPLICATION_CREDENTIALS="+credPath)
			args = append(args, "--dns-google-credentials", credPath)
		default: // MechanismFlag
			args = append(args, "--dns-"+provider+"-credentials", credPath)
		}
	}

	// propagation-seconds is a flag-credential plugin convention; route53/google
	// do not accept it.
	if mechanism == credstore.MechanismFlag {
		args = append(args, "--dns-"+provider+"-propagation-seconds", strconv.Itoa(c.cfg.DNS.PropagationSecondsFor(provider)))
	}
	return args, env, cleanup, nil
}

// resolveCredPath returns the on-disk credentials path for the provider, or ""
// to fall back to ambient SDK env. A config-referenced credential
// (acme.dns.credentials_env / credentials_file) belongs to acme.dns.provider's
// default account only: a request naming another provider, or a named account,
// always uses the credstore. The config credential is materialized at a stable
// path (ConfigCredentialsPath), never a temp file, because certbot records the
// path in the lineage's renewal config and every renewal re-reads it.
func (c *Client) resolveCredPath(provider, account string) (path string, cleanup func(), err error) {
	if c.UsesConfigCredentials(provider, account) {
		path, err := c.RefreshConfigCredentials()
		return path, nil, err
	}
	if c.store != nil {
		if r, ok := c.store.Get(provider, account); ok {
			return r.Path, nil, nil
		}
	}
	return "", nil, nil
}

// HasConfigCredentials reports whether acme.dns references a credential
// (credentials_env or credentials_file).
func (c *Client) HasConfigCredentials() bool {
	return c.cfg.DNS.CredentialsEnv != "" || c.cfg.DNS.CredentialsFile != ""
}

// UsesConfigCredentials reports whether this provider/account pair is the one
// the config-referenced credential is for.
func (c *Client) UsesConfigCredentials(provider, account string) bool {
	return c.HasConfigCredentials() && provider == c.cfg.DNS.Provider &&
		credstore.NormalizeAccount(account) == credstore.DefaultAccount
}

// ConfigCredentialsPath is where the config-referenced credential is written:
// <data_dir>/acme/config-credentials/<provider>.ini. Stable across runs, so a
// lineage issued with it renews with it.
func (c *Client) ConfigCredentialsPath() string {
	return filepath.Join(c.dataDir, "acme", "config-credentials", c.cfg.DNS.Provider+".ini")
}

// RefreshConfigCredentials (re)writes the config-referenced credential to
// ConfigCredentialsPath (0600, atomically) from its current env/file value and
// returns the path; "" when none is configured. Called before every issuance
// that uses it and before every renewal, so a rotated secret reaches certbot
// without re-issuing.
func (c *Client) RefreshConfigCredentials() (string, error) {
	if !c.HasConfigCredentials() {
		return "", nil
	}
	body, err := config.ResolveSecret(c.cfg.DNS.CredentialsEnv, c.cfg.DNS.CredentialsFile)
	if err != nil {
		return "", fmt.Errorf("resolve acme.dns credentials: %w", err)
	}
	path := c.ConfigCredentialsPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return "", err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".creds-*")
	if err != nil {
		return "", err
	}
	name := tmp.Name()
	defer os.Remove(name)
	if err := tmp.Chmod(0o600); err != nil {
		tmp.Close()
		return "", err
	}
	if _, err := tmp.WriteString(body); err != nil {
		tmp.Close()
		return "", err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return "", err
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}
	if err := os.Rename(name, path); err != nil {
		return "", err
	}
	return path, nil
}

// lastLines collapses certbot output to a short single line for error messages,
// preferring lines that look like an error.
func lastLines(out string, fallback error) string {
	out = strings.TrimSpace(out)
	if out == "" {
		if fallback != nil {
			return fallback.Error()
		}
		return "no output"
	}
	lines := strings.Split(out, "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		l := strings.TrimSpace(lines[i])
		low := strings.ToLower(l)
		if strings.Contains(low, "error") || strings.Contains(low, "fail") || strings.Contains(low, "problem") {
			return truncate(l, 400)
		}
	}
	// else last non-empty line
	for i := len(lines) - 1; i >= 0; i-- {
		if l := strings.TrimSpace(lines[i]); l != "" {
			return truncate(l, 400)
		}
	}
	return truncate(out, 400)
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n-1]) + "…"
}
