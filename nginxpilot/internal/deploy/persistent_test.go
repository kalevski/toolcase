package deploy

import (
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"
)

func newTestDeployer(t *testing.T) *Deployer {
	t.Helper()
	return New(t.TempDir(), slog.New(slog.NewTextHandler(io.Discard, nil)))
}

// stage builds a staging directory with the given relative files.
func stage(t *testing.T, d *Deployer, domain string, files map[string]string) string {
	t.Helper()
	dir, err := d.NewStaging(domain)
	if err != nil {
		t.Fatalf("staging: %v", err)
	}
	for rel, body := range files {
		full := filepath.Join(dir, rel)
		if err := os.MkdirAll(filepath.Dir(full), 0o750); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(body), 0o640); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

// TestPersistentSurvivesRedeploy is the claim the whole feature rests on: an
// upload written by the running application is still there after the code is
// redeployed twice and old releases are pruned.
func TestPersistentSurvivesRedeploy(t *testing.T) {
	d := newTestDeployer(t)
	const domain = "shop.example.com"
	paths := []string{"wp-content/uploads"}

	// Deploy 1 — repo ships nothing at the persistent path.
	s1 := stage(t, d, domain, map[string]string{"index.php": "<?php echo 1;"})
	if _, err := d.LinkPersistent(domain, s1, paths); err != nil {
		t.Fatalf("link 1: %v", err)
	}
	if _, err := d.PromoteIn(KindApps, domain, "aaa1111", s1, 2); err != nil {
		t.Fatalf("promote 1: %v", err)
	}

	// The application writes an upload through the symlink.
	upload := filepath.Join(d.AppCurrentPath(domain), "wp-content/uploads/photo.jpg")
	if err := os.WriteFile(upload, []byte("jpegdata"), 0o640); err != nil {
		t.Fatalf("write upload: %v", err)
	}

	// Deploy 2 and 3 — new code, same declared persistent path.
	for i, ref := range []string{"bbb2222", "ccc3333"} {
		s := stage(t, d, domain, map[string]string{"index.php": "<?php echo 2;"})
		if _, err := d.LinkPersistent(domain, s, paths); err != nil {
			t.Fatalf("link %d: %v", i+2, err)
		}
		if _, err := d.PromoteIn(KindApps, domain, ref, s, 1); err != nil {
			t.Fatalf("promote %d: %v", i+2, err)
		}
	}

	// The upload is still readable through the CURRENT release.
	got, err := os.ReadFile(upload)
	if err != nil {
		t.Fatalf("upload lost after redeploy: %v", err)
	}
	if string(got) != "jpegdata" {
		t.Fatalf("upload corrupted: %q", got)
	}

	// And it physically lives outside every release.
	real := filepath.Join(d.PersistentDir(domain), "wp-content/uploads/photo.jpg")
	if _, err := os.Stat(real); err != nil {
		t.Fatalf("upload not in persistent tree: %v", err)
	}

	// Pruning to keep=1 must not have taken the data with it.
	releases, err := os.ReadDir(filepath.Join(d.AppDir(domain), "releases"))
	if err != nil {
		t.Fatal(err)
	}
	if len(releases) != 1 {
		t.Fatalf("expected 1 release after prune, got %d", len(releases))
	}
}

// TestPersistentSeedsOnFirstDeployOnly covers the asymmetry the proposal flags
// as bug-report-shaped: repo content seeds an empty persistent dir, and is
// reported as skipped on every deploy after that.
func TestPersistentSeedsOnFirstDeployOnly(t *testing.T) {
	d := newTestDeployer(t)
	const domain = "seed.example.com"
	paths := []string{"wp-content/uploads"}

	s1 := stage(t, d, domain, map[string]string{
		"index.php":                      "<?php",
		"wp-content/uploads/default.png": "theme-default",
	})
	res, err := d.LinkPersistent(domain, s1, paths)
	if err != nil {
		t.Fatalf("link 1: %v", err)
	}
	if len(res.Seeded) != 1 || res.Seeded[0] != "wp-content/uploads" {
		t.Fatalf("expected a seed on first deploy, got %+v", res)
	}
	if _, err := d.PromoteIn(KindApps, domain, "r1", s1, 3); err != nil {
		t.Fatal(err)
	}
	seeded := filepath.Join(d.PersistentDir(domain), "wp-content/uploads/default.png")
	if body, err := os.ReadFile(seeded); err != nil || string(body) != "theme-default" {
		t.Fatalf("seed did not land: %v %q", err, body)
	}

	// Second deploy ships the same file again — persistent already exists, so it
	// must be reported as skipped rather than silently dropped.
	s2 := stage(t, d, domain, map[string]string{
		"index.php":                      "<?php",
		"wp-content/uploads/default.png": "theme-default-v2",
	})
	res2, err := d.LinkPersistent(domain, s2, paths)
	if err != nil {
		t.Fatalf("link 2: %v", err)
	}
	if len(res2.Seeded) != 0 {
		t.Fatalf("second deploy must not seed, got %+v", res2.Seeded)
	}
	if res2.SkippedFiles["wp-content/uploads"] != 1 {
		t.Fatalf("expected 1 skipped repo file, got %+v", res2.SkippedFiles)
	}
	if _, err := d.PromoteIn(KindApps, domain, "r2", s2, 3); err != nil {
		t.Fatal(err)
	}
	// The live data won, not the repo's copy.
	if body, _ := os.ReadFile(seeded); string(body) != "theme-default" {
		t.Fatalf("repo content overwrote live data: %q", body)
	}
}

// TestPersistentRejectsEscape is the containment guard. config.CleanRelPath is
// the first gate; this proves the deployer refuses even if it is bypassed.
func TestPersistentRejectsEscape(t *testing.T) {
	d := newTestDeployer(t)
	const domain = "evil.example.com"
	s := stage(t, d, domain, map[string]string{"index.php": "<?php"})

	for _, bad := range []string{"../../etc", "../outside", "/etc/passwd"} {
		if _, err := d.LinkPersistent(domain, s, []string{bad}); err == nil {
			t.Fatalf("persistent %q was accepted; it must be refused", bad)
		}
	}
}

// TestRemoveAppKeepsData covers the "deleting an app must ask about persistent"
// rule: releases go, the user's data stays until they say otherwise.
func TestRemoveAppKeepsData(t *testing.T) {
	d := newTestDeployer(t)
	const domain = "keep.example.com"
	paths := []string{"storage"}

	s := stage(t, d, domain, map[string]string{"index.php": "<?php"})
	if _, err := d.LinkPersistent(domain, s, paths); err != nil {
		t.Fatal(err)
	}
	if _, err := d.PromoteIn(KindApps, domain, "r1", s, 2); err != nil {
		t.Fatal(err)
	}
	data := filepath.Join(d.PersistentDir(domain), "keepme.txt")
	if err := os.WriteFile(data, []byte("user data"), 0o640); err != nil {
		t.Fatal(err)
	}

	if err := d.RemoveApp(domain, false); err != nil {
		t.Fatalf("remove: %v", err)
	}
	if _, err := os.Stat(data); err != nil {
		t.Fatalf("persistent data was destroyed by a code-only removal: %v", err)
	}
	if _, err := os.Stat(filepath.Join(d.AppDir(domain), "releases")); !os.IsNotExist(err) {
		t.Fatalf("releases should be gone, got %v", err)
	}

	if err := d.RemoveApp(domain, true); err != nil {
		t.Fatalf("remove with data: %v", err)
	}
	if _, err := os.Stat(d.AppDir(domain)); !os.IsNotExist(err) {
		t.Fatalf("app dir should be gone")
	}
}

// TestPersistentSizeCountsData guards the quota-accounting rule.
func TestPersistentSizeCountsData(t *testing.T) {
	d := newTestDeployer(t)
	const domain = "size.example.com"

	if n, err := d.PersistentSize(domain); err != nil || n != 0 {
		t.Fatalf("empty app should measure 0, got %d %v", n, err)
	}

	s := stage(t, d, domain, map[string]string{"index.php": "<?php"})
	if _, err := d.LinkPersistent(domain, s, []string{"uploads"}); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(d.PersistentDir(domain), "uploads", "big.bin"), make([]byte, 4096), 0o640); err != nil {
		t.Fatal(err)
	}
	n, err := d.PersistentSize(domain)
	if err != nil {
		t.Fatal(err)
	}
	if n < 4096 {
		t.Fatalf("persistent size %d did not count the upload", n)
	}
}
