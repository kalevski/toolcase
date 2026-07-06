package quaykeeper

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"regexp"
	"strings"
	"sync/atomic"
	"time"

	"github.com/kalevski/quaykeeper-client/internal/logship"
)

// LogsConfig is the `logs` section of the instance snapshot (log_ides.md §5.1):
// the destinations this instance's logs are shipped to. Old clients ignore it
// (unknown JSON fields are dropped); a client built for logs picks it up on the
// next ETag change and hot-swaps its shippers via Watch.
type LogsConfig struct {
	Destinations []LogDestConfig `json:"destinations"`
}

// LogAuthConfig references push credentials by name (never the secret itself).
type LogAuthConfig struct {
	Method       string `json:"method,omitempty"`
	Username     string `json:"username,omitempty"`
	PasswordEnv  string `json:"password_env,omitempty"`
	PasswordFile string `json:"password_file,omitempty"`
	TokenEnv     string `json:"token_env,omitempty"`
	TokenFile    string `json:"token_file,omitempty"`
}

// LogDestConfig is one delivered destination — the same JSON shape Quaykeeper's
// domain/nginxpilot-logdest-fragment emits, so an instance-scoped destination
// round-trips from the control plane to the client unchanged.
type LogDestConfig struct {
	Name               string              `json:"name"`
	Type               string              `json:"type"`
	Enabled            *bool               `json:"enabled,omitempty"`
	URL                string              `json:"url,omitempty"`
	Tenant             string              `json:"tenant,omitempty"`
	Auth               LogAuthConfig       `json:"auth,omitempty"`
	Labels             map[string]string   `json:"labels,omitempty"`
	Filter             map[string][]string `json:"filter,omitempty"`
	Sample             float64             `json:"sample,omitempty"`
	BatchSize          int                 `json:"batch_size,omitempty"`
	FlushInterval      string              `json:"flush_interval,omitempty"`
	MaxRetries         int                 `json:"max_retries,omitempty"`
	BufferSize         int                 `json:"buffer_size,omitempty"`
	CAFile             string              `json:"ca_file,omitempty"`
	InsecureSkipVerify bool                `json:"insecure_skip_verify,omitempty"`
	// Parse are "{field} literal {field}" templates turning this instance's
	// plain-text log lines into structured entries at intake (log_ides.md §5.2
	// extension). Applied across the instance's whole log stream, not just this
	// destination's — the client shares one parse pass before fan-out.
	Parse []string `json:"parse,omitempty"`
}

// IsEnabled reports the effective enabled state (default true).
func (d LogDestConfig) IsEnabled() bool { return d.Enabled == nil || *d.Enabled }

// envVarRe matches a ${VAR} substitution token in a label value.
var envVarRe = regexp.MustCompile(`\$\{([A-Za-z_][A-Za-z0-9_]*)\}`)

// Compile maps a delivered destination onto a runnable logship.Destination.
// `env` is the instance's resolved env (from the fetched snapshot): secrets and
// ${VAR} label substitutions resolve from it first, then the process environment
// (§5.1 — the same channel that configures the app arms its log shipper). Two
// label grammars, one meaning each (G22): `${VAR}` is env/instance substitution
// resolved ONCE here; `$field` is a per-entry log-field reference resolved at ship
// time (and dropped when the field is missing).
func (d LogDestConfig) Compile(env map[string]string) (logship.Destination, error) {
	filter, err := logship.CompileFilter(d.Filter, logship.FieldsAll)
	if err != nil {
		return logship.Destination{}, err
	}

	labels := logship.Labels{Static: map[string]string{}, Dynamic: map[string]string{}}
	for name, raw := range d.Labels {
		if strings.HasPrefix(raw, "$") && !strings.HasPrefix(raw, "${") {
			// $field — per-entry field reference (dropped when the field is empty).
			labels.Dynamic[name] = strings.TrimPrefix(raw, "$")
			continue
		}
		resolved, ok := substituteEnv(raw, env)
		if !ok {
			// A ${VAR} referenced a variable that isn't set — drop the label rather
			// than mint a junk stream with an empty/partial value.
			continue
		}
		labels.Static[name] = resolved
	}

	out := logship.Destination{
		Name:               d.Name,
		Type:               d.Type,
		URL:                d.URL,
		Tenant:             d.Tenant,
		Labels:             labels,
		CAFile:             d.CAFile,
		InsecureSkipVerify: d.InsecureSkipVerify,
		BatchSize:          d.BatchSize,
		MaxRetries:         d.MaxRetries,
		BufferEntries:      d.BufferSize,
		Filter:             filter,
		Sample:             d.Sample,
	}
	if d.FlushInterval != "" {
		if dur, err := time.ParseDuration(d.FlushInterval); err == nil {
			out.FlushInterval = dur
		}
	}

	method := d.Auth.Method
	if method == "" {
		method = logship.AuthNone
	}
	out.Auth = logship.Auth{Method: method, Username: d.Auth.Username}
	switch method {
	case logship.AuthBasic:
		out.Auth.Secret = secretResolver(env, d.Auth.PasswordEnv, d.Auth.PasswordFile)
	case logship.AuthBearer:
		out.Auth.Secret = secretResolver(env, d.Auth.TokenEnv, d.Auth.TokenFile)
	}

	// Fingerprint from the canonical config so Configure keeps unchanged workers.
	if spec, err := json.Marshal(d); err == nil {
		out.SetSpec(string(spec))
	}
	return out, nil
}

// CompileDestinations maps every enabled destination in the snapshot's logs
// section onto runnable shippers, skipping (with a nil error) any that fail to
// compile so one bad destination never blocks the rest.
func CompileDestinations(logs LogsConfig, env map[string]string) []logship.Destination {
	var out []logship.Destination
	for _, d := range logs.Destinations {
		if !d.IsEnabled() {
			continue
		}
		ship, err := d.Compile(env)
		if err != nil {
			fmt.Fprintf(os.Stderr, "quaykeeper-client: skipping log destination %q: %v\n", d.Name, err)
			continue
		}
		out = append(out, ship)
	}
	return out
}

// LogPipeline ties a shipper to a live-swappable set of parse templates: one
// object drives both the `run` and `logs` verbs. Apply reconfigures both the
// destinations and the templates atomically on each config change (hot-reload via
// Watch); Ingest parses one line (JSON → template → raw) and dispatches it.
type LogPipeline struct {
	shipper *logship.Shipper
	raw     bool
	static  []*logship.Template // from --parse flags (compiled once, always applied)
	tmpl    atomic.Pointer[[]*logship.Template]
}

// NewLogPipeline builds a pipeline. `raw` forces raw-wrapping (the `logs --format
// raw` mode). `staticTemplates` are the `--parse` flag templates — a compile error
// here is fatal (returned) since the operator typed them; delivered templates that
// fail to compile are skipped with a warning in Apply.
func NewLogPipeline(log *slog.Logger, raw bool, staticTemplates []string) (*LogPipeline, error) {
	compiled, errs := compileTemplates(staticTemplates)
	if len(errs) > 0 {
		return nil, errs[0]
	}
	p := &LogPipeline{shipper: logship.NewShipper(log), raw: raw, static: compiled}
	empty := append([]*logship.Template{}, compiled...)
	p.tmpl.Store(&empty)
	return p, nil
}

// Apply reconfigures the shipper from the snapshot's destinations and rebuilds the
// active template set (static flags + the union of every destination's `parse`,
// deduped by source). Safe to call on every Watch tick.
func (p *LogPipeline) Apply(logs LogsConfig, env map[string]string) {
	p.shipper.Configure(CompileDestinations(logs, env))

	templates := append([]*logship.Template{}, p.static...)
	seen := map[string]bool{}
	for _, t := range p.static {
		seen[t.String()] = true
	}
	var bad []string
	for _, d := range logs.Destinations {
		for _, src := range d.Parse {
			if seen[src] {
				continue
			}
			seen[src] = true
			t, err := logship.CompileTemplate(src)
			if err != nil {
				bad = append(bad, src)
				continue
			}
			templates = append(templates, t)
		}
	}
	for _, src := range bad {
		fmt.Fprintf(os.Stderr, "quaykeeper-client: skipping invalid parse template %q\n", src)
	}
	p.tmpl.Store(&templates)
}

// Ingest parses one line with the current template set and dispatches it.
func (p *LogPipeline) Ingest(line []byte, stream string) {
	tmpl := p.tmpl.Load()
	var templates []*logship.Template
	if tmpl != nil {
		templates = *tmpl
	}
	p.shipper.Dispatch(logship.ParseLine(line, logship.ParseOptions{Stream: stream, Raw: p.raw, Templates: templates}))
}

// Close flushes and stops shipping.
func (p *LogPipeline) Close() { p.shipper.Close() }

// compileTemplates compiles a list, returning the successes and any errors.
func compileTemplates(srcs []string) ([]*logship.Template, []error) {
	var out []*logship.Template
	var errs []error
	for _, s := range srcs {
		t, err := logship.CompileTemplate(s)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		out = append(out, t)
	}
	return out, errs
}

// substituteEnv expands ${VAR} tokens from env (fetched) then process env. Returns
// ok=false if any referenced variable is unset (so the caller can drop the label).
func substituteEnv(s string, env map[string]string) (string, bool) {
	ok := true
	out := envVarRe.ReplaceAllStringFunc(s, func(tok string) string {
		name := tok[2 : len(tok)-1]
		if v, has := env[name]; has && v != "" {
			return v
		}
		if v := os.Getenv(name); v != "" {
			return v
		}
		ok = false
		return ""
	})
	return out, ok
}

// secretResolver builds the use-time secret closure: a file ref is re-read per
// flush (rotate-safe); an env ref resolves from the fetched instance env first,
// then the process env (§5.1).
func secretResolver(env map[string]string, envName, fileName string) logship.SecretFunc {
	if fileName != "" {
		return func() (string, error) {
			b, err := os.ReadFile(fileName)
			if err != nil {
				return "", err
			}
			return strings.TrimSpace(string(b)), nil
		}
	}
	return func() (string, error) {
		if v, ok := env[envName]; ok && v != "" {
			return v, nil
		}
		if v := os.Getenv(envName); v != "" {
			return v, nil
		}
		return "", fmt.Errorf("secret env %q not set (checked fetched config + process env)", envName)
	}
}
