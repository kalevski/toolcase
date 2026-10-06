// Package state persists what zonewright last put on disk for each zone —
// the SOA serial and a fingerprint of the zone's content — so serials survive
// restarts and only move when the data does. Stored as one JSON file under
// data_dir, written atomically.
package state

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

// ZoneState is the durable record for one zone.
type ZoneState struct {
	Serial    uint32    `json:"serial"`
	Hash      string    `json:"hash"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Store is a concurrency-safe, file-backed map of zone → ZoneState.
type Store struct {
	path string
	mu   sync.Mutex
	data map[string]ZoneState
	// dirty is set by Put/Delete (and for a state file that does not exist
	// yet) so Save rewrites the file only when something changed.
	dirty bool
}

// NewStore loads (or initializes) data_dir/state.json.
func NewStore(dataDir string) (*Store, error) {
	s := &Store{path: filepath.Join(dataDir, "state.json"), data: map[string]ZoneState{}}
	raw, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		s.dirty = true
		return s, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read state: %w", err)
	}
	var doc struct {
		Zones map[string]ZoneState `json:"zones"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, fmt.Errorf("parse state %s: %w", s.path, err)
	}
	if doc.Zones != nil {
		s.data = doc.Zones
	}
	return s, nil
}

// NewMemoryStore is a store that never touches disk (validate, print-zone).
func NewMemoryStore() *Store { return &Store{data: map[string]ZoneState{}} }

// Get returns a zone's state and whether it exists.
func (s *Store) Get(zone string) (ZoneState, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	st, ok := s.data[zone]
	return st, ok
}

// Put records a zone's new state (in memory until Save).
func (s *Store) Put(zone string, st ZoneState) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[zone], s.dirty = st, true
}

// Delete forgets a zone.
func (s *Store) Delete(zone string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.data, zone)
	s.dirty = true
}

// Zones lists every zone with state, sorted.
func (s *Store) Zones() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]string, 0, len(s.data))
	for z := range s.data {
		out = append(out, z)
	}
	sort.Strings(out)
	return out
}

// Save writes the store to disk atomically (temp + fsync + rename).
func (s *Store) Save() error {
	if s.path == "" {
		return nil
	}
	s.mu.Lock()
	if !s.dirty {
		s.mu.Unlock()
		return nil
	}
	raw, err := json.MarshalIndent(map[string]any{"zones": s.data}, "", "  ")
	s.dirty = err != nil
	s.mu.Unlock()
	if err != nil {
		return err
	}
	ok := false
	defer func() {
		if !ok {
			s.mu.Lock()
			s.dirty = true
			s.mu.Unlock()
		}
	}()
	dir := filepath.Dir(s.path)
	tmp, err := os.CreateTemp(dir, ".state-*.tmp")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err := tmp.Write(append(raw, '\n')); err != nil {
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
	if err := os.Rename(tmp.Name(), s.path); err != nil {
		return err
	}
	ok = true
	return nil
}

// NextSerial returns the serial to publish after prev, in the conventional
// YYYYMMDDnn format: today's first serial when prev is older, otherwise
// prev+1 (so more than 99 changes in a day simply run into tomorrow's range,
// which is still monotonic — the only property secondaries care about).
func NextSerial(prev uint32, now time.Time) uint32 {
	y, m, d := now.UTC().Date()
	base := uint32(y*1000000 + int(m)*10000 + d*100)
	if prev < base {
		return base
	}
	return prev + 1
}
