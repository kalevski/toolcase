// Package config parses, merges and validates the daemon configuration (one
// main YAML file plus optional zones.d/ fragments pulled in via include:
// globs). Decoding is strict: unknown keys are errors.
package config

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// Record types zonewright renders. Anything else is a validation error — the
// set is deliberately the everyday authoritative-zone vocabulary, not the full
// IANA registry.
const (
	TypeA     = "A"
	TypeAAAA  = "AAAA"
	TypeCNAME = "CNAME"
	TypeMX    = "MX"
	TypeNS    = "NS"
	TypePTR   = "PTR"
	TypeSRV   = "SRV"
	TypeTXT   = "TXT"
	TypeCAA   = "CAA"
)

// RecordTypes lists every supported record type in rendering order.
var RecordTypes = []string{TypeNS, TypeA, TypeAAAA, TypeCNAME, TypeMX, TypeTXT, TypeSRV, TypeCAA, TypePTR}

// Default admin listen address. 9053 rather than nginxpilot's 9090 so the two
// daemons can share a host without a port clash.
const DefaultAdminListen = "127.0.0.1:9053"

// Config is the merged result of the main file and all included fragments.
type Config struct {
	DataDir  string   `yaml:"data_dir"`
	LogLevel string   `yaml:"log_level"`
	Admin    Admin    `yaml:"admin"`
	Bind     Bind     `yaml:"bind"`
	Defaults Defaults `yaml:"defaults"`
	Include  []string `yaml:"include"`
	Zones    []Zone   `yaml:"zones"`

	// Cluster turns on replication between zonewright servers
	// (REPLICATION.md). Absent → single node.
	Cluster *Cluster `yaml:"cluster"`

	// Path is the main config file path the config was loaded from.
	Path string `yaml:"-"`
}

// Admin configures the HTTP admin endpoint.
type Admin struct {
	// Listen is the admin bind address. nil/absent → DefaultAdminListen; an
	// explicit empty string disables the endpoint.
	Listen    *string `yaml:"listen"`
	TokenEnv  string  `yaml:"token_env"`
	TokenFile string  `yaml:"token_file"`
	// TLS serves the admin API over HTTPS. A non-loopback listener requires
	// it (the bearer token must never cross a network in clear text) unless
	// AllowInsecureHTTP is set — for a private network, or a loopback-bound
	// port published behind a TLS proxy.
	TLS               TLSFiles `yaml:"tls"`
	AllowInsecureHTTP bool     `yaml:"allow_insecure_http"`
	// ScopedTokens are extra bearer tokens that may only do what their scope
	// allows, optionally limited to some zones. They need the admin token to
	// be set (without it the API has no authentication at all).
	ScopedTokens []ScopedToken `yaml:"scoped_tokens"`
}

// ScopeACME allows exactly what an ACME DNS-01 client needs: GET /lookup, and
// adding, replacing and deleting TXT records named _acme-challenge or
// _acme-challenge.<label>… — nothing else.
const ScopeACME = "acme"

// ScopedToken is one limited bearer token.
type ScopedToken struct {
	// Name identifies the token in logs and errors ([a-z0-9-]+, unique).
	Name      string `yaml:"name"`
	TokenEnv  string `yaml:"token_env"`
	TokenFile string `yaml:"token_file"`
	Scope     string `yaml:"scope"`
	// Zones limits the token to these zones (normalized at validation).
	// Empty means no zone at all — a token reaches every zone only with
	// AllZones, never by omission.
	Zones []string `yaml:"zones"`
	// AllZones lets the token reach every zone. Exclusive with Zones.
	AllZones bool `yaml:"all_zones"`
}

// TLSFiles is a certificate/key pair on disk (PEM).
type TLSFiles struct {
	CertFile string `yaml:"cert_file"`
	KeyFile  string `yaml:"key_file"`
}

// Enabled reports whether both files are set.
func (t TLSFiles) Enabled() bool { return t.CertFile != "" && t.KeyFile != "" }

// ListenAddr returns the effective admin listen address ("" = disabled).
func (a Admin) ListenAddr() string {
	if a.Listen == nil {
		return DefaultAdminListen
	}
	return *a.Listen
}

// Bind describes where zonewright writes BIND's inputs and how it asks BIND to
// check and load them. A command list left out takes the default; an explicit
// empty list ([]) disables that step (useful for tests and for setups where
// something else reloads named).
type Bind struct {
	// ZoneDir holds one rendered <zone>.db file per zone (default
	// <data_dir>/zones). named must be able to read it.
	ZoneDir string `yaml:"zone_dir"`
	// ConfFile is the named.conf fragment listing every zone (default
	// <data_dir>/named.zones.conf). Include it from named.conf.
	ConfFile string `yaml:"conf_file"`
	// CheckZoneCmd is run as `<cmd...> <zone> <file>` against every staged
	// zone file (default named-checkzone).
	CheckZoneCmd []string `yaml:"check_zone_cmd"`
	// CheckConfCmd is run as `<cmd...> <file>` against the staged conf
	// fragment (default named-checkconf).
	CheckConfCmd []string `yaml:"check_conf_cmd"`
	// ReloadCmd is run after anything on disk changed (default rndc reload).
	ReloadCmd []string `yaml:"reload_cmd"`
}

// Defaults are the per-zone values a zone inherits when it sets none itself.
type Defaults struct {
	TTL           TTL      `yaml:"ttl"`
	Nameservers   []string `yaml:"nameservers"`
	SOA           SOA      `yaml:"soa"`
	AllowTransfer []string `yaml:"allow_transfer"`
	AlsoNotify    []string `yaml:"also_notify"`
}

// Zone is one authoritative (primary) zone.
type Zone struct {
	// Name is the zone apex, e.g. "example.com" (no trailing dot).
	Name string `yaml:"name" json:"name"`
	// TTL is the zone's $TTL and the default for records that set none.
	TTL TTL `yaml:"ttl,omitempty" json:"ttl,omitempty"`
	// SOA overrides individual fields of defaults.soa for this zone.
	SOA SOA `yaml:"soa,omitempty" json:"soa,omitzero"`
	// Nameservers become the apex NS RRset (absolute names). Falls back to
	// defaults.nameservers.
	Nameservers []string `yaml:"nameservers,omitempty" json:"nameservers,omitempty"`
	// AllowTransfer / AlsoNotify are secondary-server ACLs (IPs or CIDRs).
	// An empty allow_transfer renders `allow-transfer { none; }`.
	AllowTransfer []string `yaml:"allow_transfer,omitempty" json:"allow_transfer,omitempty"`
	AlsoNotify    []string `yaml:"also_notify,omitempty" json:"also_notify,omitempty"`
	Records       []Record `yaml:"records,omitempty" json:"records"`

	// File records which config file declared this zone (provenance for
	// duplicate-name errors and the admin write path). Never serialized.
	File string `yaml:"-" json:"-"`

	// Runtime-only fields set for replicated zones (never from YAML/JSON).
	// Serial, when non-zero, is published as-is instead of being derived by
	// the apply engine. Invalid, when set, makes the engine keep serving the
	// last good file (the merged state failed validation, §6).
	Serial  uint32 `yaml:"-" json:"-"`
	Invalid string `yaml:"-" json:"-"`
}

// SOA holds the start-of-authority fields. Any zero field inherits from
// defaults.soa, then from the built-in defaults. The serial is never
// configured — zonewright owns it (see internal/state).
type SOA struct {
	// PrimaryNS is the MNAME (default: the zone's first nameserver).
	PrimaryNS string `yaml:"primary_ns,omitempty" json:"primary_ns,omitempty"`
	// AdminEmail is the RNAME as an address, e.g. hostmaster@example.com
	// (default: hostmaster@<zone>).
	AdminEmail string `yaml:"admin_email,omitempty" json:"admin_email,omitempty"`
	Refresh    TTL    `yaml:"refresh,omitempty" json:"refresh,omitempty"`
	Retry      TTL    `yaml:"retry,omitempty" json:"retry,omitempty"`
	Expire     TTL    `yaml:"expire,omitempty" json:"expire,omitempty"`
	// Minimum is the negative-caching TTL (RFC 2308).
	Minimum TTL `yaml:"minimum,omitempty" json:"minimum,omitempty"`
}

// Record is one resource record. Name is relative to the zone ("@" = apex,
// "*" wildcards allowed) or absolute with a trailing dot. Hostname values
// (CNAME/NS/PTR/MX/SRV targets) are absolute when they contain a dot — the
// trailing dot is optional — and relative to the zone when they are a single
// label or "@".
type Record struct {
	Name  string `yaml:"name" json:"name"`
	Type  string `yaml:"type" json:"type"`
	TTL   TTL    `yaml:"ttl,omitempty" json:"ttl,omitempty"`
	Value string `yaml:"value" json:"value"`
	// Priority is required for MX and SRV.
	Priority *int `yaml:"priority,omitempty" json:"priority,omitempty"`
	// Weight and Port are required for SRV.
	Weight *int `yaml:"weight,omitempty" json:"weight,omitempty"`
	Port   *int `yaml:"port,omitempty" json:"port,omitempty"`
	// Flags (default 0) and Tag (issue | issuewild | iodef | …) are CAA only.
	Flags *int   `yaml:"flags,omitempty" json:"flags,omitempty"`
	Tag   string `yaml:"tag,omitempty" json:"tag,omitempty"`
}

// TTL is a duration in whole seconds, BIND style. It accepts a bare integer
// (seconds) or a unit string: "300", "5m", "1h", "1d", "2w", "1h30m".
type TTL uint32

// MaxTTL is the RFC 2181 ceiling (2^31 - 1).
const MaxTTL = 1<<31 - 1

// ParseTTL parses the formats TTL accepts.
func ParseTTL(s string) (TTL, error) {
	s = strings.TrimSpace(strings.ToLower(s))
	if s == "" {
		return 0, fmt.Errorf("empty ttl")
	}
	if n, err := strconv.ParseUint(s, 10, 64); err == nil {
		if n > MaxTTL {
			return 0, fmt.Errorf("ttl %q exceeds %d seconds", s, MaxTTL)
		}
		return TTL(n), nil
	}
	var total uint64
	rest := s
	for rest != "" {
		i := 0
		for i < len(rest) && rest[i] >= '0' && rest[i] <= '9' {
			i++
		}
		if i == 0 || i == len(rest) {
			return 0, fmt.Errorf("invalid ttl %q (want seconds or e.g. 5m, 1h, 1d, 1w)", s)
		}
		n, err := strconv.ParseUint(rest[:i], 10, 64)
		if err != nil || n > MaxTTL {
			return 0, fmt.Errorf("ttl %q exceeds %d seconds", s, MaxTTL)
		}
		var mult uint64
		switch rest[i] {
		case 's':
			mult = 1
		case 'm':
			mult = 60
		case 'h':
			mult = 3600
		case 'd':
			mult = 86400
		case 'w':
			mult = 604800
		default:
			return 0, fmt.Errorf("invalid ttl unit %q in %q (s, m, h, d, w)", rest[i], s)
		}
		total += n * mult
		if total > MaxTTL {
			return 0, fmt.Errorf("ttl %q exceeds %d seconds", s, MaxTTL)
		}
		rest = rest[i+1:]
	}
	return TTL(total), nil
}

// UnmarshalYAML implements yaml.Unmarshaler.
func (t *TTL) UnmarshalYAML(node *yaml.Node) error {
	var s string
	if err := node.Decode(&s); err != nil {
		return fmt.Errorf("ttl must be seconds or a string like \"1h\": %w", err)
	}
	v, err := ParseTTL(s)
	if err != nil {
		return err
	}
	*t = v
	return nil
}

// MarshalYAML emits whole seconds so rewritten fragments round-trip.
func (t TTL) MarshalYAML() (any, error) { return uint32(t), nil }

// UnmarshalJSON accepts a number of seconds or a unit string.
func (t *TTL) UnmarshalJSON(b []byte) error {
	var n json.Number
	if err := json.Unmarshal(b, &n); err == nil {
		v, err := ParseTTL(n.String())
		if err != nil {
			return err
		}
		*t = v
		return nil
	}
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return fmt.Errorf("ttl must be seconds or a string like \"1h\"")
	}
	v, err := ParseTTL(s)
	if err != nil {
		return err
	}
	*t = v
	return nil
}

// Seconds returns the TTL as seconds.
func (t TTL) Seconds() uint32 { return uint32(t) }

// Duration returns the TTL as a time.Duration.
func (t TTL) Duration() time.Duration { return time.Duration(t) * time.Second }
