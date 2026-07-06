package config

import (
	"fmt"
	"net"
	"net/url"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/kalevski/toolcase/nginxpilot/internal/logship"
)

// logDestNameRe guards the on-disk fragment filename (logdest-<name>.yml)
// against path tricks — same regex and rationale as the credstore (G10).
var logDestNameRe = regexp.MustCompile(`^[a-z0-9-]+$`)

// lokiLabelNameRe is Loki's label-name grammar (G16).
var lokiLabelNameRe = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

// hostLabelSources are the whitelisted dynamic sources for the `host` label.
// $resource is the recommended default — it is nginxpilot's own bounded entity
// name; $host is attacker-controlled under wildcard server_names (G15).
var hostLabelSources = map[string]bool{"$host": true, "$server_name": true, "$resource": true}

// statusLabelSources are the whitelisted dynamic sources for `status_code`.
var statusLabelSources = map[string]bool{"$status": true, "$status_class": true}

// ValidateLogDestinationStandalone validates one destination outside a full
// merged config — the admin "Test connection" endpoint runs it on a candidate
// before anything lands on disk. cfg supplies the wildcard-vhost context for
// the $host label guardrail (G15).
func ValidateLogDestinationStandalone(cfg *Config, d *LogDestination) error {
	if err := validateLogDestination(d, anyWildcardVhost(cfg)); err != nil {
		return fmt.Errorf("log_destination %q: %w", d.Name, err)
	}
	return nil
}

// validateLogs checks the logs block and every log destination.
func validateLogs(cfg *Config) error {
	a := cfg.Logs.Access
	if a.ModeOrDefault() != LogsAccessModeSyslog {
		return fmt.Errorf("logs.access.mode %q: only \"syslog\" is implemented — for local files use a `file` log destination (it self-rotates)", a.Mode)
	}
	if _, _, err := net.SplitHostPort(a.ListenOrDefault()); err != nil {
		return fmt.Errorf("logs.access.syslog_listen %q: must be host:port: %v", a.SyslogListen, err)
	}
	if cfg.Logs.Redact.QueryParams != nil {
		for _, p := range *cfg.Logs.Redact.QueryParams {
			if strings.TrimSpace(p) == "" {
				return fmt.Errorf("logs.redact.query_params: empty parameter name")
			}
		}
	}

	hasWildcardVhost := anyWildcardVhost(cfg)
	names := map[string]string{} // name -> file
	for i := range cfg.LogDestinations {
		d := &cfg.LogDestinations[i]
		if err := validateLogDestination(d, hasWildcardVhost); err != nil {
			return fmt.Errorf("log_destination %q (%s): %w", d.Name, d.File, err)
		}
		if prev, dup := names[d.Name]; dup {
			return fmt.Errorf("duplicate log_destination %q declared in %s and %s", d.Name, prev, d.File)
		}
		names[d.Name] = d.File
	}
	return nil
}

// anyWildcardVhost reports whether any http vhost uses a wildcard domain —
// the condition under which a $host Loki label has unbounded cardinality.
func anyWildcardVhost(cfg *Config) bool {
	for i := range cfg.Proxies {
		if strings.HasPrefix(cfg.Proxies[i].Domain, "*.") {
			return true
		}
	}
	for i := range cfg.Redirects {
		if strings.HasPrefix(cfg.Redirects[i].Domain, "*.") {
			return true
		}
	}
	for i := range cfg.DeadHosts {
		if strings.HasPrefix(cfg.DeadHosts[i].Domain, "*.") {
			return true
		}
	}
	return false
}

func validateLogDestination(d *LogDestination, hasWildcardVhost bool) error {
	if d.Name == "" {
		return fmt.Errorf("name is required")
	}
	if !logDestNameRe.MatchString(d.Name) {
		return fmt.Errorf("name must match [a-z0-9-]+ (it becomes the fragment filename)")
	}

	// Push-type vs local-type field sanity.
	switch d.Type {
	case LogDestLoki, LogDestHTTP:
		if err := validateLogDestURL(d); err != nil {
			return err
		}
		if err := validateLogAuth(d.Auth); err != nil {
			return err
		}
		if d.Path != "" || d.MaxSize != 0 || d.MaxFiles != 0 {
			return fmt.Errorf("path / max_size / max_files only apply to type: file")
		}
		if d.Type == LogDestHTTP {
			if d.Tenant != "" {
				return fmt.Errorf("tenant only applies to type: loki")
			}
			if len(d.Labels) > 0 {
				return fmt.Errorf("labels only apply to type: loki (an http collector receives the full JSON lines)")
			}
		} else if err := validateLogLabels(d.Labels, hasWildcardVhost); err != nil {
			return err
		}
	case LogDestFile:
		if d.Path == "" {
			return fmt.Errorf("path is required for type: file")
		}
		if !filepath.IsAbs(d.Path) {
			return fmt.Errorf("path %q must be absolute", d.Path)
		}
		if d.MaxFiles < 0 {
			return fmt.Errorf("max_files must be >= 0")
		}
		if err := noPushFields(d); err != nil {
			return err
		}
	case LogDestStdout:
		if d.Path != "" || d.MaxSize != 0 || d.MaxFiles != 0 {
			return fmt.Errorf("path / max_size / max_files only apply to type: file")
		}
		if err := noPushFields(d); err != nil {
			return err
		}
	case "":
		return fmt.Errorf("type is required (loki | http | file | stdout)")
	default:
		return fmt.Errorf("type %q: must be loki | http | file | stdout", d.Type)
	}

	// Filter grammar — compiled by the same engine that runs it (G13), so the
	// API rejects exactly what the shipper couldn't execute.
	if _, err := logship.CompileFilter(d.Filter, logship.FieldsAccess); err != nil {
		return err
	}
	if d.Sample != nil && (*d.Sample <= 0 || *d.Sample > 1) {
		return fmt.Errorf("sample %v: must be in (0, 1]", *d.Sample)
	}
	if d.BatchSize < 0 || d.MaxRetries < 0 || d.BufferSize < 0 {
		return fmt.Errorf("batch_size / max_retries / buffer_size must be >= 0")
	}
	return nil
}

// noPushFields rejects push-only fields on local destination types.
func noPushFields(d *LogDestination) error {
	if d.URL != "" || d.Tenant != "" || d.CAFile != "" || d.InsecureSkipVerify || d.AllowInsecure {
		return fmt.Errorf("url / tenant / ca_file / tls options only apply to type: loki | http")
	}
	if d.Auth.MethodOrNone() != AuthNone {
		return fmt.Errorf("auth only applies to type: loki | http")
	}
	if len(d.Labels) > 0 {
		return fmt.Errorf("labels only apply to type: loki")
	}
	return nil
}

func validateLogDestURL(d *LogDestination) error {
	if d.URL == "" {
		return fmt.Errorf("url is required for type: %s", d.Type)
	}
	u, err := url.Parse(d.URL)
	if err != nil {
		return fmt.Errorf("url %q: %v", d.URL, err)
	}
	switch u.Scheme {
	case "https":
	case "http":
		if !d.AllowInsecure {
			return fmt.Errorf("http:// URLs require allow_insecure: true (https:// is the default requirement)")
		}
	default:
		return fmt.Errorf("url %q: must be https:// (or http:// with allow_insecure: true)", d.URL)
	}
	if u.Host == "" {
		return fmt.Errorf("url %q: missing host", d.URL)
	}
	if d.InsecureSkipVerify && !d.AllowInsecure {
		return fmt.Errorf("insecure_skip_verify requires allow_insecure: true")
	}
	return nil
}

func validateLogAuth(a LogAuth) error {
	for key, val := range map[string]string{"password": a.Password, "token": a.Token} {
		if val != "" {
			return fmt.Errorf("inline secrets are not allowed: use auth.%s_env or auth.%s_file instead of auth.%s", key, key, key)
		}
	}
	switch a.MethodOrNone() {
	case AuthNone:
		if a.Username != "" || a.PasswordEnv != "" || a.PasswordFile != "" || a.TokenEnv != "" || a.TokenFile != "" {
			return fmt.Errorf("auth fields set but auth.method is none")
		}
	case AuthBasic:
		if a.Username == "" {
			return fmt.Errorf("auth.username is required for basic auth")
		}
		if err := exactlyOneRef("password", a.PasswordEnv, a.PasswordFile); err != nil {
			return err
		}
		if a.TokenEnv != "" || a.TokenFile != "" {
			return fmt.Errorf("token refs only apply to auth.method: bearer")
		}
	case AuthBearer:
		if a.Username != "" {
			return fmt.Errorf("auth.username only applies to auth.method: basic")
		}
		if err := exactlyOneRef("token", a.TokenEnv, a.TokenFile); err != nil {
			return err
		}
		if a.PasswordEnv != "" || a.PasswordFile != "" {
			return fmt.Errorf("password refs only apply to auth.method: basic")
		}
	default:
		return fmt.Errorf("auth.method %q: log destinations support basic | bearer | none", a.Method)
	}
	return nil
}

// validateLogLabels enforces the label contract (§3.2, G15/G16): dynamic
// sources are whitelisted to exactly host/status_code; everything else must be
// a static value with a Loki-legal name; at most MaxExtraLogLabels extras.
func validateLogLabels(labels map[string]string, hasWildcardVhost bool) error {
	extras := 0
	for k, v := range labels {
		if v == "" {
			return fmt.Errorf("labels.%s: value must not be empty", k)
		}
		switch k {
		case "job":
			if strings.HasPrefix(v, "$") {
				return fmt.Errorf("labels.job must be a static string")
			}
		case "host":
			if !hostLabelSources[v] {
				return fmt.Errorf("labels.host %q: must be $resource, $host or $server_name (a from-field reference)", v)
			}
			if v != "$resource" && hasWildcardVhost {
				return fmt.Errorf("labels.host %q is unsafe with wildcard vhosts configured — every scanned subdomain would mint a new Loki stream; use $resource (the bounded entity name)", v)
			}
		case "status_code":
			if !statusLabelSources[v] {
				return fmt.Errorf("labels.status_code %q: must be $status (exact code) or $status_class (\"4xx\")", v)
			}
		default:
			if !lokiLabelNameRe.MatchString(k) {
				return fmt.Errorf("labels.%s: label names must match [a-zA-Z_][a-zA-Z0-9_]*", k)
			}
			if strings.HasPrefix(k, "__") {
				return fmt.Errorf("labels.%s: the __ prefix is reserved by Loki", k)
			}
			if strings.HasPrefix(v, "$") {
				return fmt.Errorf("labels.%s: only host and status_code may be dynamic; extra labels must be static (got %q)", k, v)
			}
			extras++
		}
	}
	if extras > MaxExtraLogLabels {
		return fmt.Errorf("labels: at most %d extra static labels (got %d)", MaxExtraLogLabels, extras)
	}
	return nil
}
