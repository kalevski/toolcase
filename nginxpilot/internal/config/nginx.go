package config

import (
	"fmt"
	"os"

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
