package config

import (
	"fmt"
	"net/netip"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/kalevski/toolcase/nginxpilot/internal/targetcheck"
)

// DefaultSecretEnvPrefix is the namespace a source's *_env reference must live
// in unless secrets.env_prefix says otherwise.
const DefaultSecretEnvPrefix = "NP_SECRET_"

// Daemon-level ceilings for source limits (limits: in the main config). A
// source's own limits are clamped to these, so a fragment author cannot raise
// them.
const (
	CeilingMaxArchiveSize   ByteSize = 1 << 30
	CeilingUncompressedSize ByteSize = 2 << 30
	CeilingEntries                   = 200_000
	CeilingRatio                     = 200
	DefaultMaxGitRepoSize   ByteSize = 1 << 30
)

// ProxyPolicy is the daemon-level restriction on proxy, upstream and stream
// targets (proxy: in the main config).
type ProxyPolicy struct {
	// UnixSocketDirs lists the directories a unix: target's socket may live
	// under. Empty (the default) refuses every unix: target.
	UnixSocketDirs []string `yaml:"unix_socket_dirs"`
	// DenyCIDRs adds literal-IP ranges to the built-in deny list (loopback,
	// the unspecified address and link-local); the built-ins cannot be removed.
	DenyCIDRs []string `yaml:"deny_cidrs"`
}

// StreamPolicy restricts stream listen ports (stream: in the main config).
type StreamPolicy struct {
	// AllowedPorts are the ports a stream may listen on, each "N" or "N-M".
	// Empty (the default) leaves ports unrestricted.
	AllowedPorts []string `yaml:"allowed_ports"`
}

// SecretsPolicy confines where a source's secret references may point
// (secrets: in the main config).
type SecretsPolicy struct {
	// Dir is the directory (besides data_dir/git-credentials) a source's
	// *_file may live under. Default data_dir/secrets.
	Dir string `yaml:"dir"`
	// EnvPrefix is the prefix a source's *_env name must carry. Default
	// NP_SECRET_.
	EnvPrefix string `yaml:"env_prefix"`
}

// SecretPolicy is a resolved SecretsPolicy attached to every validated source.
type SecretPolicy struct {
	dirs   []string
	prefix string
	deny   []string
}

func (cfg *Config) dataDirOrDefault() string {
	if cfg.DataDir == "" {
		return "/var/lib/nginxpilot"
	}
	return cfg.DataDir
}

func (cfg *Config) targetPolicy() (targetcheck.Policy, error) {
	pol := targetcheck.DefaultPolicy()
	extra, err := targetcheck.ParseCIDRs(cfg.Proxy.DenyCIDRs)
	if err != nil {
		return pol, fmt.Errorf("proxy.deny_cidrs: %w", err)
	}
	pol.DenyNets = append(pol.DenyNets, extra...)
	for _, d := range cfg.Proxy.UnixSocketDirs {
		if !filepath.IsAbs(d) || strings.Contains(d, "..") {
			return pol, fmt.Errorf("proxy.unix_socket_dirs: %q must be an absolute path without ..", d)
		}
		pol.UnixDirs = append(pol.UnixDirs, filepath.Clean(d))
	}
	if sock := cfg.Admin.SocketPath(); sock != "" {
		pol.DenyPaths = append(pol.DenyPaths, filepath.Dir(sock))
	}
	if ap, err := netip.ParseAddrPort(cfg.Admin.ListenAddr()); err == nil {
		pol.AdminAddr = ap
	}
	return pol, nil
}

type portRange struct{ lo, hi int }

func parsePortRanges(in []string) ([]portRange, error) {
	var out []portRange
	for _, s := range in {
		lo, hi, isRange := strings.Cut(strings.TrimSpace(s), "-")
		a, err := strconv.Atoi(lo)
		b := a
		if err == nil && isRange {
			b, err = strconv.Atoi(hi)
		}
		if err != nil || a < 1 || b > 65535 || a > b {
			return nil, fmt.Errorf("stream.allowed_ports: %q must be a port or a range like 20000-29999", s)
		}
		out = append(out, portRange{a, b})
	}
	return out, nil
}

func portAllowed(ranges []portRange, port int) bool {
	for _, r := range ranges {
		if port >= r.lo && port <= r.hi {
			return true
		}
	}
	return false
}

func (cfg *Config) secretPolicy() *SecretPolicy {
	dataDir := cfg.dataDirOrDefault()
	secrets := cfg.Secrets.Dir
	if secrets == "" {
		secrets = filepath.Join(dataDir, "secrets")
	}
	prefix := cfg.Secrets.EnvPrefix
	if prefix == "" {
		prefix = DefaultSecretEnvPrefix
	}
	p := &SecretPolicy{
		dirs:   []string{resolveLoose(filepath.Join(dataDir, "git-credentials")), resolveLoose(secrets)},
		prefix: prefix,
	}
	if cfg.Admin.TokenFile != "" {
		p.deny = append(p.deny, resolveLoose(cfg.Admin.TokenFile))
	}
	return p
}

// resolveLoose cleans a path and resolves symlinks as far as the path exists,
// so a not-yet-written file is judged by where its directory really is.
func resolveLoose(p string) string {
	p = filepath.Clean(p)
	if r, err := filepath.EvalSymlinks(p); err == nil {
		return r
	}
	dir, base := filepath.Split(p)
	if dir == "" || dir == p {
		return p
	}
	return filepath.Join(resolveLoose(dir), base)
}

// CheckEnv refuses an environment reference outside the allowed namespace.
func (p *SecretPolicy) CheckEnv(name string) error {
	if p == nil || name == "" {
		return nil
	}
	if !strings.HasPrefix(name, p.prefix) {
		return fmt.Errorf("environment reference %q must start with %s (secrets.env_prefix)", name, p.prefix)
	}
	return nil
}

// CheckFile refuses a file reference outside the allowed directories, after
// symlinks are resolved.
func (p *SecretPolicy) CheckFile(file string) error {
	if p == nil || file == "" {
		return nil
	}
	if !filepath.IsAbs(file) {
		return fmt.Errorf("secret file %q must be an absolute path", file)
	}
	real := resolveLoose(file)
	for _, d := range p.deny {
		if real == d {
			return fmt.Errorf("secret file %q is not a source secret", file)
		}
	}
	for _, d := range p.dirs {
		if strings.HasPrefix(real, d+string(os.PathSeparator)) {
			return nil
		}
	}
	return fmt.Errorf("secret file %q must be under data_dir/git-credentials or secrets.dir", file)
}

// Resolve resolves one source secret reference under the policy the source was
// validated with (no policy: unrestricted, as ResolveSecret).
func (a Auth) Resolve(envName, fileName string) (string, error) {
	if err := a.policy.CheckEnv(envName); err != nil {
		return "", err
	}
	if err := a.policy.CheckFile(fileName); err != nil {
		return "", err
	}
	return ResolveSecret(envName, fileName)
}

// ResolveKeyFile returns the ssh key_file path after the policy check.
func (a Auth) ResolveKeyFile() (string, error) {
	if err := a.policy.CheckFile(a.KeyFile); err != nil {
		return "", err
	}
	return a.KeyFile, nil
}

func (a *Auth) check(p *SecretPolicy) error {
	for _, e := range []string{a.TokenEnv, a.PasswordEnv, a.ValueEnv, a.KeyEnv} {
		if err := p.CheckEnv(e); err != nil {
			return err
		}
	}
	for _, f := range []string{a.TokenFile, a.PasswordFile, a.ValueFile, a.KeyFile} {
		if err := p.CheckFile(f); err != nil {
			return err
		}
	}
	a.policy = p
	return nil
}

// ceiling is the daemon limit set with defaults applied.
func (l Limits) ceiling() Limits {
	out := l
	if out.MaxArchiveSize <= 0 {
		out.MaxArchiveSize = CeilingMaxArchiveSize
	}
	if out.MaxUncompressedSize <= 0 {
		out.MaxUncompressedSize = CeilingUncompressedSize
	}
	if out.MaxEntries <= 0 {
		out.MaxEntries = CeilingEntries
	}
	if out.MaxCompressionRatio <= 0 {
		out.MaxCompressionRatio = CeilingRatio
	}
	if out.MaxGitRepoSize <= 0 {
		out.MaxGitRepoSize = DefaultMaxGitRepoSize
	}
	return out
}

// Clamp lowers any per-source limit (explicit or defaulted) that exceeds the
// daemon ceiling, leaving every other field as written.
func (l Limits) Clamp(daemon Limits) Limits {
	c := daemon.ceiling()
	eff := l.Effective()
	out := l
	if eff.MaxArchiveSize > c.MaxArchiveSize {
		out.MaxArchiveSize = c.MaxArchiveSize
	}
	if eff.MaxUncompressedSize > c.MaxUncompressedSize {
		out.MaxUncompressedSize = c.MaxUncompressedSize
	}
	if eff.MaxEntries > c.MaxEntries {
		out.MaxEntries = c.MaxEntries
	}
	if eff.MaxCompressionRatio > c.MaxCompressionRatio {
		out.MaxCompressionRatio = c.MaxCompressionRatio
	}
	if eff.MaxGitRepoSize > c.MaxGitRepoSize {
		out.MaxGitRepoSize = c.MaxGitRepoSize
	}
	return out
}

// validateSourcePolicies applies the daemon-level policies to every site and
// app source: secret references are confined and attached, limits clamped.
func validateSourcePolicies(cfg *Config) error {
	if _, err := parsePortRanges(cfg.Stream.AllowedPorts); err != nil {
		return err
	}
	if _, err := cfg.targetPolicy(); err != nil {
		return err
	}
	if cfg.Limits.MaxArchiveSize < 0 || cfg.Limits.MaxUncompressedSize < 0 || cfg.Limits.MaxEntries < 0 ||
		cfg.Limits.MaxCompressionRatio < 0 || cfg.Limits.MaxGitRepoSize < 0 {
		return fmt.Errorf("limits: values must not be negative")
	}
	pol := cfg.secretPolicy()
	for i := range cfg.Sites {
		s := &cfg.Sites[i]
		if err := s.Source.Auth.check(pol); err != nil {
			return fmt.Errorf("site %q (%s): %w", s.Domain, s.File, err)
		}
		s.Source.Limits = s.Source.Limits.Clamp(cfg.Limits)
	}
	for i := range cfg.Apps {
		a := &cfg.Apps[i]
		if err := a.Source.Auth.check(pol); err != nil {
			return fmt.Errorf("app %q (%s): %w", a.Domain, a.File, err)
		}
		a.Source.Limits = a.Source.Limits.Clamp(cfg.Limits)
	}
	return nil
}
