// Package perch is the perch-client library: it fetches resolved
// configuration (env vars + feature flags) from a Perch instance-fetch API and
// either injects it, writes it to a file, or serves it on a loopback endpoint
// (move_wharf_to_perch.md §9). Ported from wharf's client-go, dropping the
// environment tier (the flat instance model addresses everything by instance
// name alone). Dependency-light — standard library only; `go build` with
// CGO_ENABLED=0 yields a static binary.
package perch

import (
	"errors"
	"os"
)

// Config is the client's connection settings. Populate it directly or via FromEnv.
type Config struct {
	URL      string // fetch-API base URL, e.g. https://perch.example.com
	Instance string // the instance name (X-Perch-Instance)
	Secret   string // the per-instance fetch secret (Bearer); sourced from a Docker/orchestrator secret
}

// FromEnv reads the standard PERCH_* environment variables (move_wharf_to_perch.md §9).
func FromEnv() Config {
	return Config{
		URL:      os.Getenv("PERCH_URL"),
		Instance: os.Getenv("PERCH_INSTANCE"),
		Secret:   os.Getenv("PERCH_SECRET"),
	}
}

// Validate ensures every required field is present (the client fails closed).
func (c Config) Validate() error {
	if c.URL == "" {
		return errors.New("PERCH_URL is required")
	}
	if c.Instance == "" {
		return errors.New("PERCH_INSTANCE is required")
	}
	if c.Secret == "" {
		return errors.New("PERCH_SECRET is required")
	}
	return nil
}
