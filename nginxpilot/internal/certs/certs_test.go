package certs

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func writeFile(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestLoadBothLayouts(t *testing.T) {
	dir := t.TempDir()
	// certbot live layout
	writeFile(t, filepath.Join(dir, "a.example.com", "fullchain.pem"))
	writeFile(t, filepath.Join(dir, "a.example.com", "privkey.pem"))
	// flat layout
	writeFile(t, filepath.Join(dir, "b.example.com.crt"))
	writeFile(t, filepath.Join(dir, "b.example.com.key"))
	// incomplete pair (cert without key) → ignored
	writeFile(t, filepath.Join(dir, "c.example.com.crt"))

	idx, err := Load(dir)
	if err != nil {
		t.Fatalf("load: %v", err)
	}

	if cert, key, ok := idx.For("a.example.com"); !ok ||
		cert != filepath.Join(dir, "a.example.com", "fullchain.pem") ||
		key != filepath.Join(dir, "a.example.com", "privkey.pem") {
		t.Errorf("certbot layout not resolved: %q %q %v", cert, key, ok)
	}
	if cert, key, ok := idx.For("b.example.com"); !ok ||
		cert != filepath.Join(dir, "b.example.com.crt") ||
		key != filepath.Join(dir, "b.example.com.key") {
		t.Errorf("flat layout not resolved: %q %q %v", cert, key, ok)
	}
	if _, _, ok := idx.For("c.example.com"); ok {
		t.Error("incomplete pair must not resolve")
	}
	if _, _, ok := idx.For("missing.example.com"); ok {
		t.Error("missing domain must not resolve")
	}
}

func TestLoadMissingDirIsEmpty(t *testing.T) {
	idx, err := Load(filepath.Join(t.TempDir(), "does-not-exist"))
	if err != nil {
		t.Fatalf("missing dir should not error: %v", err)
	}
	if len(idx.Domains()) != 0 {
		t.Error("missing dir should yield empty index")
	}
}

func TestNilIndexSafe(t *testing.T) {
	var idx *Index
	if _, _, ok := idx.For("x"); ok {
		t.Error("nil index For should be false")
	}
	if idx.Fingerprint() != "" {
		t.Error("nil index fingerprint should be empty")
	}
}

// A renewal (same path, newer mtime) changes the fingerprint, so the watcher
// reports a change.
func TestWatcherDetectsRenewal(t *testing.T) {
	dir := t.TempDir()
	key := filepath.Join(dir, "a.example.com", "privkey.pem")
	writeFile(t, filepath.Join(dir, "a.example.com", "fullchain.pem"))
	writeFile(t, key)

	idx0, _ := Load(dir)
	w := NewWatcher(dir, time.Minute, idx0.Fingerprint(), nil)

	// No change yet.
	if changed, _, _ := w.Poll(); changed {
		t.Error("no change should be reported initially")
	}

	// Bump the key mtime (simulate renewal in place).
	future := time.Now().Add(2 * time.Hour)
	if err := os.Chtimes(key, future, future); err != nil {
		t.Fatal(err)
	}
	changed, _, err := w.Poll()
	if err != nil {
		t.Fatal(err)
	}
	if !changed {
		t.Error("renewal (mtime bump) should be detected")
	}
	// Stable afterward.
	if changed, _, _ := w.Poll(); changed {
		t.Error("no further change should be reported")
	}
}
