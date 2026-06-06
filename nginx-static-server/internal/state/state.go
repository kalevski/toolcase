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

	// HTTP validators (http-zip sources).
	ETag         string `json:"etag,omitempty"`
	LastModified string `json:"last_modified,omitempty"`

	// ContentHash is the SHA-256 of the last downloaded archive body.
	ContentHash string `json:"content_hash,omitempty"`

	LastSuccess   time.Time `json:"last_success,omitzero"`
	LastError     string    `json:"last_error,omitempty"`
	LastErrorTime time.Time `json:"last_error_time,omitzero"`
	FailureStreak int       `json:"failure_streak"`
}

// NeverSynced reports whether the site has ever completed a successful sync.
func (s *SiteState) NeverSynced() bool { return s.LastSuccess.IsZero() }

// Store reads and writes per-site state files.
type Store struct {
	dir string
}

// NewStore creates the state directory under dataDir if needed.
func NewStore(dataDir string) (*Store, error) {
	dir := filepath.Join(dataDir, "state")
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, fmt.Errorf("create state dir: %w", err)
	}
	return &Store{dir: dir}, nil
}

func (s *Store) path(domain string) string {
	return filepath.Join(s.dir, domain+".json")
}

// Load returns the stored state for domain, or a fresh zero state if none
// exists yet.
func (s *Store) Load(domain string) (*SiteState, error) {
	raw, err := os.ReadFile(s.path(domain))
	if errors.Is(err, fs.ErrNotExist) {
		return &SiteState{Domain: domain}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("load state for %s: %w", domain, err)
	}
	var st SiteState
	if err := json.Unmarshal(raw, &st); err != nil {
		// Corrupt state file: start over rather than refusing to run; the
		// next sync re-deploys and rewrites it.
		return &SiteState{Domain: domain}, nil
	}
	st.Domain = domain
	return &st, nil
}

// Save writes the state atomically (temp file + rename).
func (s *Store) Save(st *SiteState) error {
	raw, err := json.MarshalIndent(st, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path(st.Domain) + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o640); err != nil {
		return fmt.Errorf("write state for %s: %w", st.Domain, err)
	}
	if err := os.Rename(tmp, s.path(st.Domain)); err != nil {
		return fmt.Errorf("commit state for %s: %w", st.Domain, err)
	}
	return nil
}

// Delete removes the state file for a domain (used by --prune-orphans).
func (s *Store) Delete(domain string) error {
	err := os.Remove(s.path(domain))
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	return err
}
