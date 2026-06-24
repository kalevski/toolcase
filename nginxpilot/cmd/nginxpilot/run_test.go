package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveAdminToken(t *testing.T) {
	t.Run("no refs configured returns empty string no error", func(t *testing.T) {
		got, err := resolveAdminToken("", "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got != "" {
			t.Fatalf("want empty string, got %q", got)
		}
	})

	t.Run("token_env set and variable has value returns token", func(t *testing.T) {
		t.Setenv("TEST_ADMIN_TOKEN_SET", "supersecret")
		got, err := resolveAdminToken("TEST_ADMIN_TOKEN_SET", "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got != "supersecret" {
			t.Fatalf("want %q, got %q", "supersecret", got)
		}
	})

	t.Run("token_env set but variable unset returns error", func(t *testing.T) {
		_, err := resolveAdminToken("TEST_ADMIN_TOKEN_MISSING_XYZ", "")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("token_env set but variable empty returns error", func(t *testing.T) {
		t.Setenv("TEST_ADMIN_TOKEN_EMPTY", "")
		_, err := resolveAdminToken("TEST_ADMIN_TOKEN_EMPTY", "")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("token_file with 0600 returns token", func(t *testing.T) {
		dir := t.TempDir()
		f := filepath.Join(dir, "token")
		if err := os.WriteFile(f, []byte("filetoken\n"), 0o600); err != nil {
			t.Fatal(err)
		}
		got, err := resolveAdminToken("", f)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got != "filetoken" {
			t.Fatalf("want %q, got %q", "filetoken", got)
		}
	})

	t.Run("token_file with 0644 rejected", func(t *testing.T) {
		dir := t.TempDir()
		f := filepath.Join(dir, "token")
		if err := os.WriteFile(f, []byte("filetoken"), 0o644); err != nil {
			t.Fatal(err)
		}
		_, err := resolveAdminToken("", f)
		if err == nil {
			t.Fatal("expected error for too-permissive secret file, got nil")
		}
	})
}
