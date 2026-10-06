package state

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestNextSerial(t *testing.T) {
	now := time.Date(2026, 9, 25, 12, 0, 0, 0, time.UTC)
	cases := map[uint32]uint32{
		0:          2026092500,
		1:          2026092500,
		2026092400: 2026092500, // yesterday's → today's first
		2026092500: 2026092501,
		2026092599: 2026092600, // >99 changes spill into tomorrow's range
		2026100100: 2026100101, // serial ahead of the clock keeps counting up
	}
	for prev, want := range cases {
		if got := NextSerial(prev, now); got != want {
			t.Errorf("NextSerial(%d) = %d, want %d", prev, got, want)
		}
	}
}

func TestStorePersists(t *testing.T) {
	dir := t.TempDir()
	s, err := NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	s.Put("example.com", ZoneState{Serial: 7, Hash: "h"})
	if err := s.Save(); err != nil {
		t.Fatal(err)
	}
	s2, err := NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	if st, ok := s2.Get("example.com"); !ok || st.Serial != 7 || st.Hash != "h" {
		t.Fatalf("not persisted: %+v %v", st, ok)
	}
}

// Save rewrites the file only when something changed.
func TestSaveSkipsWhenClean(t *testing.T) {
	dir := t.TempDir()
	s, err := NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Save(); err != nil { // first save always creates the file
		t.Fatal(err)
	}
	path := filepath.Join(dir, "state.json")
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("state.json not created: %v", err)
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err := s.Save(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); err == nil {
		t.Fatal("clean Save rewrote the file")
	}
	s.Put("example.com", ZoneState{Serial: 1})
	if err := s.Save(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatal("dirty Save did not write the file")
	}
}
