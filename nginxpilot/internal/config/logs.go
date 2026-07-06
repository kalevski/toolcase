package config

import (
	"encoding/json"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/logship"
)

// Log destination types (log_destinations[].type).
const (
	LogDestLoki   = "loki"
	LogDestHTTP   = "http"
	LogDestFile   = "file"
	LogDestStdout = "stdout"
)

// DefaultSyslogListen is the loopback UDP address the JSON access-log intake
// binds and the rendered access_log syslog: directives point at.
const DefaultSyslogListen = "127.0.0.1:5514"

// LogsAccessModeSyslog is the only implemented logs.access.mode. Per-resource
// file output (mode file|both from the original design) was dropped (G4):
// nothing rotates those files; local persistence goes through the
// self-rotating `file` destination type instead.
const LogsAccessModeSyslog = "syslog"

// MaxExtraLogLabels bounds the extra static Loki labels per destination (G16).
const MaxExtraLogLabels = 5

// Logs is the top-level `logs:` block: access-log emission plus the intake
// redaction policy shared by every destination.
type Logs struct {
	Access AccessLogs `yaml:"access"`
	Redact LogRedact  `yaml:"redact"`
}

// AccessLogs configures JSON access-log emission (log_ides.md §1): a managed
// http-context log_format include plus a per-vhost access_log syslog:
// directive, received by the daemon's loopback UDP intake. In generate-only
// mode the directives are emitted as print-vhost comments to opt in by hand.
type AccessLogs struct {
	Enabled bool `yaml:"enabled"`
	// Mode is the ingestion transport. Only "syslog" (default) is implemented.
	Mode string `yaml:"mode"`
	// SyslogListen is the loopback UDP listen address (default 127.0.0.1:5514).
	SyslogListen string `yaml:"syslog_listen"`
}

// ModeOrDefault returns the effective access-log mode.
func (a AccessLogs) ModeOrDefault() string {
	if a.Mode == "" {
		return LogsAccessModeSyslog
	}
	return a.Mode
}

// ListenOrDefault returns the effective syslog listen address.
func (a AccessLogs) ListenOrDefault() string {
	if a.SyslogListen == "" {
		return DefaultSyslogListen
	}
	return a.SyslogListen
}

// LogRedact configures intake-time redaction (G29) — applied before any
// destination sees a line, because query strings routinely carry OAuth codes
// and API tokens.
type LogRedact struct {
	// QueryParams overrides the default deny-list of query parameter names
	// whose values are redacted (nil = the logship default list; an explicit
	// empty list turns redaction off).
	QueryParams *[]string `yaml:"query_params"`
	// AnonymizeIP zeroes the last octet (IPv4) / last 80 bits (IPv6) of
	// remote_addr.
	AnonymizeIP bool `yaml:"anonymize_ip"`
}

// LogDestination is one push target for access-log entries — the 8th managed
// entity kind: driven over the same fragment REST pattern as sites/proxies
// (deterministic logdest-<name>.yml, validate-before-write, atomic write,
// hot reload without touching nginx).
type LogDestination struct {
	// Name is the identifier and the fragment filename component — slug-only
	// ([a-z0-9-]+), same rule and rationale as the credstore (G10).
	Name string `yaml:"name" json:"name"`
	// Type: loki | http | file | stdout.
	Type string `yaml:"type" json:"type"`
	// Enabled toggles shipping without deleting the destination (nil = enabled).
	Enabled *bool `yaml:"enabled" json:"enabled,omitempty"`

	// URL is the push endpoint (loki: …/loki/api/v1/push; http: any collector).
	// https:// required unless allow_insecure.
	URL string `yaml:"url" json:"url,omitempty"`
	// Tenant sets Loki's X-Scope-OrgID header (loki only).
	Tenant        string `yaml:"tenant" json:"tenant,omitempty"`
	AllowInsecure bool   `yaml:"allow_insecure" json:"allow_insecure,omitempty"`
	// CAFile trusts a private CA for the push TLS connection (G12).
	CAFile string `yaml:"ca_file" json:"ca_file,omitempty"`
	// InsecureSkipVerify disables TLS verification; requires allow_insecure.
	InsecureSkipVerify bool `yaml:"insecure_skip_verify" json:"insecure_skip_verify,omitempty"`

	// Auth carries push credentials — secret material by reference only
	// (*_env / *_file), same parse-time rule as git tokens.
	Auth LogAuth `yaml:"auth" json:"auth,omitempty"`

	// Labels is the Loki label config (§3.2): a static `job` (default
	// "nginx"), whitelisted dynamic `host` / `status_code` sources, and up to
	// MaxExtraLogLabels extra static labels. loki only.
	Labels map[string]string `yaml:"labels" json:"labels,omitempty"`

	// Filter selects which entries ship (§2.3): field → matcher list, AND
	// across fields, OR within a field. Omit = everything.
	Filter map[string][]string `yaml:"filter" json:"filter,omitempty"`
	// Sample keeps roughly this fraction (0..1] of matched entries.
	Sample *float64 `yaml:"sample" json:"sample,omitempty"`

	// Shipping tunables (zero = logship defaults).
	BatchSize     int      `yaml:"batch_size" json:"batch_size,omitempty"`
	FlushInterval Duration `yaml:"flush_interval" json:"flush_interval,omitempty"`
	MaxRetries    int      `yaml:"max_retries" json:"max_retries,omitempty"`
	BufferSize    int      `yaml:"buffer_size" json:"buffer_size,omitempty"`

	// File-type fields: NDJSON path with size-based self-rotation.
	Path     string   `yaml:"path" json:"path,omitempty"`
	MaxSize  ByteSize `yaml:"max_size" json:"max_size,omitempty"`
	MaxFiles int      `yaml:"max_files" json:"max_files,omitempty"`

	// File records which config file declared this destination (provenance).
	File string `yaml:"-" json:"-"`
}

// IsEnabled reports the effective enabled state (default true).
func (d LogDestination) IsEnabled() bool { return d.Enabled == nil || *d.Enabled }

// JobLabel returns the effective static job label ("nginx" when unset).
func (d LogDestination) JobLabel() string {
	if j := d.Labels["job"]; j != "" {
		return j
	}
	return "nginx"
}

// LogAuth is a destination's credential block. Inline secrets are declared as
// traps so strict decoding accepts the key and validation can emit a targeted
// error instead of "unknown field" (mirrors Auth).
type LogAuth struct {
	// Method: none (default) | basic | bearer.
	Method   string `yaml:"method" json:"method,omitempty"`
	Username string `yaml:"username" json:"username,omitempty"`

	PasswordEnv  string `yaml:"password_env" json:"password_env,omitempty"`
	PasswordFile string `yaml:"password_file" json:"password_file,omitempty"`
	TokenEnv     string `yaml:"token_env" json:"token_env,omitempty"`
	TokenFile    string `yaml:"token_file" json:"token_file,omitempty"`

	// Inline secret traps — always empty in a validated config.
	Password string `yaml:"password" json:"-"`
	Token    string `yaml:"token" json:"-"`
}

// MethodOrNone returns the effective auth method.
func (a LogAuth) MethodOrNone() string {
	if a.Method == "" {
		return AuthNone
	}
	return a.Method
}

// ParseAccessOptions builds the logship parse options from the redaction config.
func (l Logs) ParseAccessOptions() logship.ParseOptions {
	opts := logship.ParseOptions{AnonymizeIP: l.Redact.AnonymizeIP}
	if l.Redact.QueryParams != nil {
		opts.RedactParams = *l.Redact.QueryParams
		if opts.RedactParams == nil {
			opts.RedactParams = []string{}
		}
	}
	return opts
}

// ShipDestination maps a validated LogDestination onto logship's Destination:
// filters compiled, labels split into the job/host/status_code contract,
// secrets wired as use-time resolvers (env resolved once, files re-read per
// flush — G14), and the spec fingerprinted for hot-reload diffing.
func (d *LogDestination) ShipDestination() (logship.Destination, error) {
	filter, err := logship.CompileFilter(d.Filter, logship.FieldsAccess)
	if err != nil {
		return logship.Destination{}, err
	}

	labels := logship.Labels{Job: d.JobLabel(), Static: map[string]string{}}
	for k, v := range d.Labels {
		switch k {
		case "job":
		case "host":
			labels.HostSource = v
		case "status_code":
			labels.StatusSource = v
		default:
			labels.Static[k] = v
		}
	}

	out := logship.Destination{
		Name:               d.Name,
		Type:               d.Type,
		URL:                d.URL,
		Tenant:             d.Tenant,
		Labels:             labels,
		CAFile:             d.CAFile,
		InsecureSkipVerify: d.InsecureSkipVerify,
		Path:               d.Path,
		MaxSize:            int64(d.MaxSize),
		MaxFiles:           d.MaxFiles,
		BatchSize:          d.BatchSize,
		FlushInterval:      time.Duration(d.FlushInterval),
		MaxRetries:         d.MaxRetries,
		BufferEntries:      d.BufferSize,
		Filter:             filter,
	}
	if d.Sample != nil {
		out.Sample = *d.Sample
	}

	out.Auth = logship.Auth{Method: d.Auth.MethodOrNone(), Username: d.Auth.Username}
	switch out.Auth.Method {
	case AuthBasic:
		out.Auth.Secret = secretResolver(d.Auth.PasswordEnv, d.Auth.PasswordFile)
	case AuthBearer:
		out.Auth.Secret = secretResolver(d.Auth.TokenEnv, d.Auth.TokenFile)
	}

	// Fingerprint the destination from its canonical serialized config so the
	// shipper's Configure can keep unchanged workers (and their stats) across
	// reloads. JSON of the config struct covers every field including refs.
	if spec, err := json.Marshal(d); err == nil {
		out.SetSpec(string(spec))
	}
	return out, nil
}

// secretResolver builds the use-time secret closure: env vars resolve once
// (process env cannot change), file refs re-read per call so rotated token
// files are picked up without a reload (G14).
func secretResolver(envName, fileName string) logship.SecretFunc {
	if envName != "" {
		var cached string
		var cachedErr error
		resolved := false
		return func() (string, error) {
			if !resolved {
				cached, cachedErr = ResolveSecret(envName, "")
				resolved = true
			}
			return cached, cachedErr
		}
	}
	return func() (string, error) {
		return ResolveSecret("", fileName)
	}
}
