package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// env.go maps IMAGEWARDEN_* environment variables onto Config fields, so a
// deployment can be configured entirely from the environment (e.g. Kubernetes
// / docker-compose `environment:` blocks) with no config.yml at all, or can
// override individual keys of a mounted file.
//
// Precedence is defaults < config file < environment: Load applies these
// after the YAML decode, so an env var always wins over the file. A variable
// that is unset or set to the empty string leaves the file/default value
// untouched — empty means "not configured", never "override to the zero
// value". Values are syntax-checked here (the error names the exact
// variable); semantic checks still run in Validate, same as file values.
//
// Naming follows the YAML path: `limits.max_body_mb` becomes
// IMAGEWARDEN_LIMITS_MAX_BODY_MB. Note the distinction from
// IMAGEWARDEN_TOKEN: that (or whatever api.token_env names) holds the bearer
// token *value*; IMAGEWARDEN_API_TOKEN_ENV configures which variable is read.

// envVar binds one environment variable name to its Config field setter.
type envVar struct {
	name string
	set  func(string) error
}

// envVars enumerates every supported override for cfg. Kept as a function
// (not a package-level table) because the setters close over cfg.
func envVars(cfg *Config) []envVar {
	return []envVar{
		{"IMAGEWARDEN_LISTEN", setString(&cfg.Listen)},
		{"IMAGEWARDEN_API_TOKEN_ENV", setString(&cfg.API.TokenEnv)},
		{"IMAGEWARDEN_MODEL_DIR", setString(&cfg.Model.Dir)},
		{"IMAGEWARDEN_INFERENCE_THREADS", setInt(&cfg.Inference.Threads)},
		{"IMAGEWARDEN_INFERENCE_CONCURRENCY", setInt(&cfg.Inference.Concurrency)},
		{"IMAGEWARDEN_LIMITS_MAX_BODY_MB", setInt(&cfg.Limits.MaxBodyMB)},
		{"IMAGEWARDEN_LIMITS_MAX_PIXELS", setInt(&cfg.Limits.MaxPixels)},
		{"IMAGEWARDEN_LIMITS_QUEUE_TIMEOUT", setDuration(&cfg.Limits.QueueTimeout)},
		{"IMAGEWARDEN_LIMITS_REQUEST_TIMEOUT", setDuration(&cfg.Limits.RequestTimeout)},
		{"IMAGEWARDEN_POLICY_UNSAFE_CLASSES", setList(&cfg.Policy.UnsafeClasses)},
		{"IMAGEWARDEN_POLICY_BORDERLINE_CLASSES", setList(&cfg.Policy.BorderlineClasses)},
		{"IMAGEWARDEN_POLICY_BLOCK_THRESHOLD", setFloat(&cfg.Policy.BlockThreshold)},
		{"IMAGEWARDEN_POLICY_REVIEW_THRESHOLD", setFloat(&cfg.Policy.ReviewThreshold)},
		{"IMAGEWARDEN_LOG_FORMAT", setString(&cfg.Log.Format)},
	}
}

// applyEnv overrides cfg from the process environment and returns the names
// of the variables it applied (for the caller to log), or an error naming
// the first variable whose value failed to parse.
func applyEnv(cfg *Config) ([]string, error) {
	var applied []string
	for _, ev := range envVars(cfg) {
		v, ok := os.LookupEnv(ev.name)
		if !ok || v == "" {
			continue
		}
		if err := ev.set(v); err != nil {
			return nil, fmt.Errorf("env %s: %w", ev.name, err)
		}
		applied = append(applied, ev.name)
	}
	return applied, nil
}

func setString(dst *string) func(string) error {
	return func(v string) error {
		*dst = v
		return nil
	}
}

func setInt(dst *int) func(string) error {
	return func(v string) error {
		n, err := strconv.Atoi(v)
		if err != nil {
			return fmt.Errorf("invalid integer %q", v)
		}
		*dst = n
		return nil
	}
}

func setFloat(dst *float64) func(string) error {
	return func(v string) error {
		f, err := strconv.ParseFloat(v, 64)
		if err != nil {
			return fmt.Errorf("invalid number %q", v)
		}
		*dst = f
		return nil
	}
}

func setDuration(dst *Duration) func(string) error {
	return func(v string) error {
		d, err := time.ParseDuration(v)
		if err != nil {
			return fmt.Errorf("invalid duration %q (want e.g. \"5s\")", v)
		}
		*dst = Duration(d)
		return nil
	}
}

// setList parses a comma-separated value ("porn,hentai") into a string
// slice, trimming whitespace around each element and dropping empties, so
// "porn, hentai" and "porn,hentai," both parse cleanly. The override
// REPLACES the whole list (same as a YAML list would).
func setList(dst *[]string) func(string) error {
	return func(v string) error {
		var out []string
		for _, part := range strings.Split(v, ",") {
			if p := strings.TrimSpace(part); p != "" {
				out = append(out, p)
			}
		}
		if len(out) == 0 {
			return fmt.Errorf("invalid list %q: no elements", v)
		}
		*dst = out
		return nil
	}
}
