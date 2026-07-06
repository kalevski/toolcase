// Package gitcreds is the runtime credential store for private git sources.
// A control plane saves a repo token over the admin API
// (PUT /git-credentials/{name}); nginxpilot persists it as a daemon-owned
// 0600 artifact under data_dir/git-credentials/ and a site fragment references
// it via auth.token_file. This keeps the "no inline secrets in config" rule —
// the fragment carries only the path; the token lives in a 0600 file the
// daemon resolves at fetch time (so a rotated token takes effect on the next
// sync, no reload needed).
package gitcreds

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

// fileSuffix is the on-disk extension for a stored token.
const fileSuffix = ".token"

// nameRe restricts a credential name to a filename-safe charset (no leading
// dot/dash), guarding the on-disk path against traversal tricks.
var nameRe = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)

// ValidName reports whether name is an acceptable credential identifier.
func ValidName(name string) bool { return nameRe.MatchString(name) }

// Info is one stored credential's metadata for GET /git-credentials. Secret
// material is never included.
type Info struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	ModTime time.Time `json:"mod_time"`
}

// Store persists per-name token artifacts under dir.
type Store struct {
	dir string
}

// New builds a store rooted at dir (created lazily on first Set).
func New(dir string) *Store { return &Store{dir: dir} }

// Path is the on-disk location a stored credential lives (or would live) at —
// the value a site fragment's auth.token_file references.
func (s *Store) Path(name string) string {
	return filepath.Join(s.dir, name+fileSuffix)
}

// Set writes (or replaces) a credential atomically as a 0600, daemon-owned
// file and returns its path.
func (s *Store) Set(name, token string) (string, error) {
	if !ValidName(name) {
		return "", fmt.Errorf("invalid credential name %q (must match [A-Za-z0-9][A-Za-z0-9._-]*)", name)
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return "", fmt.Errorf("token must not be empty")
	}
	if err := os.MkdirAll(s.dir, 0o700); err != nil {
		return "", fmt.Errorf("create git-credentials dir: %w", err)
	}
	path := s.Path(name)
	if err := writeFileAtomic0600(path, []byte(token+"\n")); err != nil {
		return "", err
	}
	return path, nil
}

// Has reports whether a credential is stored under name.
func (s *Store) Has(name string) bool {
	if !ValidName(name) {
		return false
	}
	fi, err := os.Stat(s.Path(name))
	return err == nil && fi.Mode().IsRegular()
}

// Delete removes a stored credential. Returns os.ErrNotExist when absent.
func (s *Store) Delete(name string) error {
	if !ValidName(name) {
		return fmt.Errorf("invalid credential name %q", name)
	}
	return os.Remove(s.Path(name))
}

// List enumerates stored credentials (sorted) with metadata only — never the
// token material. The nil/empty store yields an empty, non-nil slice.
func (s *Store) List() []Info {
	out := []Info{}
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return out
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), fileSuffix) {
			continue
		}
		name := strings.TrimSuffix(e.Name(), fileSuffix)
		mt := time.Time{}
		if fi, err := e.Info(); err == nil {
			mt = fi.ModTime()
		}
		out = append(out, Info{Name: name, Path: s.Path(name), ModTime: mt})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// writeFileAtomic0600 writes data crash-durably with 0600 perms: temp file in
// the same dir, fsync, rename, fsync dir (mirrors credstore's helper).
func writeFileAtomic0600(path string, data []byte) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".token-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Chmod(0o600); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpName, path); err != nil {
		return err
	}
	if d, err := os.Open(dir); err == nil {
		_ = d.Sync()
		_ = d.Close()
	}
	return nil
}
