package deploy

import (
	"log/slog"
	"os"
	"path/filepath"
	"testing"
)

func TestCurrentExists(t *testing.T) {
	dep := New(t.TempDir(), 3, slog.Default())

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
