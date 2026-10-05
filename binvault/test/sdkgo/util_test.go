package sdkgo

import (
	"crypto/sha256"
	"os"
	"path/filepath"
	"testing"
)

func writeFile(t testing.TB, path string, data []byte) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatal(err)
	}
}

func readFile(t testing.TB, path string) []byte {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

// sha256Raw is the binary SHA-256 of b (as a string, for concatenation into composite checksums).
func sha256Raw(b []byte) string {
	s := sha256.Sum256(b)
	return string(s[:])
}
