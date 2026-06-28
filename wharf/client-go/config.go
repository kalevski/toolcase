// Package wharf is the wharf-client library: it fetches resolved configuration
// (env vars + feature flags) from a Wharf Agent API and either injects it, writes
// it to a file, or serves it on a loopback endpoint (planning §6). Dependency-light
// — standard library only; `go build` with CGO_ENABLED=0 yields a static binary.
package wharf

import (
	"errors"
	"os"
)

// Config is the client's connection settings. Populate it directly or via FromEnv.
type Config struct {
	URL         string // Agent-API base URL, e.g. http://wharf-agent:4000
	Environment string // the instance's environment name
	InstanceID  string // the instance id (X-Wharf-Instance)
	Secret      string // the per-instance fetch secret (Bearer); sourced from a Docker/orchestrator secret
}

// FromEnv reads the standard WHARF_* environment variables (planning §6).
func FromEnv() Config {
	return Config{
		URL:         os.Getenv("WHARF_URL"),
		Environment: os.Getenv("WHARF_ENVIRONMENT"),
		InstanceID:  os.Getenv("WHARF_INSTANCE_ID"),
		Secret:      os.Getenv("WHARF_SECRET"),
	}
}

// Validate ensures every required field is present (the client fails closed).
func (c Config) Validate() error {
	if c.URL == "" {
		return errors.New("WHARF_URL is required")
	}
	if c.Environment == "" {
		return errors.New("WHARF_ENVIRONMENT is required")
	}
	if c.InstanceID == "" {
		return errors.New("WHARF_INSTANCE_ID is required")
	}
	if c.Secret == "" {
		return errors.New("WHARF_SECRET is required")
	}
	return nil
}
