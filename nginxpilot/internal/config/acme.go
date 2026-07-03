package config

import (
	"fmt"
	"strings"
	"time"
)

// Challenge methods (acme.challenge) — how certbot proves domain control.
const (
	ChallengeDNS        = "dns"        // DNS-01 via a certbot DNS plugin (the only method that does wildcards)
	ChallengeHTTP       = "http"       // HTTP-01 via webroot
	ChallengeNginx      = "nginx"      // HTTP-01 via certbot's --nginx plugin
	ChallengeStandalone = "standalone" // HTTP-01 via certbot's own :80 listener
)

// Default managed-mode paths for the ACME block.
const (
	DefaultAcmeConfigDir          = "/etc/letsencrypt"
	DefaultAcmeWebroot            = "/var/www/acme"
	DefaultAcmeProvider           = "digitalocean"
	DefaultAcmePropagationSeconds = 60
)

// Acme configures certbot-driven certificate issuance (opt-in). When disabled
// (default) the cert issue/renew/delete endpoints return 501 and nothing
// changes. Manual upload (PUT /certs/{domain}) and the credentials store work
// independently of this flag.
type Acme struct {
	Enabled  bool   `yaml:"enabled"`
	Email    string `yaml:"email"`
	AgreeTOS bool   `yaml:"agree_tos"`
	Staging  bool   `yaml:"staging"`

	// Server overrides the ACME directory URL (default the CA's prod endpoint, or
	// its staging endpoint when Staging is true). Lets operators point at
	// ZeroSSL/Buypass/etc.
	Server string `yaml:"server"`

	// Challenge selects how domain control is proven (default "dns").
	Challenge string `yaml:"challenge"`

	DNS  AcmeDNS  `yaml:"dns"`
	HTTP AcmeHTTP `yaml:"http"`

	// ConfigDir is certbot's --config-dir (default /etc/letsencrypt). Its live/
	// subdir should equal tls.cert_dir so issued certs are discovered.
	ConfigDir string `yaml:"config_dir"`

	// Renewal configures the automatic renewal scheduler: the daemon checks
	// every check_interval and force-renews any certbot-managed cert whose
	// NotAfter is closer than renew_before. Manual flat certs only get a
	// warning (certbot can't renew them).
	Renewal AcmeRenewal `yaml:"renewal"`
}

// Renewal scheduler defaults/bounds.
const (
	DefaultRenewalCheckInterval = time.Hour
	DefaultRenewalRenewBefore   = 24 * time.Hour
	MinRenewalCheckInterval     = time.Minute
)

// AcmeRenewal tunes the automatic renewal scheduler.
type AcmeRenewal struct {
	Enabled       *bool    `yaml:"enabled"`        // nil = enabled (when acme.enabled)
	CheckInterval Duration `yaml:"check_interval"` // default 1h, min 1m
	RenewBefore   Duration `yaml:"renew_before"`   // default 24h
}

// RenewalEnabled reports the effective enabled state (default true).
func (r AcmeRenewal) RenewalEnabled() bool {
	return r.Enabled == nil || *r.Enabled
}

// CheckIntervalOrDefault returns the effective check interval (1h when unset).
func (r AcmeRenewal) CheckIntervalOrDefault() time.Duration {
	if r.CheckInterval > 0 {
		return time.Duration(r.CheckInterval)
	}
	return DefaultRenewalCheckInterval
}

// RenewBeforeOrDefault returns the effective due threshold (24h when unset).
func (r AcmeRenewal) RenewBeforeOrDefault() time.Duration {
	if r.RenewBefore > 0 {
		return time.Duration(r.RenewBefore)
	}
	return DefaultRenewalRenewBefore
}

// AcmeDNS holds DNS-01 settings (challenge: dns).
type AcmeDNS struct {
	// Provider is the certbot DNS plugin suffix → --dns-<provider>: digitalocean,
	// cloudflare, route53, google, azure, linode, ovh, rfc2136, … The matching
	// certbot-dns-<provider> package must be installed.
	Provider string `yaml:"provider"`

	// Credentials is the provider INI body, referenced indirectly (never inline) —
	// CredentialsEnv holds the INI text, CredentialsFile points at it. Both empty
	// is allowed: the credential may come from the runtime store (PUT
	// /acme/credentials/{provider}) or ambient SDK env (route53/google).
	CredentialsEnv  string `yaml:"credentials_env"`
	CredentialsFile string `yaml:"credentials_file"`

	// PropagationSeconds → --dns-<provider>-propagation-seconds (default 60).
	PropagationSeconds int `yaml:"propagation_seconds"`

	// Inline-secret trap (mirrors Auth.Token et al.): declared so strict decode
	// accepts the key and validation can emit a targeted error.
	Credentials string `yaml:"credentials" json:"-"`
}

// AcmeHTTP holds HTTP-01 webroot settings (challenge: http).
type AcmeHTTP struct {
	// Webroot is the directory nginxpilot serves at /.well-known/acme-challenge/
	// and passes to certbot as --webroot -w.
	Webroot string `yaml:"webroot"`
}

// PropagationSecondsOrDefault returns the effective DNS propagation wait.
func (d AcmeDNS) PropagationSecondsOrDefault() int {
	if d.PropagationSeconds > 0 {
		return d.PropagationSeconds
	}
	return DefaultAcmePropagationSeconds
}

// ChallengeOrDefault returns the effective challenge method.
func (a Acme) ChallengeOrDefault() string {
	if a.Challenge == "" {
		return ChallengeDNS
	}
	return a.Challenge
}

// ConfigDirOrDefault returns the effective certbot --config-dir.
func (a Acme) ConfigDirOrDefault() string {
	if a.ConfigDir != "" {
		return a.ConfigDir
	}
	return DefaultAcmeConfigDir
}

// LiveDir is certbot's live/ tree under config_dir — where issued certs land and
// what tls.cert_dir should point at for discovery.
func (a Acme) LiveDir() string {
	return a.ConfigDirOrDefault() + "/live"
}

// applyAcmeDefaults fills the ACME block when enabled and a field is unset.
// Inert when acme.enabled is false.
func applyAcmeDefaults(cfg *Config) {
	if !cfg.Acme.Enabled {
		return
	}
	a := &cfg.Acme
	if a.Challenge == "" {
		a.Challenge = ChallengeDNS
	}
	if a.ConfigDir == "" {
		a.ConfigDir = DefaultAcmeConfigDir
	}
	if a.Challenge == ChallengeDNS && a.DNS.Provider == "" {
		a.DNS.Provider = DefaultAcmeProvider
	}
	if a.Challenge == ChallengeDNS && a.DNS.PropagationSeconds == 0 {
		a.DNS.PropagationSeconds = DefaultAcmePropagationSeconds
	}
	if a.Challenge == ChallengeHTTP && a.HTTP.Webroot == "" {
		a.HTTP.Webroot = DefaultAcmeWebroot
	}
	if a.Renewal.CheckInterval == 0 {
		a.Renewal.CheckInterval = Duration(DefaultRenewalCheckInterval)
	}
	if a.Renewal.RenewBefore == 0 {
		a.Renewal.RenewBefore = Duration(DefaultRenewalRenewBefore)
	}
}

// validateAcme checks the acme block. Inert when disabled. Soft mismatches
// (manage off, cert_dir != live dir, nginx/standalone in managed mode) are
// surfaced as warnings by the manager at startup, not as hard errors here.
func validateAcme(cfg *Config) error {
	a := cfg.Acme
	if !a.Enabled {
		return nil
	}
	if strings.TrimSpace(a.Email) == "" {
		return fmt.Errorf("acme.email is required when acme.enabled is true")
	}
	if !a.AgreeTOS {
		return fmt.Errorf("acme.agree_tos must be true to issue certificates (you accept the CA's Terms of Service)")
	}
	switch a.Challenge {
	case ChallengeDNS, ChallengeHTTP, ChallengeNginx, ChallengeStandalone:
	default:
		return fmt.Errorf("acme.challenge %q must be dns | http | nginx | standalone", a.Challenge)
	}

	if a.DNS.Credentials != "" {
		return fmt.Errorf("inline secrets are not allowed: use acme.dns.credentials_env or acme.dns.credentials_file instead of acme.dns.credentials")
	}

	switch a.Challenge {
	case ChallengeDNS:
		if a.DNS.Provider == "" {
			return fmt.Errorf("acme.dns.provider is required for challenge: dns")
		}
		if a.DNS.CredentialsEnv != "" && a.DNS.CredentialsFile != "" {
			return fmt.Errorf("acme.dns.credentials_env and acme.dns.credentials_file are mutually exclusive")
		}
		if a.DNS.PropagationSeconds < 0 {
			return fmt.Errorf("acme.dns.propagation_seconds must not be negative")
		}
	case ChallengeHTTP:
		if a.HTTP.Webroot == "" {
			return fmt.Errorf("acme.http.webroot is required for challenge: http")
		}
	}

	if a.Renewal.CheckInterval > 0 && time.Duration(a.Renewal.CheckInterval) < MinRenewalCheckInterval {
		return fmt.Errorf("acme.renewal.check_interval %s: minimum is %s", a.Renewal.CheckInterval, MinRenewalCheckInterval)
	}
	if a.Renewal.RenewBefore < 0 {
		return fmt.Errorf("acme.renewal.renew_before must be > 0")
	}
	// renew_before <= check_interval leaves zero slack (one missed tick can
	// mean a served expired cert) — surfaced as a startup warning by the
	// manager (warnAcmeMismatches pattern), not a hard error here.
	return nil
}
