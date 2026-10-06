// Package state persists per-site sync state as flat JSON files
// (data_dir/state/<domain>.json) with atomic temp-file + rename writes.
// Disk-derived state (release dir names encode the ref) is the recovery
// fallback only — this store is the source of truth (spec Q4).
package state

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// SiteState is everything the daemon remembers about one site between ticks.
type SiteState struct {
	Domain string `json:"domain"`

	// SourceFingerprint detects source identity changes (URL/branch/auth):
	// mismatch with the config forces a full resync (spec §6 reload rules).
	SourceFingerprint string `json:"source_fingerprint,omitempty"`

	// DeployedRef is the git SHA or the content hash of the deployed zip.
	DeployedRef string `json:"deployed_ref,omitempty"`

	// DeployedBytes is the total size of the live `current` release directory,
	// measured once per successful deploy and cached here so GET /status can
	// report it without re-walking the tree on every call (task 739).
	DeployedBytes int64 `json:"deployed_bytes,omitempty"`

	// HTTP validators (http-zip sources).
	ETag         string `json:"etag,omitempty"`
	LastModified string `json:"last_modified,omitempty"`

	// ContentHash is the SHA-256 of the last downloaded archive body.
	ContentHash string `json:"content_hash,omitempty"`

	LastSuccess   time.Time `json:"last_success,omitzero"`
	LastError     string    `json:"last_error,omitempty"`
	LastErrorTime time.Time `json:"last_error_time,omitzero"`
	FailureStreak int       `json:"failure_streak"`

	// LastErrorCode classifies LastError when it is a known refusal
	// ("limit_exceeded"); empty for any other failure. LastErrorLimit and
	// LastErrorLimitMax name the source.limits key and its bound.
	LastErrorCode     string `json:"last_error_code,omitempty"`
	LastErrorLimit    string `json:"last_error_limit,omitempty"`
	LastErrorLimitMax int64  `json:"last_error_limit_max,omitempty"`
}

// RecordFailure stores a failed sync's error and its classification.
func (s *SiteState) RecordFailure(err error, code, limit string, limitMax int64) {
	s.FailureStreak++
	s.LastError = err.Error()
	s.LastErrorTime = time.Now().UTC()
	s.LastErrorCode, s.LastErrorLimit, s.LastErrorLimitMax = code, limit, limitMax
}

// ClearFailure resets the error fields after a successful sync.
func (s *SiteState) ClearFailure() {
	s.FailureStreak = 0
	s.LastError = ""
	s.LastErrorTime = time.Time{}
	s.LastErrorCode, s.LastErrorLimit, s.LastErrorLimitMax = "", "", 0
}

// NeverSynced reports whether the site has ever completed a successful sync.
func (s *SiteState) NeverSynced() bool { return s.LastSuccess.IsZero() }

// Store reads and writes per-site state files.
type Store struct {
	dir string

	// cache holds the last parsed state per domain, valid while the file is the
	// same one we read (same inode, mtime and size — atomic renames always yield
	// a new file). GET /status loads every site's state; without this each call
	// re-opened and re-parsed N files. Stat-validated rather than write-through
	// because the CLI (`nginxpilot sync`) writes the same files from another
	// process.
	mu    sync.Mutex
	cache map[string]cachedState
}

type cachedState struct {
	info os.FileInfo
	st   SiteState
}

// NewStore creates the state directory under dataDir if needed.
func NewStore(dataDir string) (*Store, error) {
	dir := filepath.Join(dataDir, "state")
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, fmt.Errorf("create state dir: %w", err)
	}
	return &Store{dir: dir, cache: map[string]cachedState{}}, nil
}

func (s *Store) path(domain string) string {
	return filepath.Join(s.dir, domain+".json")
}

// Load returns the stored state for domain, or a fresh zero state if none
// exists yet.
func (s *Store) Load(domain string) (*SiteState, error) {
	path := s.path(domain)
	fi, err := os.Stat(path)
	if errors.Is(err, fs.ErrNotExist) {
		s.forget(domain)
		return &SiteState{Domain: domain}, nil
	}
	if err == nil {
		s.mu.Lock()
		c, ok := s.cache[domain]
		s.mu.Unlock()
		if ok && os.SameFile(c.info, fi) && c.info.ModTime().Equal(fi.ModTime()) && c.info.Size() == fi.Size() {
			st := c.st // callers mutate and Save the result: hand out a copy
			return &st, nil
		}
	}
	raw, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		s.forget(domain)
		return &SiteState{Domain: domain}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("load state for %s: %w", domain, err)
	}
	var st SiteState
	if err := json.Unmarshal(raw, &st); err != nil {
		// Corrupt state file: start over rather than refusing to run; the
		// next sync re-deploys and rewrites it.
		s.forget(domain)
		return &SiteState{Domain: domain}, nil
	}
	st.Domain = domain
	if fi != nil && int64(len(raw)) == fi.Size() { // the stat describes the bytes we parsed
		s.mu.Lock()
		s.cache[domain] = cachedState{info: fi, st: st}
		s.mu.Unlock()
	}
	return &st, nil
}

func (s *Store) forget(domain string) {
	s.mu.Lock()
	delete(s.cache, domain)
	s.mu.Unlock()
}

// Save writes the state crash-durably: fsync the temp file before rename,
// then fsync the directory so the new directory entry survives a power loss.
func (s *Store) Save(st *SiteState) error {
	raw, err := json.MarshalIndent(st, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path(st.Domain) + ".tmp"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o640)
	if err != nil {
		return fmt.Errorf("write state for %s: %w", st.Domain, err)
	}
	if _, err := f.Write(raw); err != nil {
		f.Close()
		return fmt.Errorf("write state for %s: %w", st.Domain, err)
	}
	if err := f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmp, s.path(st.Domain)); err != nil {
		return fmt.Errorf("commit state for %s: %w", st.Domain, err)
	}
	s.forget(st.Domain)
	d, err := os.Open(s.dir)
	if err == nil {
		_ = d.Sync()
		_ = d.Close()
	}
	return nil
}

// Delete removes the state file for a domain (used by --prune-orphans).
func (s *Store) Delete(domain string) error {
	err := os.Remove(s.path(domain))
	s.forget(domain)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	return err
}
