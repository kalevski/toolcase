package config

import (
	"path/filepath"
	"testing"
	"time"
)

// TestShippedDefaultConfig loads the real docker/config.yml (task 032 bakes
// it into the image at DefaultPath) through the same Load/Validate path the
// container uses at boot, so drift between the shipped file and the Config
// struct (task 002) or the semantic rules (task 003) fails here instead of
// at deploy time.
//
// go test runs with the working directory set to the package under test
// (internal/config), so the shipped file is two levels up at the module
// root's docker/config.yml.
func TestShippedDefaultConfig(t *testing.T) {
	path := filepath.Join("..", "..", "docker", "config.yml")

	res, err := Load(path) // strict decode (task 002), KnownFields(true)
	if err != nil {
		t.Fatalf("shipped docker/config.yml failed to Load: %v", err)
	}
	if len(res.Warnings) != 0 {
		t.Errorf("unexpected warnings loading shipped config: %v", res.Warnings)
	}

	c := res.Config
	if err := c.Validate(); err != nil { // semantic checks (task 003)
		t.Fatalf("shipped docker/config.yml failed Validate: %v", err)
	}

	// Pin the container contract (spec §9, §6) so an accidental edit to
	// docker/config.yml is caught here, not at deploy time.
	checks := []struct {
		name string
		ok   bool
	}{
		{"listen", c.Listen == "0.0.0.0:8080"},
		{"model.dir", c.Model.Dir == "/usr/share/imagewarden/model"},
		{"api.token_env", c.API.TokenEnv == "IMAGEWARDEN_TOKEN"},
		{"limits.max_body_mb", c.Limits.MaxBodyMB == 10},
		{"limits.max_pixels", c.Limits.MaxPixels == 40_000_000},
		{"limits.queue_timeout", c.Limits.QueueTimeout.Std() == 5*time.Second},
		{"limits.request_timeout", c.Limits.RequestTimeout.Std() == 30*time.Second},
		{"policy.block_threshold", c.Policy.BlockThreshold == 0.80},
		{"policy.review_threshold", c.Policy.ReviewThreshold == 0.50},
		{"log.format", c.Log.Format == "json"},
	}
	for _, chk := range checks {
		if !chk.ok {
			t.Errorf("shipped config drifted from container default: %s", chk.name)
		}
	}

	// The shipped listen (0.0.0.0:8080) is non-loopback, so Validate passing
	// above already proves api.token_env satisfies the auth rule (task 003)
	// exactly as it would at container boot (task 024).
}
