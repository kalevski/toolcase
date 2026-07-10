package config

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

// clearImagewardenEnv unsets every override variable so a test starts from a
// clean environment regardless of the developer's shell (t.Setenv registers
// the restore automatically).
func clearImagewardenEnv(t *testing.T) {
	t.Helper()
	cfg := Defaults()
	for _, ev := range envVars(&cfg) {
		t.Setenv(ev.name, "")
	}
}

func TestApplyEnvAllVars(t *testing.T) {
	clearImagewardenEnv(t)
	t.Setenv("IMAGEWARDEN_LISTEN", "127.0.0.1:9999")
	t.Setenv("IMAGEWARDEN_API_TOKEN_ENV", "MY_TOKEN")
	t.Setenv("IMAGEWARDEN_MODEL_DIR", "/opt/model")
	t.Setenv("IMAGEWARDEN_INFERENCE_THREADS", "4")
	t.Setenv("IMAGEWARDEN_INFERENCE_CONCURRENCY", "8")
	t.Setenv("IMAGEWARDEN_LIMITS_MAX_BODY_MB", "25")
	t.Setenv("IMAGEWARDEN_LIMITS_MAX_PIXELS", "1000000")
	t.Setenv("IMAGEWARDEN_LIMITS_QUEUE_TIMEOUT", "7s")
	t.Setenv("IMAGEWARDEN_LIMITS_REQUEST_TIMEOUT", "1m")
	t.Setenv("IMAGEWARDEN_POLICY_UNSAFE_CLASSES", "porn, hentai ,sexy,")
	t.Setenv("IMAGEWARDEN_POLICY_BORDERLINE_CLASSES", "drawings")
	t.Setenv("IMAGEWARDEN_POLICY_BLOCK_THRESHOLD", "0.9")
	t.Setenv("IMAGEWARDEN_POLICY_REVIEW_THRESHOLD", "0.4")
	t.Setenv("IMAGEWARDEN_LOG_FORMAT", "logfmt")

	cfg := Defaults()
	applied, err := applyEnv(&cfg)
	if err != nil {
		t.Fatalf("applyEnv: %v", err)
	}
	if len(applied) != 14 {
		t.Errorf("applied %d overrides, want 14: %v", len(applied), applied)
	}

	if cfg.Listen != "127.0.0.1:9999" {
		t.Errorf("Listen = %q", cfg.Listen)
	}
	if cfg.API.TokenEnv != "MY_TOKEN" {
		t.Errorf("API.TokenEnv = %q", cfg.API.TokenEnv)
	}
	if cfg.Model.Dir != "/opt/model" {
		t.Errorf("Model.Dir = %q", cfg.Model.Dir)
	}
	if cfg.Inference.Threads != 4 || cfg.Inference.Concurrency != 8 {
		t.Errorf("Inference = %+v", cfg.Inference)
	}
	if cfg.Limits.MaxBodyMB != 25 || cfg.Limits.MaxPixels != 1000000 {
		t.Errorf("Limits = %+v", cfg.Limits)
	}
	if cfg.Limits.QueueTimeout.Std() != 7*time.Second {
		t.Errorf("QueueTimeout = %v", cfg.Limits.QueueTimeout.Std())
	}
	if cfg.Limits.RequestTimeout.Std() != time.Minute {
		t.Errorf("RequestTimeout = %v", cfg.Limits.RequestTimeout.Std())
	}
	// Whitespace trimmed, trailing empty element dropped.
	if want := []string{"porn", "hentai", "sexy"}; !reflect.DeepEqual(cfg.Policy.UnsafeClasses, want) {
		t.Errorf("UnsafeClasses = %v, want %v", cfg.Policy.UnsafeClasses, want)
	}
	if want := []string{"drawings"}; !reflect.DeepEqual(cfg.Policy.BorderlineClasses, want) {
		t.Errorf("BorderlineClasses = %v, want %v", cfg.Policy.BorderlineClasses, want)
	}
	if cfg.Policy.BlockThreshold != 0.9 || cfg.Policy.ReviewThreshold != 0.4 {
		t.Errorf("Policy thresholds = %+v", cfg.Policy)
	}
	if cfg.Log.Format != "logfmt" {
		t.Errorf("Log.Format = %q", cfg.Log.Format)
	}
}

func TestApplyEnvEmptyMeansUnset(t *testing.T) {
	clearImagewardenEnv(t)

	cfg := Defaults()
	applied, err := applyEnv(&cfg)
	if err != nil {
		t.Fatalf("applyEnv: %v", err)
	}
	if len(applied) != 0 {
		t.Errorf("applied = %v, want none (empty values mean unset)", applied)
	}
	if !reflect.DeepEqual(cfg, Defaults()) {
		t.Errorf("cfg mutated by empty env vars: %+v", cfg)
	}
}

func TestApplyEnvInvalidValues(t *testing.T) {
	cases := []struct {
		name, value string
	}{
		{"IMAGEWARDEN_INFERENCE_THREADS", "abc"},
		{"IMAGEWARDEN_INFERENCE_CONCURRENCY", "2.5"},
		{"IMAGEWARDEN_LIMITS_MAX_BODY_MB", "ten"},
		{"IMAGEWARDEN_LIMITS_MAX_PIXELS", "1e6"},
		{"IMAGEWARDEN_LIMITS_QUEUE_TIMEOUT", "5"},
		{"IMAGEWARDEN_LIMITS_REQUEST_TIMEOUT", "soon"},
		{"IMAGEWARDEN_POLICY_BLOCK_THRESHOLD", "high"},
		{"IMAGEWARDEN_POLICY_REVIEW_THRESHOLD", ""},
		{"IMAGEWARDEN_POLICY_UNSAFE_CLASSES", " , ,"},
	}
	for _, tc := range cases {
		t.Run(tc.name+"="+tc.value, func(t *testing.T) {
			clearImagewardenEnv(t)
			if tc.value == "" {
				return // empty is legal (means unset) — covered above; skip
			}
			t.Setenv(tc.name, tc.value)
			cfg := Defaults()
			_, err := applyEnv(&cfg)
			if err == nil {
				t.Fatalf("applyEnv accepted %s=%q, want error", tc.name, tc.value)
			}
			if !strings.Contains(err.Error(), tc.name) {
				t.Errorf("error %q does not name the variable %s", err, tc.name)
			}
		})
	}
}

// TestLoadEnvWinsOverFile pins the documented precedence: defaults < file < env.
func TestLoadEnvWinsOverFile(t *testing.T) {
	clearImagewardenEnv(t)
	t.Setenv("IMAGEWARDEN_LISTEN", "127.0.0.1:7777")
	t.Setenv("IMAGEWARDEN_LIMITS_MAX_BODY_MB", "42")

	path := filepath.Join(t.TempDir(), "config.yml")
	if err := os.WriteFile(path, []byte("listen: 0.0.0.0:1234\nlimits:\n  max_body_mb: 5\n  max_pixels: 99\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	res, err := Load(path)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if res.Config.Listen != "127.0.0.1:7777" {
		t.Errorf("Listen = %q, want env value", res.Config.Listen)
	}
	if res.Config.Limits.MaxBodyMB != 42 {
		t.Errorf("MaxBodyMB = %d, want env value 42", res.Config.Limits.MaxBodyMB)
	}
	if res.Config.Limits.MaxPixels != 99 {
		t.Errorf("MaxPixels = %d, want file value 99 (no env override)", res.Config.Limits.MaxPixels)
	}
	want := []string{"IMAGEWARDEN_LISTEN", "IMAGEWARDEN_LIMITS_MAX_BODY_MB"}
	if !reflect.DeepEqual(res.EnvOverrides, want) {
		t.Errorf("EnvOverrides = %v, want %v", res.EnvOverrides, want)
	}
}

// TestLoadEnvParseErrorFailsLoad asserts a malformed env value fails Load
// loudly rather than being silently ignored.
func TestLoadEnvParseErrorFailsLoad(t *testing.T) {
	clearImagewardenEnv(t)
	t.Setenv("IMAGEWARDEN_INFERENCE_CONCURRENCY", "lots")

	path := filepath.Join(t.TempDir(), "config.yml")
	if err := os.WriteFile(path, []byte(""), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(path); err == nil {
		t.Fatal("Load accepted a malformed env override, want error")
	}
}

// TestEnvVarNamesFollowYAMLPaths guards against typos: every override name
// must carry the IMAGEWARDEN_ prefix and be unique.
func TestEnvVarNamesFollowYAMLPaths(t *testing.T) {
	cfg := Defaults()
	seen := map[string]bool{}
	for _, ev := range envVars(&cfg) {
		if !strings.HasPrefix(ev.name, "IMAGEWARDEN_") {
			t.Errorf("env var %q missing IMAGEWARDEN_ prefix", ev.name)
		}
		if seen[ev.name] {
			t.Errorf("duplicate env var %q", ev.name)
		}
		seen[ev.name] = true
	}
}
