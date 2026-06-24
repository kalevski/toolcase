package deploy

import (
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"
)

func TestCurrentExists(t *testing.T) {
	dep := New(t.TempDir(), slog.Default())

	domain := "example.com"
	siteDir := dep.SiteDir(domain)
	if err := os.MkdirAll(siteDir, 0o750); err != nil {
		t.Fatal(err)
	}

	releaseDir := filepath.Join(siteDir, "releases", "20240101T000000-abc")
	if err := os.MkdirAll(releaseDir, 0o750); err != nil {
		t.Fatal(err)
	}

	currentLink := dep.CurrentPath(domain)

	tests := []struct {
		name  string
		setup func()
		want  bool
	}{
		{
			name: "valid symlink pointing at existing release dir",
			setup: func() {
				_ = os.Remove(currentLink)
				if err := os.Symlink(filepath.Join("releases", "20240101T000000-abc"), currentLink); err != nil {
					t.Fatal(err)
				}
			},
			want: true,
		},
		{
			name: "dangling symlink whose target was deleted",
			setup: func() {
				_ = os.Remove(currentLink)
				if err := os.Symlink(filepath.Join("releases", "20240101T000000-gone"), currentLink); err != nil {
					t.Fatal(err)
				}
			},
			want: false,
		},
		{
			name: "current symlink absent entirely",
			setup: func() {
				_ = os.Remove(currentLink)
			},
			want: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			tc.setup()
			got := dep.CurrentExists(domain)
			if got != tc.want {
				t.Errorf("CurrentExists(%q) = %v, want %v", domain, got, tc.want)
			}
		})
	}
}

// TestPrune verifies that Prune honors the per-call keep count: it deletes
// oldest releases first and never removes the one pointed to by `current`.
func TestPrune(t *testing.T) {
	t.Parallel()

	dep := New(t.TempDir(), slog.New(slog.NewTextHandler(io.Discard, nil)))
	domain := "prune.example.com"
	releasesDir := filepath.Join(dep.SiteDir(domain), "releases")
	if err := os.MkdirAll(releasesDir, 0o750); err != nil {
		t.Fatal(err)
	}

	// Create five release directories in chronological order.
	names := []string{
		"20240101T000000-r1",
		"20240102T000000-r2",
		"20240103T000000-r3",
		"20240104T000000-r4",
		"20240105T000000-r5",
	}
	for _, name := range names {
		if err := os.MkdirAll(filepath.Join(releasesDir, name), 0o750); err != nil {
			t.Fatal(err)
		}
	}

	// Point `current` at the newest release.
	currentTarget := names[len(names)-1]
	if err := os.Symlink(filepath.Join("releases", currentTarget), dep.CurrentPath(domain)); err != nil {
		t.Fatal(err)
	}

	// Prune to keep=2: should delete r1, r2, r3 (oldest three) and keep r4, r5.
	if err := dep.Prune(domain, 2); err != nil {
		t.Fatalf("Prune: %v", err)
	}

	wantPresent := map[string]bool{names[3]: true, names[4]: true}
	wantAbsent := map[string]bool{names[0]: true, names[1]: true, names[2]: true}

	entries, err := os.ReadDir(releasesDir)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]bool{}
	for _, e := range entries {
		if e.IsDir() {
			got[e.Name()] = true
		}
	}

	for name := range wantPresent {
		if !got[name] {
			t.Errorf("Prune(keep=2): expected %q to be kept, but it was removed", name)
		}
	}
	for name := range wantAbsent {
		if got[name] {
			t.Errorf("Prune(keep=2): expected %q to be pruned, but it remains", name)
		}
	}

	// The current symlink target must still be present.
	if !got[currentTarget] {
		t.Errorf("Prune removed the current release %q", currentTarget)
	}
}

// TestPromote verifies the full Promote flow:
//   - staging dir is moved into releases/ (not left in place)
//   - `current` symlink points at the new release
//   - content is accessible via `current`
func TestPromote(t *testing.T) {
	t.Parallel()

	dep := New(t.TempDir(), slog.New(slog.NewTextHandler(io.Discard, nil)))
	domain := "promote.example.com"

	// Build a staging directory inside dep.dataDir so os.Rename works (same fs).
	staging, err := dep.NewStaging(domain)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(staging, "index.html"), []byte("<html/>"), 0o640); err != nil {
		t.Fatal(err)
	}

	releasePath, err := dep.Promote(domain, "abc123", staging, 5)
	if err != nil {
		t.Fatalf("Promote: %v", err)
	}

	// The returned release path must exist.
	if _, err := os.Stat(releasePath); err != nil {
		t.Errorf("release path %q does not exist: %v", releasePath, err)
	}

	// `current` must resolve to a real directory.
	if !dep.CurrentExists(domain) {
		t.Error("CurrentExists returned false after successful Promote")
	}

	// The staged file must be accessible via `current`.
	currentIdx := filepath.Join(dep.CurrentPath(domain), "index.html")
	if _, err := os.Stat(currentIdx); err != nil {
		t.Errorf("index.html not reachable through current: %v", err)
	}

	// The original staging directory must have been moved (not copied).
	if _, err := os.Stat(staging); !os.IsNotExist(err) {
		t.Error("staging dir still exists after Promote — it should have been moved")
	}
}

// TestPromotePrunesOldReleases verifies that Promote calls Prune so only
// `keep` releases survive after the swap.
func TestPromotePrunesOldReleases(t *testing.T) {
	t.Parallel()

	dep := New(t.TempDir(), slog.New(slog.NewTextHandler(io.Discard, nil)))
	domain := "prune-via-promote.example.com"

	// Pre-create three releases so Promote's Prune(keep=2) has something to do.
	releasesDir := filepath.Join(dep.SiteDir(domain), "releases")
	if err := os.MkdirAll(releasesDir, 0o750); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"20240101T000000-r1", "20240102T000000-r2", "20240103T000000-r3"} {
		if err := os.MkdirAll(filepath.Join(releasesDir, name), 0o750); err != nil {
			t.Fatal(err)
		}
	}

	staging, err := dep.NewStaging(domain)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(staging, "f.txt"), []byte("hi"), 0o640); err != nil {
		t.Fatal(err)
	}
	if _, err := dep.Promote(domain, "newref", staging, 2); err != nil {
		t.Fatalf("Promote: %v", err)
	}

	entries, err := os.ReadDir(releasesDir)
	if err != nil {
		t.Fatal(err)
	}
	var dirs []string
	for _, e := range entries {
		if e.IsDir() {
			dirs = append(dirs, e.Name())
		}
	}
	if len(dirs) > 2 {
		t.Errorf("expected at most 2 releases after Promote(keep=2), got %d: %v", len(dirs), dirs)
	}
}

// TestApplyExcludes verifies:
//   - .git* is always stripped
//   - DefaultExcludes (.env*, .htaccess, .DS_Store) are stripped
//   - site-specific patterns are stripped
//   - regular files survive
func TestApplyExcludes(t *testing.T) {
	t.Parallel()

	staging := t.TempDir()

	// Create files that should be removed.
	gitDir := filepath.Join(staging, ".git")
	if err := os.MkdirAll(gitDir, 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(gitDir, "HEAD"), []byte("ref: refs/heads/main"), 0o640); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{".gitignore", ".env", ".env.local", ".htaccess", ".DS_Store"} {
		if err := os.WriteFile(filepath.Join(staging, name), []byte("secret"), 0o640); err != nil {
			t.Fatal(err)
		}
	}
	// Site-specific pattern.
	if err := os.WriteFile(filepath.Join(staging, "secrets.txt"), []byte("shh"), 0o640); err != nil {
		t.Fatal(err)
	}

	// Create files that must survive.
	if err := os.WriteFile(filepath.Join(staging, "index.html"), []byte("<html/>"), 0o640); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(staging, "main.css"), []byte("body{}"), 0o640); err != nil {
		t.Fatal(err)
	}

	removed, err := ApplyExcludes(staging, []string{"secrets.txt"})
	if err != nil {
		t.Fatalf("ApplyExcludes: %v", err)
	}

	removedSet := make(map[string]bool, len(removed))
	for _, r := range removed {
		removedSet[r] = true
	}

	// These must be gone.
	mustBeRemoved := []string{".git", ".gitignore", ".env", ".env.local", ".htaccess", ".DS_Store", "secrets.txt"}
	for _, name := range mustBeRemoved {
		if _, err := os.Stat(filepath.Join(staging, name)); !os.IsNotExist(err) {
			t.Errorf("%q should have been excluded but still exists", name)
		}
	}

	// These must survive.
	for _, name := range []string{"index.html", "main.css"} {
		if _, err := os.Stat(filepath.Join(staging, name)); err != nil {
			t.Errorf("%q should survive ApplyExcludes but got: %v", name, err)
		}
	}

	// The removed list must include the git and env items.
	for _, name := range []string{".git", ".gitignore", ".env"} {
		if !removedSet[name] {
			t.Errorf("expected %q in removed list, got: %v", name, removed)
		}
	}
}

// TestApplyExcludesGitAlwaysStripped verifies that .git* items are removed
// even when no site-level exclusions are supplied.
func TestApplyExcludesGitAlwaysStripped(t *testing.T) {
	t.Parallel()

	staging := t.TempDir()
	for _, name := range []string{".git", ".gitmodules", ".github"} {
		p := filepath.Join(staging, name)
		if err := os.MkdirAll(p, 0o750); err != nil {
			t.Fatal(err)
		}
	}
	// One regular file must survive.
	if err := os.WriteFile(filepath.Join(staging, "index.html"), []byte("ok"), 0o640); err != nil {
		t.Fatal(err)
	}

	if _, err := ApplyExcludes(staging, nil); err != nil {
		t.Fatalf("ApplyExcludes: %v", err)
	}

	for _, name := range []string{".git", ".gitmodules", ".github"} {
		if _, err := os.Stat(filepath.Join(staging, name)); !os.IsNotExist(err) {
			t.Errorf("%q must always be stripped but still exists", name)
		}
	}
	if _, err := os.Stat(filepath.Join(staging, "index.html")); err != nil {
		t.Error("index.html must survive ApplyExcludes")
	}
}

// TestPruneNeverDeletesCurrent verifies that Prune with keep=0 still does not
// delete the release that `current` points to.
func TestPruneNeverDeletesCurrent(t *testing.T) {
	t.Parallel()

	dep := New(t.TempDir(), slog.New(slog.NewTextHandler(io.Discard, nil)))
	domain := "guard.example.com"

	releasesDir := filepath.Join(dep.SiteDir(domain), "releases")
	if err := os.MkdirAll(releasesDir, 0o750); err != nil {
		t.Fatal(err)
	}
	relName := "20240101T000000-only"
	if err := os.MkdirAll(filepath.Join(releasesDir, relName), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join("releases", relName), dep.CurrentPath(domain)); err != nil {
		t.Fatal(err)
	}

	// Prune with keep=0 — current must survive.
	if err := dep.Prune(domain, 0); err != nil {
		t.Fatalf("Prune: %v", err)
	}

	if !dep.CurrentExists(domain) {
		t.Error("Prune deleted the live release when keep=0")
	}
}

// TestSanitizeRef verifies edge cases for the internal sanitizeRef helper.
func TestSanitizeRef(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"abc123", "abc123"},
		{"abc/def", "abc-def"},
		{"refs/heads/main", "refs-heads-m"}, // truncated at 12 chars
		{"", "unknown"},
		{"!!!", "---"},
		{"a.b-c", "a.b-c"},
	}
	for _, tc := range tests {
		got := sanitizeRef(tc.input)
		if got != tc.want {
			t.Errorf("sanitizeRef(%q) = %q, want %q", tc.input, got, tc.want)
		}
		if len(got) > 12 {
			t.Errorf("sanitizeRef(%q) = %q: longer than 12 chars", tc.input, got)
		}
		if got == "" {
			t.Errorf("sanitizeRef(%q) must never return empty string", tc.input)
		}
		// Result must only contain allowed chars.
		for _, r := range got {
			if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '.') {
				t.Errorf("sanitizeRef(%q) = %q: contains disallowed char %q", tc.input, got, r)
			}
		}
	}
}

// TestApplyExcludesAllowedPatternDoesNotMatchSubstring ensures that a
// pattern like "secrets.txt" does not accidentally match "secrets.txt.bak"
// or "mysecrets.txt" (filepath.Match is not a substring search).
func TestApplyExcludesPatternIsExact(t *testing.T) {
	t.Parallel()

	staging := t.TempDir()
	for _, name := range []string{"secrets.txt", "secrets.txt.bak", "mysecrets.txt"} {
		if err := os.WriteFile(filepath.Join(staging, name), []byte("x"), 0o640); err != nil {
			t.Fatal(err)
		}
	}

	_, err := ApplyExcludes(staging, []string{"secrets.txt"})
	if err != nil {
		t.Fatalf("ApplyExcludes: %v", err)
	}

	// Only the exact match must be removed.
	if _, err := os.Stat(filepath.Join(staging, "secrets.txt")); !os.IsNotExist(err) {
		t.Error("secrets.txt should have been removed")
	}
	for _, name := range []string{"secrets.txt.bak", "mysecrets.txt"} {
		if _, err := os.Stat(filepath.Join(staging, name)); err != nil {
			t.Errorf("%q should not have been removed: %v", name, err)
		}
	}
}
