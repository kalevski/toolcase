package admintoken

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const token = "0123456789abcdef0123456789abcdef-token"

func TestResolveNoRefs(t *testing.T) {
	got, err := Resolve("", "")
	if err != nil || got.Hash != nil {
		t.Fatalf("no refs: want nil hash and no error, got %v, %v", got.Hash, err)
	}
}

func TestResolveEnvOnly(t *testing.T) {
	t.Setenv("NP_TEST_TOKEN", token)
	got, err := Resolve("NP_TEST_TOKEN", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !got.Hash.Matches(token) || got.Hash.Matches("other") {
		t.Fatal("env-only hash does not match the env token")
	}

	t.Setenv("NP_TEST_TOKEN", "")
	if _, err := Resolve("NP_TEST_TOKEN", ""); err == nil {
		t.Fatal("empty env token: want an error")
	}
}

func TestResolveSeedsFileFromEnv(t *testing.T) {
	file := filepath.Join(t.TempDir(), "secrets", "admin.token")
	t.Setenv("NP_TEST_TOKEN", token)

	got, err := Resolve("NP_TEST_TOKEN", file)
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	if !got.Seeded || !got.Hash.Matches(token) {
		t.Fatalf("seed: want Seeded and a matching hash, got %+v", got)
	}

	raw, err := os.ReadFile(file)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), token) || !strings.HasPrefix(string(raw), "sha256:") {
		t.Fatalf("token_file must hold only the hash, got %q", raw)
	}
	info, _ := os.Stat(file)
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("token_file mode: want 0600, got %04o", info.Mode().Perm())
	}

	again, err := Resolve("NP_TEST_TOKEN", file)
	if err != nil || again.Seeded || again.EnvIgnored {
		t.Fatalf("second start: want the stored hash, no seed, no warning; got %+v, %v", again, err)
	}
}

func TestResolveFileWinsOverEnv(t *testing.T) {
	file := filepath.Join(t.TempDir(), "admin.token")
	if err := Store(file, token); err != nil {
		t.Fatal(err)
	}
	t.Setenv("NP_TEST_TOKEN", "a-dead-token-that-was-rotated-away-already")

	got, err := Resolve("NP_TEST_TOKEN", file)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !got.EnvIgnored || !got.Hash.Matches(token) || got.Hash.Matches("a-dead-token-that-was-rotated-away-already") {
		t.Fatalf("the stored hash must win and the env token be flagged, got %+v", got)
	}
}

func TestResolveRejectsPlaintextFile(t *testing.T) {
	file := filepath.Join(t.TempDir(), "admin.token")
	if err := os.WriteFile(file, []byte(token+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Resolve("", file); err == nil || !strings.Contains(err.Error(), "token set") {
		t.Fatalf("a plaintext token_file must be refused with a pointer to `token set`, got %v", err)
	}
}

func TestResolveRejectsLooseFile(t *testing.T) {
	file := filepath.Join(t.TempDir(), "admin.token")
	if err := os.WriteFile(file, []byte(Sum(token)+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Resolve("", file); err == nil {
		t.Fatal("a 0644 token_file must be refused")
	}
}

func TestResolveMissingFileWithoutSeed(t *testing.T) {
	file := filepath.Join(t.TempDir(), "admin.token")
	if _, err := Resolve("", file); err == nil {
		t.Fatal("a missing token_file with no token_env must be refused")
	}
	t.Setenv("NP_TEST_TOKEN", "")
	if _, err := Resolve("NP_TEST_TOKEN", file); err == nil {
		t.Fatal("a missing token_file with an empty token_env must be refused")
	}
}

func TestStoreReplacesAtomically(t *testing.T) {
	dir := t.TempDir()
	file := filepath.Join(dir, "admin.token")
	if err := Store(file, token); err != nil {
		t.Fatal(err)
	}
	if err := Store(file, token+"-rotated"); err != nil {
		t.Fatal(err)
	}
	got, err := Resolve("", file)
	if err != nil || !got.Hash.Matches(token+"-rotated") || got.Hash.Matches(token) {
		t.Fatalf("rotated hash not in place: %+v, %v", got, err)
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 1 {
		t.Fatalf("Store must leave no temp files behind, found %d entries", len(entries))
	}
}

func TestResolveRejectsShortEnvToken(t *testing.T) {
	t.Setenv("NP_TEST_TOKEN", "too-short")
	if _, err := Resolve("NP_TEST_TOKEN", ""); err == nil {
		t.Fatal("env-only: a token under MinLength must be refused at startup")
	}
	file := filepath.Join(t.TempDir(), "admin.token")
	if _, err := Resolve("NP_TEST_TOKEN", file); err == nil {
		t.Fatal("seeding: a token under MinLength must be refused")
	}
	if _, err := os.Stat(file); err == nil {
		t.Fatal("a short token must not be seeded to disk")
	}
}
