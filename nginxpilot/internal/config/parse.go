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
const DefaultPath = "/etc/nginxpilot/config.yml"

// Fragment is the shape an included file may have: sites:, upstreams:,
// proxies:, stream_upstreams: and/or streams: lists. No globals, no nested
// include:. It is both what `include:` globs pull in from sites.d/ and what the
// admin write-API accepts, so the file-drop and REST paths parse identically.
type Fragment struct {
	Sites           []Site           `yaml:"sites"`
	Upstreams       []Upstream       `yaml:"upstreams"`
	Proxies         []Proxy          `yaml:"proxies"`
	StreamUpstreams []StreamUpstream `yaml:"stream_upstreams"`
	Streams         []Stream         `yaml:"streams"`
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
	for i := range cfg.Sites {
		cfg.Sites[i].File = abs
	}
	for i := range cfg.Upstreams {
		cfg.Upstreams[i].File = abs
	}
	for i := range cfg.Proxies {
		cfg.Proxies[i].File = abs
	}
	for i := range cfg.StreamUpstreams {
		cfg.StreamUpstreams[i].File = abs
	}
	for i := range cfg.Streams {
		cfg.Streams[i].File = abs
	}

	applyDefaults(&cfg)

	res := &LoadResult{Config: &cfg}
	if err := loadIncludes(&cfg, res); err != nil {
		return nil, err
	}
	if err := Validate(&cfg); err != nil {
		return nil, err
	}
	return res, nil
}

func applyDefaults(cfg *Config) {
	if cfg.DataDir == "" {
		cfg.DataDir = "/var/lib/nginxpilot"
	}
	if cfg.LogLevel == "" {
		cfg.LogLevel = "info"
	}
	if cfg.Defaults.Interval == 0 {
		cfg.Defaults.Interval = Duration(5 * 60 * 1e9) // 5m
	}
	if cfg.Defaults.KeepReleases == 0 {
		cfg.Defaults.KeepReleases = 3
	}
	applyNginxDefaults(cfg)
}

// applyNginxDefaults fills managed-mode paths and commands when nginx.manage is
// on and the field was left unset. Inert when manage is false.
func applyNginxDefaults(cfg *Config) {
	if !cfg.Nginx.Manage {
		return
	}
	if cfg.Nginx.ConfDir == "" {
		cfg.Nginx.ConfDir = DefaultConfDir
	}
	if cfg.Nginx.StreamConfDir == "" {
		cfg.Nginx.StreamConfDir = DefaultStreamConfDir
	}
	if cfg.Nginx.ManagedIncludeDir == "" {
		cfg.Nginx.ManagedIncludeDir = DefaultManagedIncludeDir
	}
	if len(cfg.Nginx.TestCmd) == 0 {
		cfg.Nginx.TestCmd = []string{"nginx", "-t"}
	}
	if len(cfg.Nginx.ReloadCmd) == 0 {
		cfg.Nginx.ReloadCmd = []string{"nginx", "-s", "reload"}
	}
	if cfg.Tls.WatchInterval == 0 {
		cfg.Tls.WatchInterval = Duration(DefaultWatchInterval * 1e9)
	}
}

// loadIncludes expands include: globs (relative to the main file's directory),
// loads each fragment in lexical filename order and concatenates sites lists.
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
			cfg.Sites = append(cfg.Sites, frag.Sites...)
			cfg.Upstreams = append(cfg.Upstreams, frag.Upstreams...)
			cfg.Proxies = append(cfg.Proxies, frag.Proxies...)
			cfg.StreamUpstreams = append(cfg.StreamUpstreams, frag.StreamUpstreams...)
			cfg.Streams = append(cfg.Streams, frag.Streams...)
		}
	}
	return nil
}

// ParseFragment strict-decodes one sites.d-style fragment — the same bytes a
// file dropped into sites.d/ would contain — attributing provenance to file.
// It performs no cross-config checks (duplicate domains across files): merge
// the result into a Config and call Validate for that. Reused by both the
// include loader and the admin write-API so the two paths parse identically.
func ParseFragment(raw []byte, file string) (*Fragment, error) {
	var frag Fragment
	if err := strictDecode(raw, &frag); err != nil {
		return nil, fmt.Errorf("%s: %w (fragments may only contain sites:, upstreams: and/or proxies: lists)", file, err)
	}
	for i := range frag.Sites {
		frag.Sites[i].File = file
	}
	for i := range frag.Upstreams {
		frag.Upstreams[i].File = file
	}
	for i := range frag.Proxies {
		frag.Proxies[i].File = file
	}
	for i := range frag.StreamUpstreams {
		frag.StreamUpstreams[i].File = file
	}
	for i := range frag.Streams {
		frag.Streams[i].File = file
	}
	return &frag, nil
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
