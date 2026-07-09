package config

import (
	"errors"
	"fmt"
	"io"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

// DefaultPath is where imagewarden looks for its config unless --config is given.
const DefaultPath = "/etc/imagewarden/config.yml"

// Config is the typed shape of config.yml (spec §6). Every field has a
// default from Defaults(); Load starts there and decodes the file on top of
// it, so a key omitted from the file always means "default", never the Go
// zero value.
type Config struct {
	Listen    string          `yaml:"listen"`
	API       APIConfig       `yaml:"api"`
	Model     ModelConfig     `yaml:"model"`
	Inference InferenceConfig `yaml:"inference"`
	Limits    LimitsConfig    `yaml:"limits"`
	Policy    PolicyConfig    `yaml:"policy"`
	Log       LogConfig       `yaml:"log"`
}

// APIConfig configures bearer-token auth (spec §5 Auth). The token value
// itself is never read here — cmd/run and cmd/validate resolve it from the
// named environment variable at boot.
type APIConfig struct {
	TokenEnv string `yaml:"token_env"`
}

// ModelConfig locates the model artifacts (model.onnx + manifest.yml).
type ModelConfig struct {
	Dir string `yaml:"dir"`
}

// InferenceConfig tunes the ONNX Runtime session (spec §4.1).
type InferenceConfig struct {
	Threads     int `yaml:"threads"`     // 0 = runtime.NumCPU()
	Concurrency int `yaml:"concurrency"` // internal/classify inference semaphore size
}

// LimitsConfig bounds request size, image dimensions and request timing
// (spec §4.3, §10).
type LimitsConfig struct {
	MaxBodyMB      int      `yaml:"max_body_mb"`
	MaxPixels      int      `yaml:"max_pixels"`
	QueueTimeout   Duration `yaml:"queue_timeout"`
	RequestTimeout Duration `yaml:"request_timeout"`
}

// PolicyConfig configures the score → decision thresholds (spec §4.2).
//
// It is defined here rather than imported from internal/policy because that
// package is not implemented yet (task 012). The YAML shape matches
// policy.PolicyConfig exactly, so swapping the Config.Policy field to that
// type once it exists is mechanical.
type PolicyConfig struct {
	UnsafeClasses     []string `yaml:"unsafe_classes"`
	BorderlineClasses []string `yaml:"borderline_classes"`
	BlockThreshold    float64  `yaml:"block_threshold"`
	ReviewThreshold   float64  `yaml:"review_threshold"`
}

// LogConfig selects slog's output format.
type LogConfig struct {
	Format string `yaml:"format"` // logfmt | json
}

// Duration wraps time.Duration so config values like "5s"/"30s" decode
// natively — yaml.v3 has no built-in time.Duration support. Mirrors
// nginxpilot's internal/config.Duration idiom.
type Duration time.Duration

// UnmarshalYAML implements yaml.Unmarshaler.
func (d *Duration) UnmarshalYAML(node *yaml.Node) error {
	var s string
	if err := node.Decode(&s); err != nil {
		return fmt.Errorf("duration must be a string like \"5s\": %w", err)
	}
	v, err := time.ParseDuration(s)
	if err != nil {
		return fmt.Errorf("invalid duration %q: %w", s, err)
	}
	*d = Duration(v)
	return nil
}

// Std returns d as a plain time.Duration for callers (internal/classify,
// internal/api) that need the stdlib type.
func (d Duration) Std() time.Duration { return time.Duration(d) }

// Defaults returns the fully-populated config (spec §6) — the baseline Load
// decodes onto, and what a defaults-only run uses when no config file
// exists at DefaultPath.
func Defaults() Config {
	return Config{
		Listen: "0.0.0.0:8080",
		API: APIConfig{
			TokenEnv: "IMAGEWARDEN_TOKEN",
		},
		Model: ModelConfig{
			Dir: "/usr/share/imagewarden/model",
		},
		Inference: InferenceConfig{
			Threads:     0,
			Concurrency: 2,
		},
		Limits: LimitsConfig{
			MaxBodyMB:      10,
			MaxPixels:      40000000,
			QueueTimeout:   Duration(5 * time.Second),
			RequestTimeout: Duration(30 * time.Second),
		},
		Policy: PolicyConfig{
			UnsafeClasses:     []string{"porn", "hentai"},
			BorderlineClasses: []string{"sexy"},
			BlockThreshold:    0.80,
			ReviewThreshold:   0.50,
		},
		Log: LogConfig{
			Format: "json",
		},
	}
}

// Result carries the parsed config plus non-fatal warnings (e.g. falling
// back to defaults because DefaultPath has no file).
type Result struct {
	Config   Config
	Warnings []string
}

// Load reads path and strict-decodes it onto Defaults(), so any key omitted
// from the file keeps its default. Unknown keys are an error (KnownFields) —
// callers get a precise message instead of a silently ignored typo.
//
// A missing file is only tolerated at DefaultPath (defaults-only is a valid
// deployment, e.g. local dev); a missing file at an explicitly-passed path
// is an error. Note that inference.threads: 0 written in the file is
// indistinguishable from the key being absent — both mean runtime.NumCPU(),
// by design. Semantic checks (thresholds, limits, listen address) are not
// performed here; see internal/config's validate.go (task 003).
func Load(path string) (Result, error) {
	cfg := Defaults()

	f, err := os.Open(path)
	if errors.Is(err, os.ErrNotExist) {
		if path == DefaultPath {
			return Result{
				Config:   cfg,
				Warnings: []string{fmt.Sprintf("config %s not found; using defaults", path)},
			}, nil
		}
		return Result{}, fmt.Errorf("config %s: %w", path, err)
	}
	if err != nil {
		return Result{}, fmt.Errorf("config %s: %w", path, err)
	}
	defer f.Close()

	dec := yaml.NewDecoder(f)
	dec.KnownFields(true) // strict: unknown key -> error
	if err := dec.Decode(&cfg); err != nil && !errors.Is(err, io.EOF) {
		return Result{}, fmt.Errorf("config %s: %w", path, err) // io.EOF = empty file, keep defaults
	}

	return Result{Config: cfg}, nil
}
