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

// fragment is the only shape an included file may have: a sites: list.
// No globals, no nested include:.
type fragment struct {
	Sites []Site `yaml:"sites"`
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
			var frag fragment
			if err := strictDecode(raw, &frag); err != nil {
				return fmt.Errorf("%s: %w (fragments may only contain a sites: list)", file, err)
			}
			for i := range frag.Sites {
				frag.Sites[i].File = file
			}
			cfg.Sites = append(cfg.Sites, frag.Sites...)
		}
	}
	return nil
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
