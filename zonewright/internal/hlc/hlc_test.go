package hlc

import (
	"testing"
	"time"
)

func TestMonotonicUnderClockRegression(t *testing.T) {
	wall := time.Date(2026, 9, 25, 12, 0, 0, 0, time.UTC)
	c := New(0, func() time.Time { return wall })
	a := c.Now()
	wall = wall.Add(-time.Minute) // NTP steps the clock back
	b := c.Now()
	cc := c.Now()
	if !(a < b && b < cc) {
		t.Fatalf("not monotonic: %d %d %d", a, b, cc)
	}
	if b.Physical() != a.Physical() {
		t.Fatal("regression should bump the counter, not the physical part")
	}
}

func TestObserveOrdersLater(t *testing.T) {
	wall := time.Date(2026, 9, 25, 12, 0, 0, 0, time.UTC)
	c := New(0, func() time.Time { return wall })
	remote := FromTime(wall.Add(5 * time.Second)) // a peer whose clock is ahead
	c.Observe(remote)
	if got := c.Now(); got <= remote {
		t.Fatalf("a change made after seeing %d must order after it, got %d", remote, got)
	}
}

func TestPersistedStartPoint(t *testing.T) {
	wall := time.Date(2026, 9, 25, 12, 0, 0, 0, time.UTC)
	prev := FromTime(wall.Add(time.Hour))
	c := New(prev, func() time.Time { return wall })
	if c.Now() <= prev {
		t.Fatal("restarted clock must continue after the persisted value")
	}
}
