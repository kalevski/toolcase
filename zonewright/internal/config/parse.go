package config

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"

	"gopkg.in/yaml.v3"
)

// DefaultPath is where the daemon looks for its config unless --config is given.
const DefaultPath = "/etc/zonewright/config.yml"

// Built-in zone defaults, used when neither the zone nor defaults: set a value.
const (
	DefaultTTL     TTL = 3600
	DefaultRefresh TTL = 3600
	DefaultRetry   TTL = 900
	DefaultExpire  TTL = 1209600 // 2w
	DefaultMinimum TTL = 300
)

// Fragment is the shape an included file may have: a zones: list and nothing
// else. It is both what `include:` globs pull in from zones.d/ and what the
// admin write-API accepts, so the file-drop and REST paths parse identically.
type Fragment struct {
	Zones []Zone `yaml:"zones"`
}

// LoadResult carries the parsed config plus non-fatal warnings (e.g. an
// include glob matching zero files).
type LoadResult struct {
	Config   *Config
	Warnings []string
}

// Load reads, merges and validates the configuration rooted at path.
func Load(path string) (*LoadResult, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	raw, err := os.ReadFile(abs)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := strictDecode(raw, &cfg); err != nil {
		return nil, fmt.Errorf("%s: %w", abs, err)
	}
	cfg.Path = abs
	for i := range cfg.Zones {
		cfg.Zones[i].File = abs
	}

	ApplyDefaults(&cfg)

	res := &LoadResult{Config: &cfg}
	if err := loadIncludes(&cfg, res); err != nil {
		return nil, err
	}
	if err := Validate(&cfg); err != nil {
		return nil, err
	}
	return res, nil
}

// ApplyDefaults fills daemon-level defaults (paths, commands, SOA timers).
// Per-zone inheritance happens at render time via EffectiveTTL/EffectiveSOA
// so rewritten fragments only ever carry what the caller set.
func ApplyDefaults(cfg *Config) {
	if cfg.DataDir == "" {
		cfg.DataDir = "/var/lib/zonewright"
	}
	if cfg.LogLevel == "" {
		cfg.LogLevel = "info"
	}
	if cfg.Bind.ZoneDir == "" {
		cfg.Bind.ZoneDir = filepath.Join(cfg.DataDir, "zones")
	}
	if cfg.Bind.ConfFile == "" {
		cfg.Bind.ConfFile = filepath.Join(cfg.DataDir, "named.zones.conf")
	}
	if cfg.Bind.CheckZoneCmd == nil {
		cfg.Bind.CheckZoneCmd = []string{"named-checkzone"}
	}
	if cfg.Bind.CheckConfCmd == nil {
		cfg.Bind.CheckConfCmd = []string{"named-checkconf"}
	}
	if cfg.Bind.ReloadCmd == nil {
		cfg.Bind.ReloadCmd = []string{"rndc", "reload"}
	}
	if cfg.Cluster != nil {
		applyClusterDefaults(cfg.Cluster)
	}
	d := &cfg.Defaults
	if d.TTL == 0 {
		d.TTL = DefaultTTL
	}
	if d.SOA.Refresh == 0 {
		d.SOA.Refresh = DefaultRefresh
	}
	if d.SOA.Retry == 0 {
		d.SOA.Retry = DefaultRetry
	}
	if d.SOA.Expire == 0 {
		d.SOA.Expire = DefaultExpire
	}
	if d.SOA.Minimum == 0 {
		d.SOA.Minimum = DefaultMinimum
	}
}

// loadIncludes expands include: globs (relative to the main file's directory),
// loads each fragment in lexical filename order and concatenates zone lists.
func loadIncludes(cfg *Config, res *LoadResult) error {
	baseDir := filepath.Dir(cfg.Path)
	for _, pattern := range cfg.Include {
		p := pattern
		if !filepath.IsAbs(p) {
			p = filepath.Join(baseDir, p)
		}
		matches, err := filepath.Glob(p)
		if err != nil {
			return fmt.Errorf("include %q: bad glob: %w", pattern, err)
		}
		if len(matches) == 0 {
			res.Warnings = append(res.Warnings, fmt.Sprintf("include %q matched no files", pattern))
			continue
		}
		sort.Strings(matches)
		for _, file := range matches {
			raw, err := os.ReadFile(file)
			if err != nil {
				return fmt.Errorf("include %s: %w", file, err)
			}
			frag, err := ParseFragment(raw, file)
			if err != nil {
				return err
			}
			cfg.Zones = append(cfg.Zones, frag.Zones...)
		}
	}
	return nil
}

// ParseFragment strict-decodes one zones.d-style fragment, attributing
// provenance to file. It performs no cross-config checks (duplicate zones
// across files): merge the result into a Config and call Validate for that.
// JSON bodies decode too — JSON is valid YAML.
func ParseFragment(raw []byte, file string) (*Fragment, error) {
	var frag Fragment
	if err := strictDecode(raw, &frag); err != nil {
		return nil, fmt.Errorf("%s: %w (a fragment may only declare zones:)", file, err)
	}
	for i := range frag.Zones {
		frag.Zones[i].File = file
	}
	return &frag, nil
}

// MarshalFragment renders a one-zone fragment back to YAML — what the admin
// record endpoints write after a read-modify-write.
func MarshalFragment(z Zone) ([]byte, error) {
	var buf bytes.Buffer
	buf.WriteString("# Managed by the zonewright admin API — edits here are kept, but comments are not.\n")
	enc := yaml.NewEncoder(&buf)
	enc.SetIndent(2)
	if err := enc.Encode(Fragment{Zones: []Zone{z}}); err != nil {
		return nil, err
	}
	if err := enc.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// strictDecode decodes YAML rejecting unknown keys. An empty document is
// valid and leaves out untouched.
func strictDecode(raw []byte, out any) error {
	dec := yaml.NewDecoder(bytes.NewReader(raw))
	dec.KnownFields(true)
	if err := dec.Decode(out); err != nil && !errors.Is(err, io.EOF) {
		return err
	}
	return nil
}

// EffectiveTTL is the zone's $TTL: its own, else defaults.ttl.
func (c *Config) EffectiveTTL(z *Zone) TTL {
	if z.TTL != 0 {
		return z.TTL
	}
	return c.Defaults.TTL
}

// EffectiveNameservers is the zone's apex NS set: its own, else defaults.
func (c *Config) EffectiveNameservers(z *Zone) []string {
	if len(z.Nameservers) > 0 {
		return z.Nameservers
	}
	return c.Defaults.Nameservers
}

// EffectiveAllowTransfer / EffectiveAlsoNotify fall back to defaults.
func (c *Config) EffectiveAllowTransfer(z *Zone) []string {
	if len(z.AllowTransfer) > 0 {
		return z.AllowTransfer
	}
	return c.Defaults.AllowTransfer
}

func (c *Config) EffectiveAlsoNotify(z *Zone) []string {
	if len(z.AlsoNotify) > 0 {
		return z.AlsoNotify
	}
	return c.Defaults.AlsoNotify
}

// EffectiveSOA merges zone → defaults → built-ins, field by field. PrimaryNS
// falls back to the first nameserver, AdminEmail to hostmaster@<zone>.
func (c *Config) EffectiveSOA(z *Zone) SOA {
	d := c.Defaults.SOA
	s := z.SOA
	pickStr := func(a, b string) string {
		if a != "" {
			return a
		}
		return b
	}
	pickTTL := func(a, b, builtin TTL) TTL {
		if a != 0 {
			return a
		}
		if b != 0 {
			return b
		}
		return builtin
	}
	out := SOA{
		PrimaryNS:  pickStr(s.PrimaryNS, d.PrimaryNS),
		AdminEmail: pickStr(s.AdminEmail, d.AdminEmail),
		Refresh:    pickTTL(s.Refresh, d.Refresh, DefaultRefresh),
		Retry:      pickTTL(s.Retry, d.Retry, DefaultRetry),
		Expire:     pickTTL(s.Expire, d.Expire, DefaultExpire),
		Minimum:    pickTTL(s.Minimum, d.Minimum, DefaultMinimum),
	}
	if out.PrimaryNS == "" {
		if ns := c.EffectiveNameservers(z); len(ns) > 0 {
			out.PrimaryNS = ns[0]
		} else {
			for _, r := range z.Records {
				if r.Type == TypeNS && r.Name == "@" {
					out.PrimaryNS = r.Value
					break
				}
			}
		}
	}
	if out.AdminEmail == "" {
		out.AdminEmail = "hostmaster@" + z.Name
	}
	return out
}

// ReplicatedFile is the provenance marker of zones that come from the
// replicated store rather than a config file.
const ReplicatedFile = "<replicated>"

// FragmentPath is the deterministic zones.d/<zone>.<ext> file the pre-SQLite
// admin API wrote a zone to, derived from the first include glob. Used to
// recognise those files when migrating them into the replicated store.
func FragmentPath(cfg *Config, zone string) (string, bool) {
	if len(cfg.Include) == 0 {
		return "", false
	}
	pattern := cfg.Include[0]
	if !filepath.IsAbs(pattern) {
		pattern = filepath.Join(filepath.Dir(cfg.Path), pattern)
	}
	ext := filepath.Ext(pattern)
	if ext == "" {
		ext = ".yml"
	}
	name := zone + ext
	if name != filepath.Base(name) {
		return "", false
	}
	return filepath.Join(filepath.Dir(pattern), name), true
}

// FindZone returns the index of the named zone, or -1.
func (c *Config) FindZone(name string) int {
	for i := range c.Zones {
		if c.Zones[i].Name == name {
			return i
		}
	}
	return -1
}

// CloneZone deep-copies a zone so a caller may mutate records without racing
// readers of the live config.
func CloneZone(z Zone) Zone {
	out := z
	out.Nameservers = append([]string(nil), z.Nameservers...)
	out.AllowTransfer = append([]string(nil), z.AllowTransfer...)
	out.AlsoNotify = append([]string(nil), z.AlsoNotify...)
	out.Records = make([]Record, len(z.Records))
	for i, r := range z.Records {
		out.Records[i] = r.clone()
	}
	return out
}

func (r Record) clone() Record {
	cp := func(p *int) *int {
		if p == nil {
			return nil
		}
		v := *p
		return &v
	}
	r.Priority, r.Weight, r.Port, r.Flags = cp(r.Priority), cp(r.Weight), cp(r.Port), cp(r.Flags)
	return r
}

// ParseZone strict-decodes a single zone object (YAML or JSON) — the body of
// PUT /zones/{zone}.
func ParseZone(raw []byte) (*Zone, error) {
	var z Zone
	if err := strictDecode(raw, &z); err != nil {
		return nil, err
	}
	return &z, nil
}
