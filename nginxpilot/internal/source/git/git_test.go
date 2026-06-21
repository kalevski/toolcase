package git

import (
	"archive/tar"
	"bytes"
	"io"
	"log/slog"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

func TestCacheDir(t *testing.T) {
	const dataDir = "/data"
	const url = "https://github.com/example/repo.git"
	const branch = "main"

	tests := []struct {
		name    string
		domain  string
		dataDir string
		url     string
		branch  string
	}{
		{name: "site-a", domain: "a.example.com", dataDir: dataDir, url: url, branch: branch},
		{name: "site-b", domain: "b.example.com", dataDir: dataDir, url: url, branch: branch},
		{name: "site-a-alt-branch", domain: "a.example.com", dataDir: dataDir, url: url, branch: "dev"},
		{name: "site-a-alt-url", domain: "a.example.com", dataDir: dataDir, url: "https://github.com/example/other.git", branch: branch},
	}

	// Build all results first, then compare.
	dirs := make([]string, len(tests))
	for i, tc := range tests {
		dirs[i] = CacheDir(tc.domain, tc.dataDir, tc.url, tc.branch)
		if dirs[i] == "" {
			t.Errorf("[%s] CacheDir returned empty string", tc.name)
		}
	}

	// Stability: same inputs always produce the same path.
	for i, tc := range tests {
		got := CacheDir(tc.domain, tc.dataDir, tc.url, tc.branch)
		if got != dirs[i] {
			t.Errorf("[%s] CacheDir not stable: first=%q second=%q", tc.name, dirs[i], got)
		}
	}

	// Distinctness: every pair must produce a different path.
	for i := range tests {
		for j := i + 1; j < len(tests); j++ {
			if dirs[i] == dirs[j] {
				t.Errorf("CacheDir collision: [%s] and [%s] both produced %q",
					tests[i].name, tests[j].name, dirs[i])
			}
		}
	}
}

// TestCacheDirDomainIsolation is the core contract: same url+branch, different
// domain → different cache dir (prevents concurrent clone races, task 592).
func TestCacheDirDomainIsolation(t *testing.T) {
	const dataDir = "/data"
	const url = "https://github.com/example/repo.git"
	const branch = "main"

	dirA := CacheDir("site-a.example.com", dataDir, url, branch)
	dirB := CacheDir("site-b.example.com", dataDir, url, branch)

	if dirA == dirB {
		t.Fatalf("expected distinct cache dirs for different domains; both got %q", dirA)
	}
}

// makeTar writes n regular files of the given payload into a tar stream.
func makeTar(files map[string][]byte) []byte {
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	for name, data := range files {
		_ = tw.WriteHeader(&tar.Header{
			Typeflag: tar.TypeReg,
			Name:     name,
			Size:     int64(len(data)),
			Mode:     0o640,
		})
		_, _ = tw.Write(data)
	}
	_ = tw.Close()
	return buf.Bytes()
}

// newTestSyncer builds a minimal Syncer with explicit limits and no auth/log noise.
func newTestSyncer(limits config.Limits) *Syncer {
	return &Syncer{
		limits: limits,
		log:    slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
}

func TestUntarMaxEntries(t *testing.T) {
	s := newTestSyncer(config.Limits{
		MaxEntries:          2,
		MaxUncompressedSize: config.ByteSize(config.DefaultMaxUncompressedSize),
	}.Effective())

	stream := makeTar(map[string][]byte{
		"a.txt": []byte("hello"),
		"b.txt": []byte("world"),
		"c.txt": []byte("extra"),
	})

	dest := t.TempDir()
	err := s.untar(bytes.NewReader(stream), dest)
	if err == nil {
		t.Fatal("expected error for max_entries exceeded, got nil")
	}
	if !strings.Contains(err.Error(), "max_entries") {
		t.Fatalf("expected max_entries error, got: %v", err)
	}
}

func TestUntarMaxUncompressedSize(t *testing.T) {
	const limit = 50

	s := newTestSyncer(config.Limits{
		MaxEntries:          config.DefaultMaxEntries,
		MaxUncompressedSize: limit,
	}.Effective())

	stream := makeTar(map[string][]byte{
		"big.txt": bytes.Repeat([]byte("x"), limit+1),
	})

	dest := t.TempDir()
	err := s.untar(bytes.NewReader(stream), dest)
	if err == nil {
		t.Fatal("expected error for max_uncompressed_size exceeded, got nil")
	}
	if !strings.Contains(err.Error(), "max_uncompressed_size") {
		t.Fatalf("expected max_uncompressed_size error, got: %v", err)
	}
}

func TestUntarWithinLimits(t *testing.T) {
	s := newTestSyncer(config.Limits{
		MaxEntries:          5,
		MaxUncompressedSize: 1024,
	}.Effective())

	stream := makeTar(map[string][]byte{
		"a.txt": []byte("hello"),
		"b.txt": []byte("world"),
	})

	dest := t.TempDir()
	if err := s.untar(bytes.NewReader(stream), dest); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
