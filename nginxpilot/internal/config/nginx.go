package config

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

// TLS modes for a resource (proxies, sites, streams).
const (
	TLSOff      = "off"      // HTTP only (default).
	TLSAuto     = "auto"     // use a cert if one is found; else serve plain + warn.
	TLSRequired = "required" // no cert found → resource is disabled (quarantined).
)

// Stream-context upstream load-balancing methods. nginx `stream {}` upstreams
// support a different set than `http {}` (hash, not ip_hash); the empty string
// is round-robin (no directive emitted).
const (
	StreamBalancerRoundRobin = "round_robin"
	StreamBalancerLeastConn  = "least_conn"
	StreamBalancerHash       = "hash"
)

// Protocols for a stream resource.
const (
	ProtocolTCP = "tcp"
	ProtocolUDP = "udp"
)

// Default managed-mode paths and commands, applied when nginx.manage is true
// and the field is unset (see applyNginxDefaults).
const (
	DefaultConfDir           = "/etc/nginx/conf.d/nginxpilot.d"
	DefaultStreamConfDir     = "/etc/nginx/stream.d/nginxpilot.d"
	DefaultManagedIncludeDir = "/etc/nginx/conf.d/nginxpilot.d"
	DefaultWatchInterval     = 60 // seconds
)

// DefaultHSTSMaxAge is the max-age (seconds, 2 years) used when hsts is enabled
// via a bare `true` without an explicit max_age.
const DefaultHSTSMaxAge = 63072000

// Target-check severities / modes (nginx.target_checks).
const (
	TargetDNSError = "error" // default: an unresolvable host fails the API write
	TargetDNSWarn  = "warn"  // demote to a response warning
	TargetDNSOff   = "off"

	TargetReachProbe = "probe"
	TargetReachOff   = "off" // default
)

// DefaultTargetCheckTimeout is the per-check budget shared by Tiers 2-3.
const DefaultTargetCheckTimeout = 3 * time.Second

// Reconcile policy values (nginx.reconcile.on_failure).
const (
	ReconcileWarn    = "warn"    // default: mark at_risk, never touch traffic
	ReconcileDisable = "disable" // trigger an apply so the quarantine pass disables it
)

// Reconcile loop bounds/defaults.
const (
	DefaultReconcileInterval = time.Minute
	MinReconcileInterval     = 15 * time.Second
)

// Nginx configures managed mode — the opt-in where nginxpilot writes the live
// nginx config, validates it with `nginx -t`, quarantines bad resources, and
// reloads nginx. Default (Manage: false) keeps generate-only behavior.
type Nginx struct {
	Manage            bool     `yaml:"manage"`
	ConfDir           string   `yaml:"conf_dir"`
	StreamConfDir     string   `yaml:"stream_conf_dir"`
	ManagedIncludeDir string   `yaml:"managed_include_dir"`
	TestCmd           []string `yaml:"test_cmd"`
	ReloadCmd         []string `yaml:"reload_cmd"`

	// TargetChecks configures pre-flight backend checking (DNS + reachability).
	// The lexical tier always runs in Validate; these settings gate only the
	// network tiers on the admin write path / apply annotations / CLI opt-in.
	TargetChecks TargetChecks `yaml:"target_checks"`

	// Reconcile configures the periodic dry-run health check of the managed
	// config (detect DNS rot, auto-recover cleared quarantines).
	Reconcile Reconcile `yaml:"reconcile"`

	// RealIP configures client-IP restoration behind a CDN/proxy (better.md §8):
	// a managed include with set_real_ip_from for provider-published ranges
	// (fetched on a ticker, cached on disk) plus static CIDRs.
	RealIP RealIP `yaml:"real_ip"`

	// DefaultCatchAll opts nginxpilot into owning the default/catch-all vhost
	// (a request for a host no resource claims gets 444, JSON-logged like every
	// other managed vhost) instead of relying on an out-of-band static one. Off
	// by default: an existing managed deployment may already declare its own
	// default_server elsewhere, and turning this on unconditionally would
	// collide with it (nginx -t then quarantines nginxpilot's own copy — see
	// the crash-proof apply pass — so a collision degrades, never crashes, but
	// the opt-in avoids the surprise/quarantine noise on upgrade).
	DefaultCatchAll bool `yaml:"default_catch_all"`
}

// Real-IP range providers (nginx.real_ip.providers).
const (
	RealIPProviderCloudflare = "cloudflare"
	RealIPProviderCloudfront = "cloudfront"
)

// DefaultRealIPHeader is the header the real client IP is restored from when
// real_ip.header is unset.
const DefaultRealIPHeader = "X-Forwarded-For"

// DefaultRealIPRefresh is the provider-range refresh cadence when unset.
const DefaultRealIPRefresh = 6 * time.Hour

// RealIP configures nginx's real_ip module for deployments behind a CDN or
// trusted proxy: without it, allow/deny rules (C1 access lists) and logs see
// the CDN's IPs. Renders into the managed 00-nginxpilot-realip.conf include.
type RealIP struct {
	Enabled bool `yaml:"enabled"`
	// Header carrying the original client IP: X-Forwarded-For (default),
	// CF-Connecting-IP, X-Real-IP, … (any header token).
	Header string `yaml:"header"`
	// Recursive sets real_ip_recursive (default true — walk past every trusted
	// hop, not just the last one).
	Recursive *bool `yaml:"recursive"`
	// Providers to fetch published ranges for: cloudflare | cloudfront.
	// Fetched on a ticker, cached under <data_dir>/realip/, applied on change.
	Providers []string `yaml:"providers"`
	// StaticCidrs are operator-supplied trusted ranges, always included.
	StaticCidrs []string `yaml:"static_cidrs"`
	// RefreshInterval between provider fetches (default 6h).
	RefreshInterval Duration `yaml:"refresh_interval"`
}

// HeaderOrDefault returns the effective real_ip_header.
func (r RealIP) HeaderOrDefault() string {
	if r.Header == "" {
		return DefaultRealIPHeader
	}
	return r.Header
}

// IsRecursive reports the effective real_ip_recursive (default true).
func (r RealIP) IsRecursive() bool { return r.Recursive == nil || *r.Recursive }

// RefreshOrDefault returns the effective provider refresh interval.
func (r RealIP) RefreshOrDefault() time.Duration {
	if r.RefreshInterval > 0 {
		return time.Duration(r.RefreshInterval)
	}
	return DefaultRealIPRefresh
}

// TargetChecks tunes the network target-check tiers. Accessors are
// default-aware (instead of relying on defaults-fill) because they must work
// in generate-only mode too, where applyNginxDefaults is inert.
type TargetChecks struct {
	DNS          string   `yaml:"dns"`          // error (default) | warn | off — API-write severity
	Reachability string   `yaml:"reachability"` // probe | off (default) — always warn-only
	Timeout      Duration `yaml:"timeout"`      // per-check budget (default 3s)
}

// DNSSeverity returns the effective DNS-check severity ("error" when unset).
func (t TargetChecks) DNSSeverity() string {
	if t.DNS == "" {
		return TargetDNSError
	}
	return t.DNS
}

// ReachabilityEnabled reports whether the opt-in TCP probe is on.
func (t TargetChecks) ReachabilityEnabled() bool {
	return t.Reachability == TargetReachProbe
}

// TimeoutOrDefault returns the per-check budget (3s when unset).
func (t TargetChecks) TimeoutOrDefault() time.Duration {
	if t.Timeout > 0 {
		return time.Duration(t.Timeout)
	}
	return DefaultTargetCheckTimeout
}

// Reconcile configures the periodic managed-config health check. The loop
// dry-runs the full config against nginx -t every Interval, marks resources
// that started failing as at_risk (policy warn) or disables them (policy
// disable), and always auto-recovers quarantined resources that pass again.
type Reconcile struct {
	Enabled   *bool    `yaml:"enabled"`    // nil = enabled (managed mode)
	Interval  Duration `yaml:"interval"`   // default 1m, min 15s
	OnFailure string   `yaml:"on_failure"` // warn (default) | disable
}

// ReconcileEnabled reports the effective enabled state (default true).
func (r Reconcile) ReconcileEnabled() bool {
	return r.Enabled == nil || *r.Enabled
}

// IntervalOrDefault returns the effective tick interval (1m when unset).
func (r Reconcile) IntervalOrDefault() time.Duration {
	if r.Interval > 0 {
		return time.Duration(r.Interval)
	}
	return DefaultReconcileInterval
}

// OnFailureOrWarn returns the effective failure policy ("warn" when unset).
func (r Reconcile) OnFailureOrWarn() string {
	if r.OnFailure == "" {
		return ReconcileWarn
	}
	return r.OnFailure
}

// Tls configures TLS termination from a cert directory. nginxpilot consumes
// certs (certbot/acme.sh/external issue and renew them) and reloads on renewal.
type Tls struct {
	// CertDir / CertDirEnv name the directory holding certs (exactly one when
	// any resource opts into TLS). CertDirEnv is resolved at startup.
	CertDir    string `yaml:"cert_dir"`
	CertDirEnv string `yaml:"cert_dir_env"`
	// ReloadOnChange watches the cert dir and reloads on renewal (default true).
	ReloadOnChange *bool `yaml:"reload_on_change"`
	// WatchInterval is the cert-dir poll interval (default 60s).
	WatchInterval Duration `yaml:"watch_interval"`
}

// ReloadOnChangeEnabled reports the effective reload_on_change (default true).
func (t Tls) ReloadOnChangeEnabled() bool {
	return t.ReloadOnChange == nil || *t.ReloadOnChange
}

// ResolveDir resolves the cert directory: cert_dir_env (an env var holding the
// path) takes precedence over a direct cert_dir. Returns "" when neither is set
// (no TLS configured). An env var named but unset is an error.
func (t Tls) ResolveDir() (string, error) {
	if t.CertDirEnv != "" {
		v, ok := os.LookupEnv(t.CertDirEnv)
		if !ok {
			return "", fmt.Errorf("tls.cert_dir_env %s is not set", t.CertDirEnv)
		}
		return v, nil
	}
	return t.CertDir, nil
}

// WebOptions are the per-host HTTP toggles shared by Site and Proxy.
type WebOptions struct {
	// TLS selects TLS termination: "" / off (default) | auto | required.
	TLS string `yaml:"tls" json:"tls,omitempty"`
	// ForceSSL emits a plain-80 → 301 https redirect (requires effective TLS).
	ForceSSL bool `yaml:"force_ssl" json:"force_ssl,omitempty"`
	// HTTP2 enables `http2 on;` in the https server (requires effective TLS).
	HTTP2 bool `yaml:"http2" json:"http2,omitempty"`
	// HSTS adds the Strict-Transport-Security header (requires effective TLS).
	HSTS HSTS `yaml:"hsts" json:"hsts,omitempty"`
	// BlockExploits includes the managed block-exploits snippet (managed mode)
	// or emits it inline (print-vhost).
	BlockExploits bool `yaml:"block_exploits" json:"block_exploits,omitempty"`
	// Gzip turns gzip on for responses.
	Gzip bool `yaml:"gzip" json:"gzip,omitempty"`
	// Advanced is a raw passthrough inside the server block (escape hatch). It
	// rides the same `nginx -t` gate, so a bad snippet only disables this one
	// resource.
	Advanced string `yaml:"advanced" json:"advanced,omitempty"`
}

// TLSMode returns the effective TLS mode ("off" when unset).
func (w WebOptions) TLSMode() string {
	if w.TLS == "" {
		return TLSOff
	}
	return w.TLS
}

// WantsTLS reports whether the resource opted into TLS (auto or required).
func (w WebOptions) WantsTLS() bool {
	m := w.TLSMode()
	return m == TLSAuto || m == TLSRequired
}

// HSTS controls the Strict-Transport-Security header. It accepts either a bare
// bool (`hsts: true`) or a mapping (`hsts: { max_age:…, include_subdomains:…,
// preload:… }`); a mapping implies enabled. JSON always serializes the struct
// form so the admin read-API round-trips.
type HSTS struct {
	Enabled bool `json:"enabled,omitempty"`
	// MaxAge in seconds (0 → DefaultHSTSMaxAge when enabled).
	MaxAge int `json:"max_age,omitempty"`
	// IncludeSubdomains defaults to true when enabled (nil = default).
	IncludeSubdomains *bool `json:"include_subdomains,omitempty"`
	Preload           bool  `json:"preload,omitempty"`
}

// UnmarshalYAML accepts either a bool or a mapping.
func (h *HSTS) UnmarshalYAML(node *yaml.Node) error {
	var b bool
	if err := node.Decode(&b); err == nil {
		h.Enabled = b
		return nil
	}
	var raw struct {
		Enabled           *bool `yaml:"enabled"`
		MaxAge            int   `yaml:"max_age"`
		IncludeSubdomains *bool `yaml:"include_subdomains"`
		Preload           bool  `yaml:"preload"`
	}
	if err := node.Decode(&raw); err != nil {
		return fmt.Errorf("hsts must be a bool or a {max_age, include_subdomains, preload} mapping: %w", err)
	}
	h.Enabled = raw.Enabled == nil || *raw.Enabled // a mapping implies enabled unless explicitly false
	h.MaxAge = raw.MaxAge
	h.IncludeSubdomains = raw.IncludeSubdomains
	h.Preload = raw.Preload
	return nil
}

// MaxAgeOrDefault returns MaxAge, or DefaultHSTSMaxAge when zero.
func (h HSTS) MaxAgeOrDefault() int {
	if h.MaxAge > 0 {
		return h.MaxAge
	}
	return DefaultHSTSMaxAge
}

// IncludesSubdomains reports the effective include_subdomains (default true).
func (h HSTS) IncludesSubdomains() bool {
	return h.IncludeSubdomains == nil || *h.IncludeSubdomains
}

// Cache configures an nginx http proxy cache for a proxy.
type Cache struct {
	Enabled bool `yaml:"enabled" json:"enabled,omitempty"`
	// Valid is the proxy_cache_valid argument list, e.g. ["200 10m", "404 1m"].
	Valid []string `yaml:"valid" json:"valid,omitempty"`
	// ZoneSize backs the managed proxy_cache_path keys_zone size (default 10m).
	ZoneSize string `yaml:"zone_size" json:"zone_size,omitempty"`
}

// ZoneSizeOrDefault returns ZoneSize, or "10m" when unset.
func (c Cache) ZoneSizeOrDefault() string {
	if c.ZoneSize == "" {
		return "10m"
	}
	return c.ZoneSize
}

// StreamUpstream is a stream-context (L4) upstream pool, separate from http
// Upstreams — the two namespaces don't collide.
type StreamUpstream struct {
	Name     string                 `yaml:"name" json:"name"`
	Balancer string                 `yaml:"balancer" json:"balancer,omitempty"`
	Servers  []StreamUpstreamServer `yaml:"servers" json:"servers"`

	// File records which config file declared this upstream (provenance).
	File string `yaml:"-" json:"-"`
}

// StreamUpstreamServer is one backend in a stream upstream pool.
type StreamUpstreamServer struct {
	Address     string   `yaml:"address" json:"address"`
	Weight      int      `yaml:"weight" json:"weight,omitempty"`
	MaxFails    *int     `yaml:"max_fails" json:"max_fails,omitempty"`
	FailTimeout Duration `yaml:"fail_timeout" json:"fail_timeout,omitempty"`
	Backup      bool     `yaml:"backup" json:"backup,omitempty"`
	Down        bool     `yaml:"down" json:"down,omitempty"`
}

// Stream is an L4 TCP/UDP proxy: an nginx stream-context server{} block. It is
// keyed by Name (L4 has no Host), not a domain.
type Stream struct {
	Name     string `yaml:"name" json:"name"`
	Listen   int    `yaml:"listen" json:"listen"`
	Protocol string `yaml:"protocol" json:"protocol,omitempty"` // tcp (default) | udp
	// Upstream / Pass set the backend (exactly one). Upstream names a
	// StreamUpstream; Pass is an inline host:port.
	Upstream       string   `yaml:"upstream" json:"upstream,omitempty"`
	Pass           string   `yaml:"pass" json:"pass,omitempty"`
	ProxyProtocol  bool     `yaml:"proxy_protocol" json:"proxy_protocol,omitempty"`
	ConnectTimeout Duration `yaml:"connect_timeout" json:"connect_timeout,omitempty"`
	// Timeout maps to proxy_timeout.
	Timeout Duration `yaml:"timeout" json:"timeout,omitempty"`
	// TLS optionally terminates TLS on the listen socket (listen … ssl). Modes
	// are off (default) | auto | required, like http resources; the cert is
	// looked up by TLSDomain (L4 has no SNI-derived domain).
	TLS       string `yaml:"tls" json:"tls,omitempty"`
	TLSDomain string `yaml:"tls_domain" json:"tls_domain,omitempty"`

	// File records which config file declared this stream (provenance).
	File string `yaml:"-" json:"-"`
}

// ProtocolOrTCP returns the effective protocol ("tcp" when unset).
func (s Stream) ProtocolOrTCP() string {
	if s.Protocol == "" {
		return ProtocolTCP
	}
	return s.Protocol
}

// TLSMode returns the effective TLS mode for the stream ("off" when unset).
func (s Stream) TLSMode() string {
	if s.TLS == "" {
		return TLSOff
	}
	return s.TLS
}

// WantsTLS reports whether the stream opted into TLS termination.
func (s Stream) WantsTLS() bool {
	m := s.TLSMode()
	return m == TLSAuto || m == TLSRequired
}
