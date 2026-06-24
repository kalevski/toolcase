package config

import (
	"fmt"
	"path"
	"strings"
	"time"

	"golang.org/x/net/idna"
)

// MinInterval protects upstreams from over-eager polling (spec §3).
const MinInterval = 30 * time.Second

// Validate checks the merged configuration. It normalizes domains to their
// punycode/ASCII form in place.
func Validate(cfg *Config) error {
	switch cfg.LogLevel {
	case "debug", "info", "warn", "error":
	default:
		return fmt.Errorf("log_level %q: must be debug|info|warn|error", cfg.LogLevel)
	}
	if cfg.Defaults.Interval > 0 && time.Duration(cfg.Defaults.Interval) < MinInterval {
		return fmt.Errorf("defaults.interval %s: minimum is %s", cfg.Defaults.Interval, MinInterval)
	}
	if cfg.Defaults.KeepReleases < 1 {
		return fmt.Errorf("defaults.keep_releases must be >= 1")
	}

	if cfg.Admin.TokenEnv != "" && cfg.Admin.TokenFile != "" {
		return fmt.Errorf("admin.token_env and admin.token_file are mutually exclusive")
	}

	seen := map[string]string{} // domain -> file
	for i := range cfg.Sites {
		site := &cfg.Sites[i]
		if err := validateSite(site); err != nil {
			return fmt.Errorf("site %q (%s): %w", site.Domain, site.File, err)
		}
		if prev, dup := seen[site.Domain]; dup {
			return fmt.Errorf("duplicate domain %q declared in %s and %s", site.Domain, prev, site.File)
		}
		seen[site.Domain] = site.File
	}
	return nil
}

func validateSite(site *Site) error {
	if site.Domain == "" {
		return fmt.Errorf("domain is required")
	}
	if strings.Contains(site.Domain, "*") {
		return fmt.Errorf("wildcard domains are not supported in v1")
	}
	// Normalize to punycode/ASCII (IDNA2008) — filesystem-safe, identical to
	// what nginx sees in SNI/Host (spec Q12).
	ascii, err := idna.Lookup.ToASCII(site.Domain)
	if err != nil {
		return fmt.Errorf("invalid domain: %w", err)
	}
	site.Domain = ascii

	if site.Source.Interval > 0 && time.Duration(site.Source.Interval) < MinInterval {
		return fmt.Errorf("interval %s: minimum is %s", site.Source.Interval, MinInterval)
	}

	if err := checkNoInlineSecrets(site.Source.Auth); err != nil {
		return err
	}

	if site.Source.Subdir != "" {
		sub := path.Clean(site.Source.Subdir)
		if path.IsAbs(sub) || sub == ".." || strings.HasPrefix(sub, "../") {
			return fmt.Errorf("subdir %q must be relative and must not contain ..", site.Source.Subdir)
		}
	}

	switch site.Source.Type {
	case SourceGit:
		return validateGitSource(&site.Source)
	case SourceHTTPZip:
		return validateHTTPZipSource(&site.Source)
	case "":
		return fmt.Errorf("source.type is required (git | http-zip)")
	default:
		return fmt.Errorf("source.type %q: must be git or http-zip", site.Source.Type)
	}
}

func validateGitSource(src *Source) error {
	if src.URL == "" {
		return fmt.Errorf("source.url is required")
	}
	if src.Branch == "" {
		return fmt.Errorf("source.branch is required for git sources")
	}
	if src.StripComponents != nil || src.ChecksumURL != "" || src.AllowInsecure {
		return fmt.Errorf("strip_components / checksum_url / allow_insecure only apply to http-zip sources")
	}

	sshURL := strings.HasPrefix(src.URL, "git@") || strings.HasPrefix(src.URL, "ssh://")
	httpsURL := strings.HasPrefix(src.URL, "https://")
	if !sshURL && !httpsURL {
		return fmt.Errorf("source.url must be ssh (git@/ssh://) or https://")
	}

	switch src.Auth.MethodOrNone() {
	case AuthNone:
		if sshURL {
			return fmt.Errorf("ssh URLs require auth.method: ssh-key")
		}
	case AuthSSHKey:
		if !sshURL {
			return fmt.Errorf("auth.method ssh-key requires a git@/ssh:// URL")
		}
		// The private key comes either from a path (key_file) or from an
		// env var holding the key material (key_env) — exactly one.
		if err := exactlyOneRef("key", src.Auth.KeyEnv, src.Auth.KeyFile); err != nil {
			return err
		}
	case AuthHTTPSToken:
		if !httpsURL {
			return fmt.Errorf("auth.method https-token requires an https:// URL")
		}
		if src.Auth.Username == "" {
			return fmt.Errorf("auth.username is required for https-token auth")
		}
		if err := exactlyOneRef("token", src.Auth.TokenEnv, src.Auth.TokenFile); err != nil {
			return err
		}
	case AuthGitHubToken:
		// Token-only: the GitHub access token alone authenticates (no
		// username). Suits a token minted from a social/web login —
		// `gh auth login` then `gh auth token`, a Personal Access Token,
		// or an OAuth/app token.
		if !httpsURL {
			return fmt.Errorf("auth.method github-token requires an https:// URL")
		}
		if src.Auth.Username != "" {
			return fmt.Errorf("auth.username must not be set for github-token (the token alone authenticates)")
		}
		if err := exactlyOneRef("token", src.Auth.TokenEnv, src.Auth.TokenFile); err != nil {
			return err
		}
	default:
		return fmt.Errorf("auth.method %q: git sources support ssh-key | https-token | github-token | none", src.Auth.Method)
	}
	return nil
}

func validateHTTPZipSource(src *Source) error {
	if src.URL == "" {
		return fmt.Errorf("source.url is required")
	}
	if src.Branch != "" || src.Subdir != "" {
		return fmt.Errorf("branch / subdir only apply to git sources")
	}
	if strings.HasPrefix(src.URL, "http://") {
		if !src.AllowInsecure {
			return fmt.Errorf("http:// URLs require allow_insecure: true (https:// is the default requirement)")
		}
	} else if !strings.HasPrefix(src.URL, "https://") {
		return fmt.Errorf("source.url must be https:// (or http:// with allow_insecure: true)")
	}
	if src.ChecksumURL != "" && !strings.HasPrefix(src.ChecksumURL, "https://") && !src.AllowInsecure {
		return fmt.Errorf("checksum_url must be https:// (or set allow_insecure: true)")
	}
	if src.StripComponents != nil && *src.StripComponents < 0 {
		return fmt.Errorf("strip_components must be >= 0")
	}

	switch src.Auth.MethodOrNone() {
	case AuthNone:
	case AuthBearer:
		if err := exactlyOneRef("token", src.Auth.TokenEnv, src.Auth.TokenFile); err != nil {
			return err
		}
	case AuthBasic:
		if src.Auth.Username == "" {
			return fmt.Errorf("auth.username is required for basic auth")
		}
		if err := exactlyOneRef("password", src.Auth.PasswordEnv, src.Auth.PasswordFile); err != nil {
			return err
		}
	case AuthHeader:
		if src.Auth.Name == "" {
			return fmt.Errorf("auth.name (header name) is required for header auth")
		}
		if err := exactlyOneRef("value", src.Auth.ValueEnv, src.Auth.ValueFile); err != nil {
			return err
		}
	default:
		return fmt.Errorf("auth.method %q: http-zip sources support bearer | basic | header | none", src.Auth.Method)
	}
	return nil
}

// checkNoInlineSecrets turns inline secret keys into a targeted parse-time
// error — config files must stay safe to commit (spec Q9).
func checkNoInlineSecrets(a Auth) error {
	for key, val := range map[string]string{"token": a.Token, "password": a.Password, "value": a.Value, "key": a.Key} {
		if val != "" {
			return fmt.Errorf("inline secrets are not allowed: use auth.%s_env or auth.%s_file instead of auth.%s", key, key, key)
		}
	}
	return nil
}

func exactlyOneRef(name, env, file string) error {
	if env == "" && file == "" {
		return fmt.Errorf("auth.%s_env or auth.%s_file is required", name, name)
	}
	if env != "" && file != "" {
		return fmt.Errorf("auth.%s_env and auth.%s_file are mutually exclusive", name, name)
	}
	return nil
}
