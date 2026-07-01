package config

import (
	"fmt"
	"path"
	"regexp"
	"strings"
	"time"

	"golang.org/x/net/idna"
)

// MinInterval protects upstreams from over-eager polling (spec §3).
const MinInterval = 30 * time.Second

// upstreamNameRe restricts upstream names to a safe nginx identifier so the
// generated `upstream <name>` / `proxy_pass http://<name>` are unambiguous.
var upstreamNameRe = regexp.MustCompile(`^[A-Za-z0-9_]+$`)

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

	if err := validateNginx(cfg); err != nil {
		return err
	}
	if err := validateTls(cfg); err != nil {
		return err
	}
	if err := validateAcme(cfg); err != nil {
		return err
	}

	seen := map[string]string{} // domain -> file (sites + proxies share the namespace)
	for i := range cfg.Sites {
		site := &cfg.Sites[i]
		if err := validateSite(site); err != nil {
			return fmt.Errorf("site %q (%s): %w", site.Domain, site.File, err)
		}
		if err := validateWebOptions(&site.WebOptions); err != nil {
			return fmt.Errorf("site %q (%s): %w", site.Domain, site.File, err)
		}
		if prev, dup := seen[site.Domain]; dup {
			return fmt.Errorf("duplicate domain %q declared in %s and %s", site.Domain, prev, site.File)
		}
		seen[site.Domain] = site.File
	}

	upstreams, err := validateUpstreams(cfg)
	if err != nil {
		return err
	}
	if err := validateProxies(cfg, upstreams, seen); err != nil {
		return err
	}

	streamUpstreams, err := validateStreamUpstreams(cfg)
	if err != nil {
		return err
	}
	if err := validateStreams(cfg, streamUpstreams); err != nil {
		return err
	}
	return nil
}

// NormalizeDomain validates a domain and rewrites it to its punycode/ASCII
// (IDNA2008) form — the same normalization Validate applies in place. Exposed
// so the admin write-API can derive a fragment's deterministic, filesystem-safe
// filename from a request-supplied domain.
func NormalizeDomain(domain string) (string, error) {
	return normalizeDomain(domain)
}

// normalizeDomain validates and rewrites a domain to its punycode/ASCII
// (IDNA2008) form — filesystem-safe and identical to what nginx sees in
// SNI/Host (spec Q12). Wildcards are rejected (no v1 support).
func normalizeDomain(domain string) (string, error) {
	if domain == "" {
		return "", fmt.Errorf("domain is required")
	}
	if strings.Contains(domain, "*") {
		return "", fmt.Errorf("wildcard domains are not supported in v1")
	}
	ascii, err := idna.Lookup.ToASCII(domain)
	if err != nil {
		return "", fmt.Errorf("invalid domain: %w", err)
	}
	return ascii, nil
}

// validateUpstreams checks every upstream and returns the set of declared
// names (post-validation) for proxy reference resolution.
func validateUpstreams(cfg *Config) (map[string]bool, error) {
	names := map[string]string{} // name -> file
	for i := range cfg.Upstreams {
		u := &cfg.Upstreams[i]
		if u.Name == "" {
			return nil, fmt.Errorf("upstream (%s): name is required", u.File)
		}
		if !upstreamNameRe.MatchString(u.Name) {
			return nil, fmt.Errorf("upstream %q (%s): name must match [A-Za-z0-9_]+", u.Name, u.File)
		}
		if prev, dup := names[u.Name]; dup {
			return nil, fmt.Errorf("duplicate upstream %q declared in %s and %s", u.Name, prev, u.File)
		}
		names[u.Name] = u.File

		switch u.Balancer {
		case "", BalancerRoundRobin, BalancerLeastConn, BalancerIPHash:
		default:
			return nil, fmt.Errorf("upstream %q: balancer %q must be round_robin | least_conn | ip_hash", u.Name, u.Balancer)
		}
		if u.Keepalive < 0 {
			return nil, fmt.Errorf("upstream %q: keepalive must be >= 0", u.Name)
		}
		if len(u.Servers) == 0 {
			return nil, fmt.Errorf("upstream %q: at least one server is required", u.Name)
		}
		for j := range u.Servers {
			s := u.Servers[j]
			if s.Address == "" {
				return nil, fmt.Errorf("upstream %q: server[%d].address is required", u.Name, j)
			}
			if s.Weight < 0 {
				return nil, fmt.Errorf("upstream %q: server %q weight must be >= 0", u.Name, s.Address)
			}
			if s.MaxFails != nil && *s.MaxFails < 0 {
				return nil, fmt.Errorf("upstream %q: server %q max_fails must be >= 0", u.Name, s.Address)
			}
		}
	}
	out := make(map[string]bool, len(names))
	for n := range names {
		out[n] = true
	}
	return out, nil
}

// validateProxies checks reverse-proxy entities, resolving upstream references
// against declared names and guarding the shared domain namespace.
func validateProxies(cfg *Config, upstreams map[string]bool, seen map[string]string) error {
	for i := range cfg.Proxies {
		p := &cfg.Proxies[i]
		ascii, err := normalizeDomain(p.Domain)
		if err != nil {
			return fmt.Errorf("proxy %q (%s): %w", p.Domain, p.File, err)
		}
		p.Domain = ascii

		if p.Listen < 0 || p.Listen > 65535 {
			return fmt.Errorf("proxy %q: listen %d must be 1..65535", p.Domain, p.Listen)
		}

		if err := validateProxyTargets(p, upstreams); err != nil {
			return fmt.Errorf("proxy %q (%s): %w", p.Domain, p.File, err)
		}

		if err := validateWebOptions(&p.WebOptions); err != nil {
			return fmt.Errorf("proxy %q (%s): %w", p.Domain, p.File, err)
		}
		if err := validateCache(p.Cache); err != nil {
			return fmt.Errorf("proxy %q (%s): %w", p.Domain, p.File, err)
		}

		if prev, dup := seen[p.Domain]; dup {
			return fmt.Errorf("duplicate domain %q declared in %s and %s", p.Domain, prev, p.File)
		}
		seen[p.Domain] = p.File
	}
	return nil
}

// validateProxyTargets enforces the upstream/pass exactly-one rule at the
// proxy and location levels, with locations inheriting the proxy default.
func validateProxyTargets(p *Proxy, upstreams map[string]bool) error {
	if err := checkTarget("", p.Upstream, p.Pass, upstreams, true); err != nil {
		return err
	}
	for j := range p.Locations {
		loc := &p.Locations[j]
		if loc.Path == "" {
			loc.Path = "/"
		}
		if !strings.HasPrefix(loc.Path, "/") {
			return fmt.Errorf("location[%d] path %q must start with /", j, loc.Path)
		}
		// A location may inherit the proxy default; resolve the effective pair.
		up, pass := loc.Upstream, loc.Pass
		if up == "" && pass == "" {
			up, pass = p.Upstream, p.Pass
		}
		if err := checkTarget(fmt.Sprintf("location %q ", loc.Path), up, pass, upstreams, false); err != nil {
			return err
		}
	}
	// With no locations the proxy default must itself be a complete target.
	if len(p.Locations) == 0 && p.Upstream == "" && p.Pass == "" {
		return fmt.Errorf("a proxy needs upstream/pass (or at least one location that sets one)")
	}
	return nil
}

// checkTarget validates a single (upstream, pass) pair. optional allows the
// pair to be empty (a proxy default that locations override); when false
// exactly one of the two must be set.
func checkTarget(prefix, upstream, pass string, upstreams map[string]bool, optional bool) error {
	switch {
	case upstream != "" && pass != "":
		return fmt.Errorf("%supstream and pass are mutually exclusive", prefix)
	case upstream != "":
		if !upstreams[upstream] {
			return fmt.Errorf("%sreferences unknown upstream %q", prefix, upstream)
		}
	case pass != "":
		if !strings.HasPrefix(pass, "http://") && !strings.HasPrefix(pass, "https://") {
			return fmt.Errorf("%spass %q must be an http:// or https:// URL", prefix, pass)
		}
	default:
		if !optional {
			return fmt.Errorf("%supstream or pass is required", prefix)
		}
	}
	return nil
}

func validateSite(site *Site) error {
	ascii, err := normalizeDomain(site.Domain)
	if err != nil {
		return err
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
