package state

import (
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
