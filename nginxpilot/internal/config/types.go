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

	// Nginx and Tls configure the opt-in managed mode (nginx.manage: true):
	// nginxpilot writes the live nginx config, validates with `nginx -t`,
	// quarantines bad resources, and reloads nginx. Default (manage: false)
	// keeps today's generate-only behavior — print-vhost + manual paste.
	Nginx Nginx `yaml:"nginx"`
	Tls   Tls   `yaml:"tls"`

	// Acme configures certbot-driven certificate issuance (opt-in). When
	// disabled (default) the issue/renew/delete cert endpoints return 501.
	Acme Acme `yaml:"acme"`

	// Upstreams and Proxies are config-only entities in generate-only mode:
	// nginx upstream{} pools and reverse-proxy server{} blocks. In managed
	// mode nginxpilot also writes and reloads them as live nginx config. They
	// exist so `print-vhost` / the admin /vhost endpoint can generate nginx
	// configuration to paste and adapt.
	Upstreams []Upstream `yaml:"upstreams"`
	Proxies   []Proxy    `yaml:"proxies"`

	// Redirects and DeadHosts are lightweight http vhosts: a redirect answers
	// every request with a 30x to another host; a dead host parks a domain on a
	// fixed error code (optionally over TLS, keeping the cert warm). Both share
	// the site/proxy domain namespace.
	Redirects []Redirect `yaml:"redirects"`
	DeadHosts []DeadHost `yaml:"dead_hosts"`

	// AccessLists are named IP allow/deny + basic-auth policies a proxy,
	// redirect or dead host references via `access_list: <name>` (better.md §1).
	// Own namespace, independent of upstream names.
	AccessLists []AccessList `yaml:"access_lists"`

	// StreamUpstreams and Streams are stream-context (L4 TCP/UDP) resources.
	// nginx `stream {}` is a different top-level context than `http {}`, so
	// these render into a separate stream_conf_dir and only take effect in
	// managed mode (with the stream include wired into nginx.conf).
	StreamUpstreams []StreamUpstream `yaml:"stream_upstreams"`
	Streams         []Stream         `yaml:"streams"`

	// Logs configures JSON access-log emission + intake (log_ides.md §1);
	// LogDestinations are the shipping targets (§2) — the 8th managed entity
	// kind, driven over the same fragment REST pattern as everything else.
	// Stream (L4) resources emit no JSON access logs (G3): the stream context
	// has its own log_format with a different variable set — out of scope.
	Logs            Logs             `yaml:"logs"`
	LogDestinations []LogDestination `yaml:"log_destinations"`

	// Path is the main config file path the config was loaded from.
	Path string `yaml:"-"`
}

// Upstream is a named nginx upstream{} block — a pool of backend servers a
// reverse proxy can proxy_pass to by name.
type Upstream struct {
	Name string `yaml:"name" json:"name"`
	// Balancer selects the load-balancing method: "" / round_robin (default),
	// least_conn, or ip_hash.
	Balancer string `yaml:"balancer" json:"balancer,omitempty"`
	// Keepalive sets the keepalive connection cache size (0 = omit).
	Keepalive int              `yaml:"keepalive" json:"keepalive,omitempty"`
	Servers   []UpstreamServer `yaml:"servers" json:"servers"`

	// File records which config file declared this upstream (provenance for
	// duplicate-name errors and logs). Never serialized over the admin API.
	File string `yaml:"-" json:"-"`
}

// UpstreamServer is one backend in an upstream pool.
type UpstreamServer struct {
	// Address is "host:port", an IP:port, or "unix:/path/to.sock".
	Address     string   `yaml:"address" json:"address"`
	Weight      int      `yaml:"weight" json:"weight,omitempty"`
	MaxFails    *int     `yaml:"max_fails" json:"max_fails,omitempty"`
	FailTimeout Duration `yaml:"fail_timeout" json:"fail_timeout,omitempty"`
	Backup      bool     `yaml:"backup" json:"backup,omitempty"`
	Down        bool     `yaml:"down" json:"down,omitempty"`
}

// Proxy is a reverse-proxy vhost: an nginx server{} block whose locations
// proxy_pass to a named upstream or a single inline target.
type Proxy struct {
	Domain string `yaml:"domain" json:"domain"`
	// Enabled toggles the proxy without deleting it (nil/absent = enabled). A
	// disabled proxy stays in config and the admin API but renders no nginx
	// server block, so nginx stops routing its domain.
	Enabled *bool `yaml:"enabled" json:"enabled,omitempty"`
	// Listen is the HTTP port (default DefaultProxyListen).
	Listen int `yaml:"listen" json:"listen,omitempty"`
	// Upstream / Pass set the default backend for all locations. Exactly one
	// of them is required unless every location sets its own. Upstream names
	// an entry in Config.Upstreams; Pass is an inline scheme://host:port.
	Upstream  string          `yaml:"upstream" json:"upstream,omitempty"`
	Pass      string          `yaml:"pass" json:"pass,omitempty"`
	Locations []ProxyLocation `yaml:"locations" json:"locations,omitempty"`

	// Optional proxy tuning applied at the server level.
	ConnectTimeout    Duration `yaml:"connect_timeout" json:"connect_timeout,omitempty"`
	ReadTimeout       Duration `yaml:"read_timeout" json:"read_timeout,omitempty"`
	SendTimeout       Duration `yaml:"send_timeout" json:"send_timeout,omitempty"`
	ClientMaxBodySize ByteSize `yaml:"client_max_body_size" json:"client_max_body_size,omitempty"`

	// WebOptions are the per-host HTTP toggles (TLS, force_ssl, http2, hsts,
	// block_exploits, gzip, advanced) shared with Site, inlined into the YAML.
	WebOptions `yaml:",inline"`

	// AccessList names an access_lists entry whose IP rules / basic auth guard
	// this vhost ("" = open). Unknown names are a validation error.
	AccessList string `yaml:"access_list" json:"access_list,omitempty"`

	// Websocket applies the Upgrade/Connection/HTTP1.1 block to every location
	// (not just per-location). A per-location websocket:true still works too.
	Websocket bool `yaml:"websocket" json:"websocket,omitempty"`

	// Cache configures an http proxy cache (proxy_cache_path + proxy_cache).
	Cache Cache `yaml:"cache" json:"cache,omitempty"`

	// File records which config file declared this proxy (provenance). Never
	// serialized over the admin API.
	File string `yaml:"-" json:"-"`
}

// ProxyLocation maps a location path to a backend, overriding the proxy's
// default Upstream/Pass when set.
type ProxyLocation struct {
	// Path defaults to "/".
	Path     string `yaml:"path" json:"path"`
	Upstream string `yaml:"upstream" json:"upstream,omitempty"`
	Pass     string `yaml:"pass" json:"pass,omitempty"`
	// Websocket adds the Upgrade/Connection headers + HTTP/1.1 for WebSocket
	// and other connection-upgrade traffic.
	Websocket bool `yaml:"websocket" json:"websocket,omitempty"`
	// Advanced is a raw passthrough inside this location block (escape hatch),
	// mirroring WebOptions.Advanced at server level. It rides the same
	// `nginx -t` gate, so a bad snippet only disables this one resource.
	Advanced string `yaml:"advanced" json:"advanced,omitempty"`
}

// IsEnabled reports the effective enabled state (default true).
func (p Proxy) IsEnabled() bool {
	return p.Enabled == nil || *p.Enabled
}

// ListenPort returns the effective listen port for the proxy.
func (p Proxy) ListenPort() int {
	if p.Listen > 0 {
		return p.Listen
	}
	return DefaultProxyListen
}

// Redirect schemes (redirects[].scheme). Auto emits $scheme so the redirect
// preserves whichever of http/https the client used.
const (
	RedirectSchemeAuto  = "auto"
	RedirectSchemeHTTP  = "http"
	RedirectSchemeHTTPS = "https"
)

// DefaultRedirectCode is the status used when redirects[].code is unset.
const DefaultRedirectCode = 301

// Redirect is a redirection host: an nginx server{} block answering every
// request with a configurable 30x to another host, with optional path
// preservation and full WebOptions (TLS/HSTS/http2/...) support.
type Redirect struct {
	Domain string `yaml:"domain" json:"domain"`
	// Enabled toggles the redirect without deleting it (nil/absent = enabled).
	Enabled *bool `yaml:"enabled" json:"enabled,omitempty"`
	// Listen is the HTTP port (default DefaultProxyListen).
	Listen int `yaml:"listen" json:"listen,omitempty"`
	// To is the target host — no scheme, optionally :port.
	To string `yaml:"to" json:"to"`
	// Scheme selects the redirect target scheme: http | https | auto (default
	// auto → $scheme).
	Scheme string `yaml:"scheme" json:"scheme,omitempty"`
	// Code is the redirect status: 301 (default) | 302 | 303 | 307 | 308.
	Code int `yaml:"code" json:"code,omitempty"`
	// PreservePath appends $request_uri to the target (default true).
	PreservePath *bool `yaml:"preserve_path" json:"preserve_path,omitempty"`

	WebOptions `yaml:",inline"`

	// AccessList names an access_lists entry guarding this redirect ("" = open).
	AccessList string `yaml:"access_list" json:"access_list,omitempty"`

	// File records which config file declared this redirect (provenance).
	File string `yaml:"-" json:"-"`
}

// IsEnabled reports the effective enabled state (default true).
func (r Redirect) IsEnabled() bool { return r.Enabled == nil || *r.Enabled }

// ListenPort returns the effective listen port for the redirect.
func (r Redirect) ListenPort() int {
	if r.Listen > 0 {
		return r.Listen
	}
	return DefaultProxyListen
}

// CodeOrDefault returns the effective redirect status code (301 when unset).
func (r Redirect) CodeOrDefault() int {
	if r.Code > 0 {
		return r.Code
	}
	return DefaultRedirectCode
}

// SchemeOrAuto returns the effective target scheme ("auto" when unset).
func (r Redirect) SchemeOrAuto() string {
	if r.Scheme == "" {
		return RedirectSchemeAuto
	}
	return r.Scheme
}

// PreservesPath reports the effective preserve_path (default true).
func (r Redirect) PreservesPath() bool {
	return r.PreservePath == nil || *r.PreservePath
}

// DefaultDeadHostCode is the status used when dead_hosts[].code is unset.
const DefaultDeadHostCode = 404

// DeadHost parks a domain: nginx answers every request with a fixed error
// code, optionally over TLS (keeping the cert warm while a service is
// retired). code 444 closes the connection without a response.
type DeadHost struct {
	Domain string `yaml:"domain" json:"domain"`
	// Enabled toggles the dead host without deleting it (nil/absent = enabled).
	Enabled *bool `yaml:"enabled" json:"enabled,omitempty"`
	// Listen is the HTTP port (default DefaultProxyListen).
	Listen int `yaml:"listen" json:"listen,omitempty"`
	// Code is the parked status: 404 (default) | 410 | 444 | 503.
	Code int `yaml:"code" json:"code,omitempty"`

	WebOptions `yaml:",inline"`

	// AccessList names an access_lists entry guarding this dead host ("" = open).
	AccessList string `yaml:"access_list" json:"access_list,omitempty"`

	// File records which config file declared this dead host (provenance).
	File string `yaml:"-" json:"-"`
}

// IsEnabled reports the effective enabled state (default true).
func (d DeadHost) IsEnabled() bool { return d.Enabled == nil || *d.Enabled }

// ListenPort returns the effective listen port for the dead host.
func (d DeadHost) ListenPort() int {
	if d.Listen > 0 {
		return d.Listen
	}
	return DefaultProxyListen
}

// CodeOrDefault returns the effective parked status code (404 when unset).
func (d DeadHost) CodeOrDefault() int {
	if d.Code > 0 {
		return d.Code
	}
	return DefaultDeadHostCode
}

// Access-list satisfy modes (access_lists[].satisfy). `all` (the default)
// requires every enabled mechanism (IP rules AND basic auth) to pass; `any`
// grants on the first one that does.
const (
	SatisfyAll = "all"
	SatisfyAny = "any"
)

// AccessList is a named access policy: ordered IP allow/deny rules (rendered
// then closed with `deny all;`) and/or htpasswd basic-auth users. Referenced
// from Proxy/Redirect/DeadHost via their `access_list` field; rendered into
// each referencing server block plus one generated htpasswd file under
// <data_dir>/access/<name>.htpasswd.
type AccessList struct {
	// Name is the identifier ([A-Za-z0-9_]+, its own namespace).
	Name string `yaml:"name" json:"name"`
	// Satisfy: all (default) | any — nginx's `satisfy` directive.
	Satisfy string `yaml:"satisfy" json:"satisfy,omitempty"`
	// PassAuth forwards the client's Authorization header upstream; false (the
	// default) consumes it at the proxy so backend auth never sees it.
	PassAuth bool `yaml:"pass_auth" json:"pass_auth,omitempty"`
	// Users are htpasswd entries. Passwords are stored as apr1 hashes only —
	// the admin API hashes plaintext server-side and GET masks the hash.
	Users []AccessListUser `yaml:"users" json:"users,omitempty"`
	// Rules are ordered allow/deny entries (IP, CIDR, or "all"); when any are
	// present the renderer appends a final `deny all;`.
	Rules []AccessRule `yaml:"rules" json:"rules,omitempty"`

	// File records which config file declared this list (provenance). Never
	// serialized over the admin API.
	File string `yaml:"-" json:"-"`
}

// AccessListUser is one basic-auth account of an access list.
type AccessListUser struct {
	Username string `yaml:"username" json:"username"`
	// PasswordHash is the crypt-format hash ("$apr1$…"). Write-only over the
	// admin API: fragments store it, GET responses mask it. A user without a
	// hash is skipped by the htpasswd generator (password pending).
	PasswordHash string `yaml:"password_hash" json:"password_hash,omitempty"`
}

// AccessRule is one ordered allow/deny entry. Exactly one of Allow/Deny is
// set; the value is an IP, a CIDR, or the literal "all".
type AccessRule struct {
	Allow string `yaml:"allow" json:"allow,omitempty"`
	Deny  string `yaml:"deny" json:"deny,omitempty"`
}

// SatisfyOrAll returns the effective satisfy mode ("all" when unset).
func (a AccessList) SatisfyOrAll() string {
	if a.Satisfy == "" {
		return SatisfyAll
	}
	return a.Satisfy
}

// HasUsers reports whether any user has a usable password hash (drives
// auth_basic emission — a list whose users are all password-pending renders
// no auth_basic, or nginx would lock everyone out against an empty file).
func (a AccessList) HasUsers() bool {
	for _, u := range a.Users {
		if u.PasswordHash != "" {
			return true
		}
	}
	return false
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
	Domain  string   `yaml:"domain" json:"domain"`
	Source  Source   `yaml:"source" json:"source"`
	Exclude []string `yaml:"exclude" json:"exclude,omitempty"`

	// WebOptions are the per-host HTTP toggles (TLS, force_ssl, http2, hsts,
	// block_exploits, gzip, advanced), inlined into the YAML. Meaningful for a
	// static site served by nginx in managed mode (and emitted by print-vhost).
	WebOptions `yaml:",inline"`

	// File records which config file declared this site (provenance for
	// duplicate-domain errors and logs). Never serialized over the admin API.
	File string `yaml:"-" json:"-"`
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
	Type         string   `yaml:"type" json:"type"`
	URL          string   `yaml:"url" json:"url"`
	Interval     Duration `yaml:"interval" json:"interval,omitempty"`
	KeepReleases *int     `yaml:"keep_releases" json:"keep_releases,omitempty"`
	Auth         Auth     `yaml:"auth" json:"auth"`

	// git only
	Branch string `yaml:"branch" json:"branch,omitempty"`
	Subdir string `yaml:"subdir" json:"subdir,omitempty"`

	// post-fetch gate (both source types)
	RequireFile []string `yaml:"require_file" json:"require_file,omitempty"`

	// http-zip only
	ChecksumURL     string `yaml:"checksum_url" json:"checksum_url,omitempty"`
	StripComponents *int   `yaml:"strip_components" json:"strip_components,omitempty"`
	AllowInsecure   bool   `yaml:"allow_insecure" json:"allow_insecure,omitempty"`
	Limits          Limits `yaml:"limits" json:"limits"`
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
	Method string `yaml:"method" json:"method,omitempty"`

	// ssh-key: supply the private key either by path (key_file) or by
	// reference to an env var holding the key material (key_env). Exactly
	// one is required. key_env materializes the key into a daemon-owned
	// 0600 temp file at sync time — no on-host staging/ownership dance.
	KeyFile    string `yaml:"key_file" json:"key_file,omitempty"`
	KeyEnv     string `yaml:"key_env" json:"key_env,omitempty"`
	KnownHosts string `yaml:"known_hosts" json:"known_hosts,omitempty"`

	// https-token / basic
	Username string `yaml:"username" json:"username,omitempty"`

	// token references (https-token, bearer)
	TokenEnv  string `yaml:"token_env" json:"token_env,omitempty"`
	TokenFile string `yaml:"token_file" json:"token_file,omitempty"`

	// basic password references
	PasswordEnv  string `yaml:"password_env" json:"password_env,omitempty"`
	PasswordFile string `yaml:"password_file" json:"password_file,omitempty"`

	// header
	Name      string `yaml:"name" json:"name,omitempty"`
	ValueEnv  string `yaml:"value_env" json:"value_env,omitempty"`
	ValueFile string `yaml:"value_file" json:"value_file,omitempty"`

	// Inline secret traps: declared so strict decoding accepts the key and
	// validation can emit a targeted error instead of "unknown field". Never
	// serialized — they are always empty in a validated config anyway.
	Token    string `yaml:"token" json:"-"`
	Password string `yaml:"password" json:"-"`
	Value    string `yaml:"value" json:"-"`
	Key      string `yaml:"key" json:"-"`
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
	MaxArchiveSize      ByteSize `yaml:"max_archive_size" json:"max_archive_size,omitempty"`
	MaxUncompressedSize ByteSize `yaml:"max_uncompressed_size" json:"max_uncompressed_size,omitempty"`
	MaxEntries          int      `yaml:"max_entries" json:"max_entries,omitempty"`
	MaxCompressionRatio int      `yaml:"max_compression_ratio" json:"max_compression_ratio,omitempty"`
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

// MarshalJSON renders the duration as its human string ("5m", "30s") so the
// admin read-API is symmetric with the YAML the write-API accepts.
func (d Duration) MarshalJSON() ([]byte, error) {
	return []byte(strconv.Quote(d.String())), nil
}

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

// MarshalJSON renders the size as its human string ("512MiB") so the admin
// read-API is symmetric with the YAML the write-API accepts.
func (b ByteSize) MarshalJSON() ([]byte, error) {
	return []byte(strconv.Quote(b.String())), nil
}
