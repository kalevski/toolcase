package config

import (
	"strings"
	"testing"
)

func minValidConfig() Config {
	return Config{
		LogLevel: "info",
		DataDir:  "/tmp",
		Defaults: Defaults{KeepReleases: 1},
	}
}

func TestValidateAdminTokenMutualExclusion(t *testing.T) {
	cfg := minValidConfig()
	cfg.Admin.TokenEnv = "SOME_ENV"
	cfg.Admin.TokenFile = "/some/file"

	err := Validate(&cfg)
	if err == nil {
		t.Fatal("expected error when both token_env and token_file are set, got nil")
	}
	if !strings.Contains(err.Error(), "mutually exclusive") {
		t.Fatalf("expected 'mutually exclusive' in error, got: %v", err)
	}
}

func TestValidateAdminTokenEnvOnly(t *testing.T) {
	cfg := minValidConfig()
	cfg.Admin.TokenEnv = "SOME_ENV"
	// token_file unset — should not error from mutual exclusion check
	err := Validate(&cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateAdminTokenFileOnly(t *testing.T) {
	cfg := minValidConfig()
	cfg.Admin.TokenFile = "/some/file"
	// token_env unset — should not error from mutual exclusion check
	err := Validate(&cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
