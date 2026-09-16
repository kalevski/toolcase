package deploy

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// KindSites and KindApps are the two content trees under data_dir. Sites hold
// files nginx serves; apps hold code php-fpm executes. They are separate roots
// so a domain can never be both, and so `apps/<domain>/persistent` has an
// obvious home beside the releases it outlives.
const (
	KindSites = "sites"
	KindApps  = "apps"
)

// PersistentDirName is re-exported from config so callers of the deployer do
// not need both imports; config owns the definition.
const PersistentDirName = config.PersistentDirName

// PersistentResult reports what LinkPersistent did, so the caller can log the
// seed-vs-skip distinction rather than silently discarding repo content.
type PersistentResult struct {
	// Linked is every declared path that now resolves out of the release.
	Linked []string
	// Seeded is the paths whose repo content was copied into an empty
	// persistent directory on a first deploy.
	Seeded []string
	// SkippedFiles counts repo files that were NOT copied because the
	// persistent directory already existed — the second-deploy-onwards case.
	SkippedFiles map[string]int
}

// Root returns data_dir/<kind>/<domain>.
func (d *Deployer) Root(kind, domain string) string {
	return filepath.Join(d.dataDir, kind, domain)
}

// AppDir returns apps/<domain> under data_dir.
func (d *Deployer) AppDir(domain string) string { return d.Root(KindApps, domain) }

// PersistentDir returns apps/<domain>/persistent — the tree that outlives
// releases and is the only thing an app may write to.
func (d *Deployer) PersistentDir(domain string) string {
	return filepath.Join(d.AppDir(domain), PersistentDirName)
}

// AppCurrentPath returns apps/<domain>/current.
func (d *Deployer) AppCurrentPath(domain string) string {
	return filepath.Join(d.AppDir(domain), "current")
}

// AppCurrentExists reports whether apps/<domain>/current resolves to a dir.
func (d *Deployer) AppCurrentExists(domain string) bool {
	return d.CurrentExistsIn(KindApps, domain)
}

// CurrentExistsIn reports whether <kind>/<domain>/current resolves to a real
// directory.
func (d *Deployer) CurrentExistsIn(kind, domain string) bool {
	fi, err := os.Stat(filepath.Join(d.Root(kind, domain), "current"))
	return err == nil && fi.IsDir()
}

// LinkPersistent replaces each declared path inside the staged release with a
// symlink to apps/<domain>/persistent/<path>, so an application that writes to
// its own document root keeps that data across deploys.
//
// The links are ABSOLUTE. A relative link would have to be computed against the
// release's final location, which Promote only picks after this runs; absolute
// links are correct in staging and unchanged by the rename into releases/. They
// share the constraint the generated nginx config already has — data_dir is not
// movable without regenerating — so this introduces no new fragility.
//
// First deploy seeds: when the persistent target does not exist yet, whatever
// the repo shipped at that path is MOVED into it, so a theme carrying default
// uploads works. Every later deploy leaves persistent alone and reports how many
// repo files it ignored, because silently discarding repo content is the
// behaviour people file bugs about.
//
// Callers must have validated the paths with config.CleanRelPath first; this
// re-checks containment anyway, because the consequence of getting it wrong is
// writing a symlink at an arbitrary filesystem location.
func (d *Deployer) LinkPersistent(domain, stagingDir string, paths []string) (PersistentResult, error) {
	result := PersistentResult{SkippedFiles: map[string]int{}}
	if len(paths) == 0 {
		return result, nil
	}

	persistentRoot := d.PersistentDir(domain)
	if err := os.MkdirAll(persistentRoot, 0o750); err != nil {
		return result, fmt.Errorf("create persistent root: %w", err)
	}

	stagingAbs, err := filepath.Abs(stagingDir)
	if err != nil {
		return result, err
	}

	for _, rel := range paths {
		// filepath.Join treats an absolute second argument as relative, so
		// Join(root, "/etc/passwd") yields root/etc/passwd and a containment
		// check on the result passes. The lexical guard has to come first, or
		// this defence-in-depth layer silently agrees with anything.
		if err := checkRelPath(rel); err != nil {
			return result, err
		}
		staged := filepath.Join(stagingAbs, rel)
		if !withinRoot(stagingAbs, staged) {
			return result, fmt.Errorf("persistent %q escapes the release root", rel)
		}
		target := filepath.Join(persistentRoot, rel)
		if !withinRoot(persistentRoot, target) {
			return result, fmt.Errorf("persistent %q escapes the persistent root", rel)
		}

		targetExists, err := pathExists(target)
		if err != nil {
			return result, err
		}

		if err := os.MkdirAll(filepath.Dir(target), 0o750); err != nil {
			return result, fmt.Errorf("create persistent parent for %q: %w", rel, err)
		}

		stagedInfo, stagedErr := os.Lstat(staged)
		stagedPresent := stagedErr == nil
		if stagedErr != nil && !errors.Is(stagedErr, fs.ErrNotExist) {
			return result, stagedErr
		}

		switch {
		case !targetExists && stagedPresent:
			// First deploy with repo content at this path: seed it. A rename is
			// the cheap path; it fails with EXDEV if data_dir spans devices, so
			// fall back to a copy rather than losing the seed.
			if err := os.Rename(staged, target); err != nil {
				if !errors.Is(err, syscall.EXDEV) {
					return result, fmt.Errorf("seed persistent %q: %w", rel, err)
				}
				if stagedInfo.IsDir() {
					if err := copyTree(staged, target); err != nil {
						return result, fmt.Errorf("seed persistent %q: %w", rel, err)
					}
				} else if err := copyFile(staged, target); err != nil {
					return result, fmt.Errorf("seed persistent %q: %w", rel, err)
				}
			}
			result.Seeded = append(result.Seeded, rel)
		case !targetExists:
			// First deploy, repo shipped nothing: create an empty directory.
			if err := os.MkdirAll(target, 0o750); err != nil {
				return result, fmt.Errorf("create persistent %q: %w", rel, err)
			}
		case stagedPresent:
			// Persistent already holds the live data — the repo's copy is
			// discarded. Count what we are dropping so the sync log can say so.
			if stagedInfo.IsDir() {
				n, err := CountRegularFiles(staged)
				if err != nil {
					return result, err
				}
				if n > 0 {
					result.SkippedFiles[rel] = n
				}
			} else {
				result.SkippedFiles[rel] = 1
			}
			if err := os.RemoveAll(staged); err != nil {
				return result, fmt.Errorf("clear release path %q: %w", rel, err)
			}
		}

		// The staged entry is gone in every branch above; link it to persistent.
		if err := os.MkdirAll(filepath.Dir(staged), 0o750); err != nil {
			return result, fmt.Errorf("create release parent for %q: %w", rel, err)
		}
		_ = os.RemoveAll(staged)
		if err := os.Symlink(target, staged); err != nil {
			return result, fmt.Errorf("link persistent %q: %w", rel, err)
		}
		result.Linked = append(result.Linked, rel)
	}

	return result, nil
}

// PersistentSize returns the byte size of the app's persistent tree. Storage
// quotas must count it: an app with 40 GB of uploads and 12 MB of code is a
// 40 GB app, and measuring only the release would report the 12 MB.
func (d *Deployer) PersistentSize(domain string) (int64, error) {
	size, err := DirSize(d.PersistentDir(domain))
	if errors.Is(err, fs.ErrNotExist) {
		return 0, nil
	}
	return size, err
}

// RemoveApp deletes an app's releases and current symlink. It deliberately does
// NOT touch persistent/ unless withData is set: releases are ours to recreate,
// the data directory is the user's.
func (d *Deployer) RemoveApp(domain string, withData bool) error {
	if withData {
		return os.RemoveAll(d.AppDir(domain))
	}
	dir := d.AppDir(domain)
	entries, err := os.ReadDir(dir)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	for _, e := range entries {
		if e.Name() == PersistentDirName {
			continue
		}
		if err := os.RemoveAll(filepath.Join(dir, e.Name())); err != nil {
			return err
		}
	}
	return nil
}

// checkRelPath rejects anything that is not a clean, relative, ..-free path.
// It mirrors config.CleanRelPath so the deployer refuses a bad path even when
// it is reached without going through config validation (the admin API, a test,
// a future caller).
func checkRelPath(p string) error {
	if p == "" {
		return fmt.Errorf("persistent: empty path")
	}
	if filepath.IsAbs(p) || strings.HasPrefix(p, "/") {
		return fmt.Errorf("persistent %q: must be relative to the release root", p)
	}
	cleaned := filepath.Clean(p)
	if cleaned == "." || cleaned == ".." ||
		strings.HasPrefix(cleaned, ".."+string(filepath.Separator)) ||
		strings.Contains(cleaned, string(filepath.Separator)+".."+string(filepath.Separator)) {
		return fmt.Errorf("persistent %q: must not contain ..", p)
	}
	return nil
}

// withinRoot reports whether p is root or lies beneath it, after symlink-free
// lexical cleaning. It is the last line of defence behind config validation.
func withinRoot(root, p string) bool {
	rel, err := filepath.Rel(root, p)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func pathExists(p string) (bool, error) {
	_, err := os.Lstat(p)
	if err == nil {
		return true, nil
	}
	if errors.Is(err, fs.ErrNotExist) {
		return false, nil
	}
	return false, err
}

// copyTree duplicates src into dst. Used only where a rename cannot be (a
// cross-device seed); kept small and symlink-refusing on purpose.
func copyTree(src, dst string) error {
	return filepath.WalkDir(src, func(p string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		rel, err := filepath.Rel(src, p)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)
		switch {
		case entry.IsDir():
			return os.MkdirAll(target, 0o750)
		case entry.Type()&fs.ModeSymlink != 0:
			return nil
		case !entry.Type().IsRegular():
			return nil
		}
		return copyFile(p, target)
	})
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o640)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}
