// Package config parses, merges and validates the daemon configuration
// (one main YAML file plus optional sites.d/ fragments pulled in via
// include: globs). Decoding is strict: unknown keys are errors.
package config

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// Source types.
const (
	SourceGit     = "git"
	SourceHTTPZip = "http-zip"
)

// Auth methods.
const (
	AuthNone        = "none"
	AuthSSHKey      = "ssh-key"
	AuthHTTPSToken  = "https-token"
	AuthGitHubToken = "github-token"
	AuthBearer      = "bearer"
	AuthBasic       = "basic"
	AuthHeader      = "header"
)

// Upstream load-balancing methods (nginx upstream{} directives). The empty
// string is treated as round-robin (nginx's default, no directive emitted).
const (
	BalancerRoundRobin = "round_robin"
	BalancerLeastConn  = "least_conn"
	BalancerIPHash     = "ip_hash"
)

// DefaultProxyListen is the listen port used for a reverse proxy when the
// entity does not set one. Mirrors the static print-vhost output (:80, plus
// a commented certbot/TLS hint).
const DefaultProxyListen = 80

// Config is the merged result of the main file and all included fragments.
type Config struct {
	DataDir  string   `yaml:"data_dir"`
	LogLevel string   `yaml:"log_level"`
	Admin    Admin    `yaml:"admin"`
	Defaults Defaults `yaml:"defaults"`
	Include  []string `yaml:"include"`
	Sites    []Site   `yaml:"sites"`

	// Upstreams and Proxies are config-only entities: nginx upstream{} pools
	// and reverse-proxy server{} blocks. The daemon never syncs or serves
	// them — they exist purely so `print-vhost` / the admin /vhost endpoint
	// can generate nginx configuration to paste and adapt (the daemon stays
	// out of the request path and never writes nginx config).
	Upstreams []Upstream `yaml:"upstreams"`
	Proxies   []Proxy    `yaml:"proxies"`

	// Path is the main config file path the config was loaded from.
	Path string `yaml:"-"`
}

// Upstream is a named nginx upstream{} block — a pool of backend servers a
// reverse proxy can proxy_pass to by name.
type Upstream struct {
	Name string `yaml:"name"`
	// Balancer selects the load-balancing method: "" / round_robin (default),
	// least_conn, or ip_hash.
	Balancer string `yaml:"balancer"`
	// Keepalive sets the keepalive connection cache size (0 = omit).
	Keepalive int              `yaml:"keepalive"`
	Servers   []UpstreamServer `yaml:"servers"`

	// File records which config file declared this upstream (provenance for
	// duplicate-name errors and logs).
	File string `yaml:"-"`
}

// UpstreamServer is one backend in an upstream pool.
type UpstreamServer struct {
	// Address is "host:port", an IP:port, or "unix:/path/to.sock".
	Address     string   `yaml:"address"`
	Weight      int      `yaml:"weight"`
	MaxFails    *int     `yaml:"max_fails"`
	FailTimeout Duration `yaml:"fail_timeout"`
	Backup      bool     `yaml:"backup"`
	Down        bool     `yaml:"down"`
}

// Proxy is a reverse-proxy vhost: an nginx server{} block whose locations
// proxy_pass to a named upstream or a single inline target.
type Proxy struct {
	Domain string `yaml:"domain"`
	// Listen is the HTTP port (default DefaultProxyListen).
	Listen int `yaml:"listen"`
	// Upstream / Pass set the default backend for all locations. Exactly one
	// of them is required unless every location sets its own. Upstream names
	// an entry in Config.Upstreams; Pass is an inline scheme://host:port.
	Upstream  string          `yaml:"upstream"`
	Pass      string          `yaml:"pass"`
	Locations []ProxyLocation `yaml:"locations"`

	// Optional proxy tuning applied at the server level.
	ConnectTimeout    Duration `yaml:"connect_timeout"`
	ReadTimeout       Duration `yaml:"read_timeout"`
	SendTimeout       Duration `yaml:"send_timeout"`
	ClientMaxBodySize ByteSize `yaml:"client_max_body_size"`

	// File records which config file declared this proxy (provenance).
	File string `yaml:"-"`
}

// ProxyLocation maps a location path to a backend, overriding the proxy's
// default Upstream/Pass when set.
type ProxyLocation struct {
	// Path defaults to "/".
	Path     string `yaml:"path"`
	Upstream string `yaml:"upstream"`
	Pass     string `yaml:"pass"`
	// Websocket adds the Upgrade/Connection headers + HTTP/1.1 for WebSocket
	// and other connection-upgrade traffic.
	Websocket bool `yaml:"websocket"`
}

// ListenPort returns the effective listen port for the proxy.
func (p Proxy) ListenPort() int {
	if p.Listen > 0 {
		return p.Listen
	}
	return DefaultProxyListen
}

// Admin configures the loopback admin HTTP endpoint.
type Admin struct {
	// Listen is the address for the admin endpoint. nil means the default
	// (127.0.0.1:9090); an explicit empty string disables the endpoint.
	Listen    *string `yaml:"listen"`
	TokenEnv  string  `yaml:"token_env"`
	TokenFile string  `yaml:"token_file"`
}

// ListenAddr resolves the effective admin listen address ("" = disabled).
func (a Admin) ListenAddr() string {
	if a.Listen == nil {
		return "127.0.0.1:9090"
	}
	return *a.Listen
}

// defaultKeepReleases is the built-in fallback when neither the site nor
// defaults specify keep_releases.
const defaultKeepReleases = 5

// Defaults holds global per-site fallbacks.
type Defaults struct {
	Interval     Duration `yaml:"interval"`
	KeepReleases int      `yaml:"keep_releases"`
}

// Site maps one domain to one content source.
type Site struct {
	Domain  string   `yaml:"domain"`
	Source  Source   `yaml:"source"`
	Exclude []string `yaml:"exclude"`

	// File records which config file declared this site (provenance for
	// duplicate-domain errors and logs).
	File string `yaml:"-"`
}

// Interval returns the effective poll interval for the site.
func (s Site) Interval(d Defaults) time.Duration {
	if s.Source.Interval > 0 {
		return time.Duration(s.Source.Interval)
	}
	if d.Interval > 0 {
		return time.Duration(d.Interval)
	}
	return 5 * time.Minute
}

// KeepReleases returns the effective keep_releases for the site: per-site
// value wins, then defaults, then the built-in constant.
func (s Site) KeepReleases(d Defaults) int {
	if s.Source.KeepReleases != nil && *s.Source.KeepReleases > 0 {
		return *s.Source.KeepReleases
	}
	if d.KeepReleases > 0 {
		return d.KeepReleases
	}
	return defaultKeepReleases
}

// Source describes where a site's content comes from.
type Source struct {
	Type         string   `yaml:"type"`
	URL          string   `yaml:"url"`
	Interval     Duration `yaml:"interval"`
	KeepReleases *int     `yaml:"keep_releases"`
	Auth         Auth     `yaml:"auth"`

	// git only
	Branch string `yaml:"branch"`
	Subdir string `yaml:"subdir"`

	// post-fetch gate (both source types)
	RequireFile []string `yaml:"require_file"`

	// http-zip only
	ChecksumURL     string `yaml:"checksum_url"`
	StripComponents *int   `yaml:"strip_components"`
	AllowInsecure   bool   `yaml:"allow_insecure"`
	Limits          Limits `yaml:"limits"`
}

// Fingerprint identifies the source identity; when it changes (URL, branch,
// subdir, auth method...) the site is treated as a brand-new source and fully
// resynced regardless of stored refs.
func (s Source) Fingerprint() string {
	return strings.Join([]string{
		s.Type, s.URL, s.Branch, s.Subdir, s.Auth.Method, strconv.Itoa(stripOrMinusOne(s.StripComponents)),
	}, "\x00")
}

func stripOrMinusOne(p *int) int {
	if p == nil {
		return -1
	}
	return *p
}

// Auth carries credentials for a source. Secret material is only ever
// referenced indirectly (*_env / *_file); inline values are a parse-time
// error (see validate.go).
type Auth struct {
	Method string `yaml:"method"`

	// ssh-key: supply the private key either by path (key_file) or by
	// reference to an env var holding the key material (key_env). Exactly
	// one is required. key_env materializes the key into a daemon-owned
	// 0600 temp file at sync time — no on-host staging/ownership dance.
	KeyFile    string `yaml:"key_file"`
	KeyEnv     string `yaml:"key_env"`
	KnownHosts string `yaml:"known_hosts"`

	// https-token / basic
	Username string `yaml:"username"`

	// token references (https-token, bearer)
	TokenEnv  string `yaml:"token_env"`
	TokenFile string `yaml:"token_file"`

	// basic password references
	PasswordEnv  string `yaml:"password_env"`
	PasswordFile string `yaml:"password_file"`

	// header
	Name      string `yaml:"name"`
	ValueEnv  string `yaml:"value_env"`
	ValueFile string `yaml:"value_file"`

	// Inline secret traps: declared so strict decoding accepts the key and
	// validation can emit a targeted error instead of "unknown field".
	Token    string `yaml:"token"`
	Password string `yaml:"password"`
	Value    string `yaml:"value"`
	Key      string `yaml:"key"`
}

// MethodOrNone returns the effective auth method.
func (a Auth) MethodOrNone() string {
	if a.Method == "" {
		return AuthNone
	}
	return a.Method
}

// Limits bounds http-zip archives. Zero values mean "use default".
type Limits struct {
	MaxArchiveSize      ByteSize `yaml:"max_archive_size"`
	MaxUncompressedSize ByteSize `yaml:"max_uncompressed_size"`
	MaxEntries          int      `yaml:"max_entries"`
	MaxCompressionRatio int      `yaml:"max_compression_ratio"`
}

// Defaults from the spec (section 4.2).
const (
	DefaultMaxArchiveSize      = 512 << 20 // 512 MiB
	DefaultMaxUncompressedSize = 2 << 30   // 2 GiB
	DefaultMaxEntries          = 100_000
	DefaultMaxCompressionRatio = 100
)

// Effective returns the limits with defaults applied.
func (l Limits) Effective() Limits {
	out := l
	if out.MaxArchiveSize <= 0 {
		out.MaxArchiveSize = DefaultMaxArchiveSize
	}
	if out.MaxUncompressedSize <= 0 {
		out.MaxUncompressedSize = DefaultMaxUncompressedSize
	}
	if out.MaxEntries <= 0 {
		out.MaxEntries = DefaultMaxEntries
	}
	if out.MaxCompressionRatio <= 0 {
		out.MaxCompressionRatio = DefaultMaxCompressionRatio
	}
	return out
}

// Duration is a time.Duration with YAML support for "30s", "5m", "1h".
type Duration time.Duration

// UnmarshalYAML implements yaml.Unmarshaler.
func (d *Duration) UnmarshalYAML(node *yaml.Node) error {
	var s string
	if err := node.Decode(&s); err != nil {
		return fmt.Errorf("duration must be a string like \"5m\": %w", err)
	}
	v, err := time.ParseDuration(s)
	if err != nil {
		return fmt.Errorf("invalid duration %q: %w", s, err)
	}
	if v < 0 {
		return fmt.Errorf("duration %q must not be negative", s)
	}
	*d = Duration(v)
	return nil
}

// String implements fmt.Stringer.
func (d Duration) String() string { return time.Duration(d).String() }

// ByteSize is a byte count with YAML support for "512MiB", "2GiB", "100KB"
// or a plain integer (bytes).
type ByteSize int64

var sizeRe = regexp.MustCompile(`(?i)^([0-9]+(?:\.[0-9]+)?)\s*(B|KB|MB|GB|TB|KIB|MIB|GIB|TIB)?$`)

// UnmarshalYAML implements yaml.Unmarshaler.
func (b *ByteSize) UnmarshalYAML(node *yaml.Node) error {
	var s string
	if err := node.Decode(&s); err != nil {
		return fmt.Errorf("size must be a string like \"512MiB\" or a number: %w", err)
	}
	v, err := ParseByteSize(s)
	if err != nil {
		return err
	}
	*b = v
	return nil
}

// ParseByteSize parses "512MiB"-style size strings.
func ParseByteSize(s string) (ByteSize, error) {
	m := sizeRe.FindStringSubmatch(strings.TrimSpace(s))
	if m == nil {
		return 0, fmt.Errorf("invalid size %q (expected e.g. \"512MiB\", \"2GiB\")", s)
	}
	n, err := strconv.ParseFloat(m[1], 64)
	if err != nil {
		return 0, fmt.Errorf("invalid size %q: %w", s, err)
	}
	var mult float64 = 1
	switch strings.ToUpper(m[2]) {
	case "", "B":
		mult = 1
	case "KB":
		mult = 1e3
	case "MB":
		mult = 1e6
	case "GB":
		mult = 1e9
	case "TB":
		mult = 1e12
	case "KIB":
		mult = 1 << 10
	case "MIB":
		mult = 1 << 20
	case "GIB":
		mult = 1 << 30
	case "TIB":
		mult = 1 << 40
	}
	prod := n * mult
	if prod < 0 || prod > float64(math.MaxInt64) {
		return 0, fmt.Errorf("size %q is too large", s)
	}
	return ByteSize(prod), nil
}

// String implements fmt.Stringer.
func (b ByteSize) String() string {
	switch {
	case b >= 1<<30 && b%(1<<30) == 0:
		return fmt.Sprintf("%dGiB", b/(1<<30))
	case b >= 1<<20 && b%(1<<20) == 0:
		return fmt.Sprintf("%dMiB", b/(1<<20))
	case b >= 1<<10 && b%(1<<10) == 0:
		return fmt.Sprintf("%dKiB", b/(1<<10))
	default:
		return strconv.FormatInt(int64(b), 10)
	}
}
