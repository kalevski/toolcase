package git

import (
	"testing"
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
