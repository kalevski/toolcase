package httpzip

import (
	"archive/zip"
	"bytes"
	"encoding/binary"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// newExtractSyncer builds a minimal Syncer for extract / resolveStrip tests.
func newExtractSyncer(limits config.Limits, strip *int) *Syncer {
	return &Syncer{
		limits: limits,
		strip:  strip,
		log:    slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
}

// writeZipEntries writes a zip archive to a temp file and returns the path and
// its size on disk.  entries maps name → content.
func writeZipEntries(t *testing.T, entries map[string][]byte) (string, int64) {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for name, data := range entries {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := w.Write(data); err != nil {
			t.Fatal(err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	f, err := os.CreateTemp(t.TempDir(), "*.zip")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.Write(buf.Bytes()); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	return f.Name(), int64(buf.Len())
}

// writeZipWithSymlink creates a zip that has a single entry with the symlink
// mode bit set.
func writeZipWithSymlink(t *testing.T, name string) (string, int64) {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	h := &zip.FileHeader{Name: name, Method: zip.Deflate}
	h.SetMode(os.ModeSymlink | 0o777)
	w, err := zw.CreateHeader(h)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.Write([]byte("/etc/passwd")); err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	f, err := os.CreateTemp(t.TempDir(), "*.zip")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.Write(buf.Bytes()); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	return f.Name(), int64(buf.Len())
}

// buildZipWithFakeDeclaredSize creates a valid zip containing realData under
// name, then patches the central directory's uncompressed-size field to
// fakeSize so that the pre-flight declared-total check sees a small number
// while the actual bytes written exceed it.
func buildZipWithFakeDeclaredSize(t *testing.T, name string, realData []byte, fakeSize uint32) (string, int64) {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, err := zw.Create(name)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.Write(realData); err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	raw := buf.Bytes()

	// Central directory entry signature: PK\x01\x02 (LE 0x02014b50).
	// Uncompressed size sits at offset 24 from the signature start.
	cdSig := []byte{0x50, 0x4b, 0x01, 0x02}
	idx := bytes.Index(raw, cdSig)
	if idx < 0 {
		t.Fatal("central directory signature not found in zip bytes")
	}
	binary.LittleEndian.PutUint32(raw[idx+24:], fakeSize)

	f, err := os.CreateTemp(t.TempDir(), "*.zip")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.Write(raw); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	return f.Name(), int64(len(raw))
}

// ---- cleanEntryName -------------------------------------------------------

func TestCleanEntryName(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
		errFrag string
	}{
		{name: "normal file", input: "foo/bar.txt", want: "foo/bar.txt"},
		{name: "trailing slash stripped", input: "foo/", want: "foo"},
		{name: "dot only", input: ".", want: "."},
		{name: "empty", input: "", want: "."},
		{name: "dot-slash normalized", input: "./", want: "."},
		{name: "absolute path", input: "/etc/passwd", wantErr: true, errFrag: "zip-slip"},
		{name: "double-dot", input: "..", wantErr: true, errFrag: "zip-slip"},
		{name: "dotdot prefix", input: "../etc/passwd", wantErr: true, errFrag: "zip-slip"},
		{name: "interior dotdot", input: "a/../../b", wantErr: true, errFrag: "zip-slip"},
		{name: "backslash converted to slash", input: `foo\bar.txt`, want: "foo/bar.txt"},
		// C:\... on Linux becomes "C:/..." which is a safe relative path (no absolute root)
		// so it is NOT rejected. Only genuine Unix absolute paths (leading /) are caught.
		{name: "NUL byte rejected", input: "foo\x00bar", wantErr: true, errFrag: "NUL"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := cleanEntryName(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error for %q, got %q", tc.input, got)
				}
				if tc.errFrag != "" && !strings.Contains(err.Error(), tc.errFrag) {
					t.Fatalf("expected error containing %q, got: %v", tc.errFrag, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error for %q: %v", tc.input, err)
			}
			if got != tc.want {
				t.Errorf("cleanEntryName(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}

// ---- resolveStrip ---------------------------------------------------------

func ptrInt(v int) *int { return &v }

func TestResolveStrip(t *testing.T) {
	tests := []struct {
		name  string
		strip *int
		names []string
		want  int
	}{
		{
			name:  "explicit strip=0 forces off even with shared root",
			strip: ptrInt(0),
			names: []string{"root/a.txt", "root/b.txt"},
			want:  0,
		},
		{
			name:  "explicit strip=2",
			strip: ptrInt(2),
			names: []string{"a/b/c.txt"},
			want:  2,
		},
		{
			name:  "single shared root auto-stripped",
			strip: nil,
			names: []string{"root/a.txt", "root/b.txt", "root/sub/c.txt"},
			want:  1,
		},
		{
			name:  "mixed roots disable auto-strip",
			strip: nil,
			names: []string{"root1/a.txt", "root2/b.txt"},
			want:  0,
		},
		{
			name:  "bare top-level file disables auto-strip",
			strip: nil,
			names: []string{"README.md", "root/a.txt"},
			want:  0,
		},
		{
			name:  "only dot entries produce no strip",
			strip: nil,
			names: []string{"."},
			want:  0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s := newExtractSyncer(config.Limits{}.Effective(), tc.strip)
			got := s.resolveStrip(tc.names)
			if got != tc.want {
				t.Errorf("resolveStrip(%v) = %d, want %d", tc.names, got, tc.want)
			}
		})
	}
}

// ---- extract limits -------------------------------------------------------

func defaultExtractLimits() config.Limits { return config.Limits{}.Effective() }

func TestExtractMaxEntries(t *testing.T) {
	s := newExtractSyncer(config.Limits{
		MaxEntries:          2,
		MaxUncompressedSize: config.DefaultMaxUncompressedSize,
		MaxCompressionRatio: config.DefaultMaxCompressionRatio,
		MaxArchiveSize:      config.DefaultMaxArchiveSize,
	}.Effective(), nil)

	path, size := writeZipEntries(t, map[string][]byte{
		"a.txt": []byte("a"),
		"b.txt": []byte("b"),
		"c.txt": []byte("c"),
	})

	err := s.extract(path, size, t.TempDir())
	if err == nil {
		t.Fatal("expected error for max_entries exceeded, got nil")
	}
	if !strings.Contains(err.Error(), "max_entries") {
		t.Fatalf("expected max_entries error, got: %v", err)
	}
}

func TestExtractMaxUncompressedSize(t *testing.T) {
	const limit = 10
	s := newExtractSyncer(config.Limits{
		MaxEntries:          config.DefaultMaxEntries,
		MaxUncompressedSize: limit,
		MaxCompressionRatio: config.DefaultMaxCompressionRatio,
		MaxArchiveSize:      config.DefaultMaxArchiveSize,
	}.Effective(), nil)

	path, size := writeZipEntries(t, map[string][]byte{
		"big.txt": bytes.Repeat([]byte("x"), limit+1),
	})

	err := s.extract(path, size, t.TempDir())
	if err == nil {
		t.Fatal("expected error for max_uncompressed_size exceeded, got nil")
	}
	if !strings.Contains(err.Error(), "max_uncompressed_size") {
		t.Fatalf("expected max_uncompressed_size error, got: %v", err)
	}
}

func TestExtractCompressionRatioLimit(t *testing.T) {
	// Build a zip with highly-compressible content so the ratio far exceeds 1.
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, err := zw.Create("zeros.bin")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.Write(bytes.Repeat([]byte{0}, 8192)); err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	raw := buf.Bytes()
	f, err := os.CreateTemp(t.TempDir(), "*.zip")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.Write(raw); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}

	s := newExtractSyncer(config.Limits{
		MaxEntries:          config.DefaultMaxEntries,
		MaxUncompressedSize: config.DefaultMaxUncompressedSize,
		MaxCompressionRatio: 1, // trigger: actual ratio >> 1
		MaxArchiveSize:      config.DefaultMaxArchiveSize,
	}.Effective(), nil)

	err = s.extract(f.Name(), int64(len(raw)), t.TempDir())
	if err == nil {
		t.Fatal("expected error for max_compression_ratio exceeded, got nil")
	}
	if !strings.Contains(err.Error(), "max_compression_ratio") {
		t.Fatalf("expected max_compression_ratio error, got: %v", err)
	}
}

func TestExtractSymlinkRejected(t *testing.T) {
	s := newExtractSyncer(defaultExtractLimits(), nil)

	path, size := writeZipWithSymlink(t, "link.txt")
	err := s.extract(path, size, t.TempDir())
	if err == nil {
		t.Fatal("expected error for symlink entry, got nil")
	}
	if !strings.Contains(err.Error(), "symlink") {
		t.Fatalf("expected symlink error, got: %v", err)
	}
}

func TestExtractOK(t *testing.T) {
	s := newExtractSyncer(defaultExtractLimits(), nil)

	dest := t.TempDir()
	// root/ is the shared prefix and will be auto-stripped.
	path, size := writeZipEntries(t, map[string][]byte{
		"root/index.html":   []byte("<html/>"),
		"root/css/main.css": []byte("body{}"),
	})

	if err := s.extract(path, size, dest); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	wantFile := filepath.Join(dest, "index.html")
	if _, err := os.Stat(wantFile); err != nil {
		t.Errorf("expected %s to exist after extraction: %v", wantFile, err)
	}
}

// TestExtractRejectsSizeTamperedArchive verifies the security property the
// uncompressed-size guards exist to enforce: an archive that lies about its
// uncompressed size — declaring a tiny size in the central directory to slip
// past the declared-total pre-flight while actually holding far more bytes —
// cannot smuggle oversized content into staging.
//
// In practice the stdlib zip reader detects the size/CRC mismatch on read and
// fails the copy (so the extract.go belt-and-braces cap is an unreachable
// backstop, not the active defence here); either way extraction must error and
// no oversized file may land in staging.
func TestExtractRejectsSizeTamperedArchive(t *testing.T) {
	const maxUncomp = 10
	const fakeSize = 5   // claimed in central directory — passes pre-flight
	const realSize = 100 // actual decompressed bytes — exceeds cap

	dest := t.TempDir()
	path, size := buildZipWithFakeDeclaredSize(t, "evil.bin",
		bytes.Repeat([]byte("X"), realSize), fakeSize)

	s := newExtractSyncer(config.Limits{
		MaxEntries:          config.DefaultMaxEntries,
		MaxUncompressedSize: maxUncomp,
		MaxCompressionRatio: config.DefaultMaxCompressionRatio,
		MaxArchiveSize:      config.DefaultMaxArchiveSize,
	}.Effective(), nil)

	err := s.extract(path, size, dest)
	if err == nil {
		t.Fatal("expected size-tampered archive to be rejected, got nil")
	}
	// Whatever the failure mode, no oversized content may have been committed.
	if fi, statErr := os.Stat(filepath.Join(dest, "evil.bin")); statErr == nil && fi.Size() > maxUncomp {
		t.Fatalf("oversized file written despite rejection: %d bytes", fi.Size())
	}
}
