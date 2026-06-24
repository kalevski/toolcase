package git

import (
	"archive/tar"
	"bytes"
	"encoding/base64"
	"io"
	"log/slog"
	"os"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// TestGitEnvGitHubToken verifies that github-token auth injects the access
// token as an `Authorization: Basic` header under the fixed
// "x-access-token" username — via GIT_CONFIG_*, never in argv.
func TestGitEnvGitHubToken(t *testing.T) {
	t.Setenv("GH_TOKEN", "ghs_exampletoken")
	s := &Syncer{
		url:  "https://github.com/example/repo.git",
		auth: config.Auth{Method: config.AuthGitHubToken, TokenEnv: "GH_TOKEN"},
		log:  slog.New(slog.NewTextHandler(io.Discard, nil)),
	}

	env, err := s.gitEnv()
	if err != nil {
		t.Fatalf("gitEnv: %v", err)
	}

	want := "Authorization: Basic " + base64.StdEncoding.EncodeToString([]byte("x-access-token:ghs_exampletoken"))
	var gotHeader, gotKey bool
	for _, e := range env {
		if e == "GIT_CONFIG_VALUE_0="+want {
			gotHeader = true
		}
		if e == "GIT_CONFIG_KEY_0=http.https://github.com/example/repo.git.extraHeader" {
			gotKey = true
		}
	}
	if !gotKey {
		t.Errorf("extraHeader config key not set; env=%v", env)
	}
	if !gotHeader {
		t.Errorf("expected %q in env, got %v", want, env)
	}
}

// TestMaterializeKeyFromEnv verifies that key_env writes the key material to
// a 0600 daemon-owned temp file, gitEnv points ssh at it, and cleanup removes
// it — the no-staging path for containers.
func TestMaterializeKeyFromEnv(t *testing.T) {
	dir := t.TempDir()
	const keyBody = "-----BEGIN OPENSSH PRIVATE KEY-----\nabc123\n-----END OPENSSH PRIVATE KEY-----"
	t.Setenv("SSH_KEY", keyBody)
	s := &Syncer{
		url:     "git@github.com:example/repo.git",
		auth:    config.Auth{Method: config.AuthSSHKey, KeyEnv: "SSH_KEY"},
		dataDir: dir,
		log:     slog.New(slog.NewTextHandler(io.Discard, nil)),
	}

	cleanup, err := s.materializeKey()
	if err != nil {
		t.Fatalf("materializeKey: %v", err)
	}
	if s.keyPath == "" {
		t.Fatal("keyPath not set")
	}
	fi, err := os.Stat(s.keyPath)
	if err != nil {
		t.Fatalf("stat key: %v", err)
	}
	if fi.Mode().Perm() != 0o600 {
		t.Errorf("key file mode = %o, want 0600", fi.Mode().Perm())
	}
	got, _ := os.ReadFile(s.keyPath)
	if string(got) != keyBody+"\n" {
		t.Errorf("key content = %q, want body + trailing newline", got)
	}

	env, err := s.gitEnv()
	if err != nil {
		t.Fatalf("gitEnv: %v", err)
	}
	var ok bool
	for _, e := range env {
		if strings.HasPrefix(e, "GIT_SSH_COMMAND=") && strings.Contains(e, s.keyPath) {
			ok = true
		}
	}
	if !ok {
		t.Errorf("GIT_SSH_COMMAND missing materialized key path; env=%v", env)
	}

	cleanup()
	if _, err := os.Stat(s.keyPath); !os.IsNotExist(err) {
		t.Error("cleanup did not remove the temp key file")
	}
}

// TestMaterializeKeyFromFileIsNoop verifies key_file is used in place (no
// temp file, cleanup is a no-op).
func TestMaterializeKeyFromFileIsNoop(t *testing.T) {
	s := &Syncer{
		auth: config.Auth{Method: config.AuthSSHKey, KeyFile: "/etc/keys/id_ed25519"},
		log:  slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
	cleanup, err := s.materializeKey()
	if err != nil {
		t.Fatalf("materializeKey: %v", err)
	}
	defer cleanup()
	if s.keyPath != "/etc/keys/id_ed25519" {
		t.Errorf("keyPath = %q, want the key_file path", s.keyPath)
	}
}

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

// TestUntarTraversalRejected verifies that an archive entry whose path
// escapes the staging directory is rejected before any file is written.
func TestUntarTraversalRejected(t *testing.T) {
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	_ = tw.WriteHeader(&tar.Header{
		Typeflag: tar.TypeReg,
		Name:     "../escape.txt",
		Size:     5,
		Mode:     0o640,
	})
	_, _ = tw.Write([]byte("oops!"))
	_ = tw.Close()

	s := newTestSyncer(config.Limits{}.Effective())
	err := s.untar(bytes.NewReader(buf.Bytes()), t.TempDir())
	if err == nil {
		t.Fatal("expected error for path traversal, got nil")
	}
	if !strings.Contains(err.Error(), "escapes") {
		t.Fatalf("expected 'escapes' in error, got: %v", err)
	}
}

// TestUntarSymlinkSkipped verifies that TypeSymlink entries are skipped
// (logged as warnings) and do not cause extraction to fail.
func TestUntarSymlinkSkipped(t *testing.T) {
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	_ = tw.WriteHeader(&tar.Header{
		Typeflag: tar.TypeSymlink,
		Name:     "link",
		Linkname: "/etc/passwd",
		Mode:     0o777,
	})
	_ = tw.WriteHeader(&tar.Header{
		Typeflag: tar.TypeReg,
		Name:     "real.txt",
		Size:     5,
		Mode:     0o640,
	})
	_, _ = tw.Write([]byte("hello"))
	_ = tw.Close()

	s := newTestSyncer(config.Limits{}.Effective())
	dest := t.TempDir()
	if err := s.untar(bytes.NewReader(buf.Bytes()), dest); err != nil {
		t.Fatalf("symlink entry should be skipped, not error: %v", err)
	}

	// The symlink must not have been created.
	if _, err := os.Lstat(dest + "/link"); !os.IsNotExist(err) {
		t.Error("symlink entry was materialized; it should have been skipped")
	}
	// The regular file alongside it must be present.
	if _, err := os.Stat(dest + "/real.txt"); err != nil {
		t.Errorf("real.txt missing after symlink skip: %v", err)
	}
}

// TestUntarHardlinkSkipped verifies that TypeLink (hard-link) entries are
// skipped without error — hard links could escape the staging tree.
func TestUntarHardlinkSkipped(t *testing.T) {
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	_ = tw.WriteHeader(&tar.Header{
		Typeflag: tar.TypeReg,
		Name:     "original.txt",
		Size:     3,
		Mode:     0o640,
	})
	_, _ = tw.Write([]byte("abc"))
	_ = tw.WriteHeader(&tar.Header{
		Typeflag: tar.TypeLink,
		Name:     "hardlink",
		Linkname: "original.txt",
	})
	_ = tw.Close()

	s := newTestSyncer(config.Limits{}.Effective())
	dest := t.TempDir()
	if err := s.untar(bytes.NewReader(buf.Bytes()), dest); err != nil {
		t.Fatalf("hard-link entry should be skipped, not error: %v", err)
	}

	// Hard link must not exist.
	if _, err := os.Lstat(dest + "/hardlink"); !os.IsNotExist(err) {
		t.Error("hard-link entry was materialized; it should have been skipped")
	}
}

// TestUntarSubdirPrefixStripping verifies that when a Syncer is configured
// with a subdir, entries under that prefix are extracted with the prefix
// removed and entries outside it are ignored.
func TestUntarSubdirPrefixStripping(t *testing.T) {
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	for name, data := range map[string][]byte{
		"site/index.html":   []byte("<html/>"),
		"site/css/main.css": []byte("body{}"),
		"other/skip.txt":    []byte("ignored"),
	} {
		_ = tw.WriteHeader(&tar.Header{
			Typeflag: tar.TypeReg,
			Name:     name,
			Size:     int64(len(data)),
			Mode:     0o640,
		})
		_, _ = tw.Write(data)
	}
	_ = tw.Close()

	s := &Syncer{
		subdir: "site",
		limits: config.Limits{}.Effective(),
		log:    slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
	dest := t.TempDir()
	if err := s.untar(bytes.NewReader(buf.Bytes()), dest); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Files under site/ must exist without the prefix.
	for _, name := range []string{"index.html", "css/main.css"} {
		if _, err := os.Stat(dest + "/" + name); err != nil {
			t.Errorf("expected %q to be extracted: %v", name, err)
		}
	}
	// Files outside the subdir must not appear.
	if _, err := os.Stat(dest + "/other"); !os.IsNotExist(err) {
		t.Error("entry outside subdir was extracted; it should have been skipped")
	}
	if _, err := os.Stat(dest + "/skip.txt"); !os.IsNotExist(err) {
		t.Error("entry outside subdir was extracted; it should have been skipped")
	}
}
