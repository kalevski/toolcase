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
	dataDir string           // for the 0600 tmp creds file (config-env path)
	run     RunFunc
	log     *slog.Logger
}

// New builds a Client. store may be nil (only config-ref / ambient creds then).
func New(cfg config.Acme, store *credstore.Store, dataDir string, log *slog.Logger) *Client {
	return &Client{cfg: cfg, store: store, dataDir: dataDir, run: defaultRun, log: log}
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
	// and which stored credential (credstore.Get(provider)) is used. DNS-01 only;
	// ignored for the http/nginx/standalone challenges.
	Provider string
	Staging  bool
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
	if c.cfg.ChallengeOrDefault() != config.ChallengeDNS {
		for _, d := range domains {
			if strings.HasPrefix(d, "*.") {
				return "", fmt.Errorf("wildcard domain %q requires challenge: dns (current: %s)", d, c.cfg.ChallengeOrDefault())
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

	chArgs, env, cleanup, err := c.challengeArgs(opts.Provider)
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
	args := c.baseArgs()
	args = append(args, "renew", "--cert-name", name, "--force-renewal", "--no-random-sleep-on-renew")
	out, err := c.run(ctx, nil, "certbot", args...)
	if err != nil {
		return out, fmt.Errorf("certbot renew failed: %s", lastLines(out, err))
	}
	return out, nil
}

// RenewDue renews every cert near expiry (`certbot renew`).
func (c *Client) RenewDue(ctx context.Context) (string, error) {
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

// challengeArgs builds the authenticator flags + any process env for the
// configured challenge, plus a cleanup func that removes a materialized
// config-env creds file.
func (c *Client) challengeArgs(provider string) (args []string, env []string, cleanup func(), err error) {
	switch c.cfg.ChallengeOrDefault() {
	case config.ChallengeHTTP:
		return []string{"--webroot", "-w", c.cfg.HTTP.Webroot}, nil, nil, nil
	case config.ChallengeNginx:
		return []string{"-a", "nginx"}, nil, nil, nil
	case config.ChallengeStandalone:
		return []string{"--standalone"}, nil, nil, nil
	case config.ChallengeDNS:
		return c.dnsArgs(provider)
	default:
		return nil, nil, nil, fmt.Errorf("unknown challenge %q", c.cfg.ChallengeOrDefault())
	}
}

// dnsArgs assembles --dns-<provider> plus the credentials flag/env, resolving
// the credential source (config ref → store → ambient). providerOverride wins
// over acme.dns.provider when non-empty (so a caller can pick which stored
// credential certbot uses for this issuance).
func (c *Client) dnsArgs(providerOverride string) (args []string, env []string, cleanup func(), err error) {
	provider := providerOverride
	if provider == "" {
		provider = c.cfg.DNS.Provider
	}
	args = []string{"--dns-" + provider}

	credPath, cleanup, err := c.resolveCredPath(provider)
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
		args = append(args, "--dns-"+provider+"-propagation-seconds", strconv.Itoa(c.cfg.DNS.PropagationSecondsOrDefault()))
	}
	return args, env, cleanup, nil
}

// resolveCredPath returns the on-disk credentials path for the provider, or ""
// to fall back to ambient SDK env. Order: config ref (materialized to a 0600
// tmp file) → credstore → none.
func (c *Client) resolveCredPath(provider string) (path string, cleanup func(), err error) {
	if c.cfg.DNS.CredentialsEnv != "" || c.cfg.DNS.CredentialsFile != "" {
		body, err := config.ResolveSecret(c.cfg.DNS.CredentialsEnv, c.cfg.DNS.CredentialsFile)
		if err != nil {
			return "", nil, fmt.Errorf("resolve acme.dns credentials: %w", err)
		}
		tmpDir := filepath.Join(c.dataDir, "tmp")
		if err := os.MkdirAll(tmpDir, 0o700); err != nil {
			return "", nil, err
		}
		f, err := os.CreateTemp(tmpDir, "acme-creds-*.ini")
		if err != nil {
			return "", nil, err
		}
		name := f.Name()
		if _, err := f.WriteString(body); err != nil {
			f.Close()
			os.Remove(name)
			return "", nil, err
		}
		if err := f.Chmod(0o600); err != nil {
			f.Close()
			os.Remove(name)
			return "", nil, err
		}
		if err := f.Close(); err != nil {
			os.Remove(name)
			return "", nil, err
		}
		return name, func() { os.Remove(name) }, nil
	}
	if c.store != nil {
		if r, ok := c.store.Get(provider); ok {
			return r.Path, nil, nil
		}
	}
	return "", nil, nil
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
