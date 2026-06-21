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
