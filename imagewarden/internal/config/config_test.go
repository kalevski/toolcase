package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestValidate(t *testing.T) {
	cases := []struct {
		name    string
		mutate  func(*Config)
		wantErr bool
	}{
		{"defaults ok", func(*Config) {}, false},
		{"block threshold below range", func(c *Config) { c.Policy.BlockThreshold = -0.1 }, true},
		{"block threshold above range", func(c *Config) { c.Policy.BlockThreshold = 1.5 }, true},
		{"review threshold below range", func(c *Config) { c.Policy.ReviewThreshold = -0.1 }, true},
		{"review threshold above range", func(c *Config) { c.Policy.ReviewThreshold = 1.5 }, true},
		{"review>block", func(c *Config) { c.Policy.ReviewThreshold = 0.9; c.Policy.BlockThreshold = 0.5 }, true},
		{"review==block ok", func(c *Config) { c.Policy.ReviewThreshold = 0.5; c.Policy.BlockThreshold = 0.5 }, false},
		{"thresholds at boundaries ok", func(c *Config) { c.Policy.ReviewThreshold = 0; c.Policy.BlockThreshold = 1 }, false},
		{"zero body", func(c *Config) { c.Limits.MaxBodyMB = 0 }, true},
		{"negative body", func(c *Config) { c.Limits.MaxBodyMB = -1 }, true},
		{"zero pixels", func(c *Config) { c.Limits.MaxPixels = 0 }, true},
		{"zero queue timeout", func(c *Config) { c.Limits.QueueTimeout = Duration(0) }, true},
		{"negative queue timeout", func(c *Config) { c.Limits.QueueTimeout = Duration(-time.Second) }, true},
		{"zero request timeout", func(c *Config) { c.Limits.RequestTimeout = Duration(0) }, true},
		{"concurrency zero", func(c *Config) { c.Inference.Concurrency = 0 }, true},
		{"threads negative", func(c *Config) { c.Inference.Threads = -1 }, true},
		{"threads zero ok", func(c *Config) { c.Inference.Threads = 0 }, false},
		{"bad listen", func(c *Config) { c.Listen = "not-an-addr" }, true},
		{"public no token", func(c *Config) { c.Listen = "0.0.0.0:8080"; c.API.TokenEnv = "" }, true},
		{"loopback no token", func(c *Config) { c.Listen = "127.0.0.1:8080"; c.API.TokenEnv = "" }, false},
		{"loopback ipv6 no token", func(c *Config) { c.Listen = "[::1]:8080"; c.API.TokenEnv = "" }, false},
		{"localhost no token", func(c *Config) { c.Listen = "localhost:8080"; c.API.TokenEnv = "" }, false},
		{"public with token ok", func(c *Config) { c.Listen = "0.0.0.0:8080"; c.API.TokenEnv = "IMAGEWARDEN_TOKEN" }, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := Defaults()
			tc.mutate(&cfg)
			err := cfg.Validate()
			if tc.wantErr && err == nil {
				t.Fatalf("Validate() = nil, want error")
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("Validate() = %v, want nil", err)
			}
		})
	}
}

func TestIsLoopbackListen(t *testing.T) {
	cases := []struct {
		addr string
		want bool
	}{
		{"127.0.0.1:8080", true},
		{"[::1]:8080", true},
		{"localhost:8080", true},
		{"0.0.0.0:8080", false},
		{"[::]:8080", false},
		{"10.0.0.5:8080", false},
		{"not-an-addr", false},
	}
	for _, tc := range cases {
		if got := isLoopbackListen(tc.addr); got != tc.want {
			t.Errorf("isLoopbackListen(%q) = %v, want %v", tc.addr, got, tc.want)
		}
	}
}

func TestLoadUnknownKeyRejected(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yml")
	if err := os.WriteFile(path, []byte("bogus_key: 1\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	_, err := Load(path)
	if err == nil {
		t.Fatal("Load() = nil, want error for unknown key")
	}
	if !strings.Contains(err.Error(), "bogus_key") {
		t.Fatalf("Load() error = %v, want mention of bogus_key", err)
	}
}

func TestLoadValidFileRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yml")
	data := []byte(`
listen: 127.0.0.1:9090
api:
  token_env: MY_TOKEN
limits:
  max_body_mb: 20
  max_pixels: 1000000
  queue_timeout: 2s
  request_timeout: 15s
policy:
  block_threshold: 0.9
  review_threshold: 0.4
`)
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}

	res, err := Load(path)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	cfg := res.Config

	if cfg.Listen != "127.0.0.1:9090" {
		t.Errorf("Listen = %q, want 127.0.0.1:9090", cfg.Listen)
	}
	if cfg.API.TokenEnv != "MY_TOKEN" {
		t.Errorf("API.TokenEnv = %q, want MY_TOKEN", cfg.API.TokenEnv)
	}
	if cfg.Limits.MaxBodyMB != 20 {
		t.Errorf("Limits.MaxBodyMB = %d, want 20", cfg.Limits.MaxBodyMB)
	}
	if cfg.Limits.MaxPixels != 1000000 {
		t.Errorf("Limits.MaxPixels = %d, want 1000000", cfg.Limits.MaxPixels)
	}
	if cfg.Limits.QueueTimeout.Std() != 2*time.Second {
		t.Errorf("Limits.QueueTimeout = %v, want 2s", cfg.Limits.QueueTimeout.Std())
	}
	if cfg.Limits.RequestTimeout.Std() != 15*time.Second {
		t.Errorf("Limits.RequestTimeout = %v, want 15s", cfg.Limits.RequestTimeout.Std())
	}
	if cfg.Policy.BlockThreshold != 0.9 {
		t.Errorf("Policy.BlockThreshold = %v, want 0.9", cfg.Policy.BlockThreshold)
	}
	if cfg.Policy.ReviewThreshold != 0.4 {
		t.Errorf("Policy.ReviewThreshold = %v, want 0.4", cfg.Policy.ReviewThreshold)
	}

	// Values not present in the file keep their defaults.
	if cfg.Model.Dir != Defaults().Model.Dir {
		t.Errorf("Model.Dir = %q, want default %q", cfg.Model.Dir, Defaults().Model.Dir)
	}

	if err := cfg.Validate(); err != nil {
		t.Fatalf("Validate() on loaded config = %v, want nil", err)
	}
}

func TestLoadMissingExplicitPathErrors(t *testing.T) {
	if _, err := Load(filepath.Join(t.TempDir(), "does-not-exist.yml")); err == nil {
		t.Fatal("Load() with an explicit missing path = nil error, want error")
	}
}
