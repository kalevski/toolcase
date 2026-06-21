// Package deploy implements the atomic release model (spec §4.3):
//
//	sites/<domain>/
//	├── releases/<timestamp>-<ref>/   immutable deploys
//	└── current -> releases/...       atomic symlink
//
// Content is staged under data_dir/tmp, fully written + fsynced, renamed
// into releases/ (same filesystem) and then made live by an atomic
// rename(2) of a temporary symlink. A failure anywhere before the final
// rename leaves `current` untouched.
package deploy

import (
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// alwaysExclude is stripped unconditionally — serving repo metadata is
// never intended (spec §4.4).
var alwaysExclude = []string{".git", ".git*"}

// DefaultExcludes is the overridable default deny-list.
var DefaultExcludes = []string{".env*", ".htaccess", ".DS_Store"}

// Deployer manages the sites/ tree under data_dir.
type Deployer struct {
	dataDir      string
	keepReleases int
	log          *slog.Logger
}

// New returns a Deployer rooted at dataDir.
func New(dataDir string, keepReleases int, log *slog.Logger) *Deployer {
	return &Deployer{dataDir: dataDir, keepReleases: keepReleases, log: log}
}

// SiteDir returns sites/<domain> under data_dir.
func (d *Deployer) SiteDir(domain string) string {
	return filepath.Join(d.dataDir, "sites", domain)
}

// CurrentPath returns the path of the `current` symlink for a domain.
func (d *Deployer) CurrentPath(domain string) string {
	return filepath.Join(d.SiteDir(domain), "current")
}

// CurrentExists reports whether <site>/current resolves to a real directory.
func (d *Deployer) CurrentExists(domain string) bool {
	fi, err := os.Stat(d.CurrentPath(domain)) // follows the symlink
	return err == nil && fi.IsDir()
}

// TmpDir returns the shared staging/download area under data_dir.
func (d *Deployer) TmpDir() string {
	return filepath.Join(d.dataDir, "tmp")
}

// NewStaging creates an empty staging directory for a sync attempt.
func (d *Deployer) NewStaging(domain string) (string, error) {
	if err := os.MkdirAll(d.TmpDir(), 0o750); err != nil {
		return "", err
	}
	return os.MkdirTemp(d.TmpDir(), "staging-"+domain+"-")
}

// ApplyExcludes removes entries matching the deny-list anywhere in the
// staged tree, before the swap — a release dir never contains excluded
// files (spec §4.4). Site patterns extend the defaults; .git* is always on.
func ApplyExcludes(stagingDir string, sitePatterns []string) (removed []string, err error) {
	patterns := make([]string, 0, len(alwaysExclude)+len(DefaultExcludes)+len(sitePatterns))
	patterns = append(patterns, alwaysExclude...)
	patterns = append(patterns, DefaultExcludes...)
	patterns = append(patterns, sitePatterns...)

	err = filepath.WalkDir(stagingDir, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if path == stagingDir {
			return nil
		}
		name := entry.Name()
		for _, pat := range patterns {
			ok, matchErr := filepath.Match(pat, name)
			if matchErr != nil {
				return fmt.Errorf("exclude pattern %q: %w", pat, matchErr)
			}
			if !ok {
				continue
			}
			rel, _ := filepath.Rel(stagingDir, path)
			removed = append(removed, rel)
			if rmErr := os.RemoveAll(path); rmErr != nil {
				return rmErr
			}
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		return nil
	})
	return removed, err
}

// CountRegularFiles reports how many regular files the staged tree holds
// (the default non-empty sanity gate, spec §4.1).
func CountRegularFiles(dir string) (int, error) {
	count := 0
	err := filepath.WalkDir(dir, func(_ string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.Type().IsRegular() {
			count++
		}
		return nil
	})
	return count, err
}

// Promote turns a fully staged directory into the live release:
// normalize perms, fsync, rename into releases/, swap the symlink, prune.
// ref should be a short content identifier (git SHA / hash prefix).
func (d *Deployer) Promote(domain, ref, stagingDir string) (string, error) {
	releasesDir := filepath.Join(d.SiteDir(domain), "releases")
	if err := os.MkdirAll(releasesDir, 0o750); err != nil {
		return "", err
	}

	// 1. Normalize permissions (dirs 0750, files 0640 — nginx reads via
	//    group, spec §6) and fsync every file + dir.
	if err := normalizeAndSync(stagingDir); err != nil {
		return "", fmt.Errorf("fsync staging: %w", err)
	}

	releaseName := time.Now().UTC().Format("20060102T150405") + "-" + sanitizeRef(ref)
	releasePath := filepath.Join(releasesDir, releaseName)

	// 2. Move the complete staging dir into releases/ (same filesystem —
	//    both live under data_dir).
	if err := os.Rename(stagingDir, releasePath); err != nil {
		return "", fmt.Errorf("move staging into releases: %w", err)
	}
	if err := syncDir(releasesDir); err != nil {
		return "", err
	}

	// 3. Atomic swap: temp symlink + rename(2). Open handles nginx holds on
	//    old content stay valid; new requests resolve the new target.
	tmpLink := filepath.Join(d.SiteDir(domain), "current.tmp")
	_ = os.Remove(tmpLink)
	if err := os.Symlink(filepath.Join("releases", releaseName), tmpLink); err != nil {
		return "", fmt.Errorf("create temp symlink: %w", err)
	}
	if err := os.Rename(tmpLink, d.CurrentPath(domain)); err != nil {
		_ = os.Remove(tmpLink)
		return "", fmt.Errorf("swap current symlink: %w", err)
	}
	if err := syncDir(d.SiteDir(domain)); err != nil {
		return "", err
	}

	// 4. Prune old releases.
	if err := d.Prune(domain); err != nil {
		d.log.Warn("prune failed", "domain", domain, "error", err)
	}
	return releasePath, nil
}

// Prune deletes releases beyond keepReleases, oldest first, never deleting
// the target of `current`.
func (d *Deployer) Prune(domain string) error {
	releasesDir := filepath.Join(d.SiteDir(domain), "releases")
	entries, err := os.ReadDir(releasesDir)
	if err != nil {
		return err
	}
	currentTarget := ""
	if t, err := os.Readlink(d.CurrentPath(domain)); err == nil {
		currentTarget = filepath.Base(t)
	}
	var names []string
	for _, e := range entries {
		if e.IsDir() {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names) // timestamp prefix => lexical == chronological
	excess := len(names) - d.keepReleases
	for _, name := range names {
		if excess <= 0 {
			break
		}
		if name == currentTarget {
			continue
		}
		if err := os.RemoveAll(filepath.Join(releasesDir, name)); err != nil {
			return err
		}
		d.log.Debug("pruned release", "domain", domain, "release", name)
		excess--
	}
	return nil
}

// Orphans lists site directories on disk that no configured domain claims.
func (d *Deployer) Orphans(configured map[string]bool) ([]string, error) {
	sitesDir := filepath.Join(d.dataDir, "sites")
	entries, err := os.ReadDir(sitesDir)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var orphans []string
	for _, e := range entries {
		if e.IsDir() && !configured[e.Name()] {
			orphans = append(orphans, e.Name())
		}
	}
	return orphans, nil
}

// RemoveSite deletes a site's content tree (used by --prune-orphans).
func (d *Deployer) RemoveSite(domain string) error {
	return os.RemoveAll(d.SiteDir(domain))
}

func sanitizeRef(ref string) string {
	ref = strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '-', r == '.':
			return r
		default:
			return '-'
		}
	}, ref)
	if len(ref) > 12 {
		ref = ref[:12]
	}
	if ref == "" {
		ref = "unknown"
	}
	return ref
}

// normalizeAndSync chmods dirs to 0750 / files to 0640 and fsyncs the tree.
func normalizeAndSync(root string) error {
	return filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			if err := os.Chmod(path, 0o750); err != nil {
				return err
			}
			return syncDir(path)
		}
		if !entry.Type().IsRegular() {
			return nil
		}
		if err := os.Chmod(path, 0o640); err != nil {
			return err
		}
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		err = f.Sync()
		closeErr := f.Close()
		if err != nil {
			return err
		}
		return closeErr
	})
}

func syncDir(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	err = f.Sync()
	closeErr := f.Close()
	if err != nil {
		return err
	}
	return closeErr
}
