package hlc

import (
	"sync"
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

// Timestamps issued from many goroutines are unique, and each goroutine sees its
// own strictly increasing.
func TestConcurrentTimestampsAreUnique(t *testing.T) {
	wall := time.Date(2026, 9, 25, 12, 0, 0, 0, time.UTC) // a frozen wall clock: every call bumps the counter
	c := New(0, func() time.Time { return wall })
	const goroutines, per = 8, 1000
	got := make([][]Timestamp, goroutines)
	var wg sync.WaitGroup
	for g := range got {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			for i := 0; i < per; i++ {
				got[g] = append(got[g], c.Now())
			}
		}(g)
	}
	wg.Wait()
	seen := map[Timestamp]bool{}
	for g := range got {
		for i, ts := range got[g] {
			if seen[ts] {
				t.Fatalf("timestamp %d issued twice", ts)
			}
			seen[ts] = true
			if i > 0 && ts <= got[g][i-1] {
				t.Fatalf("goroutine %d: %d after %d", g, ts, got[g][i-1])
			}
		}
	}
	if c.Last() != maxOf(seen) {
		t.Fatalf("Last() = %d", c.Last())
	}
}

func maxOf(m map[Timestamp]bool) Timestamp {
	var out Timestamp
	for ts := range m {
		out = max(out, ts)
	}
	return out
}

// Observe never moves the clock back, and what it learnt orders the next stamp.
func TestObserveNeverGoesBack(t *testing.T) {
	wall := time.Date(2026, 9, 25, 12, 0, 0, 0, time.UTC)
	c := New(0, func() time.Time { return wall })
	hi := FromTime(wall.Add(time.Hour))
	c.Observe(hi)
	c.Observe(FromTime(wall)) // older: ignored
	if c.Last() != hi {
		t.Fatalf("Last() = %d, want %d", c.Last(), hi)
	}
	if got := c.Now(); got <= hi {
		t.Fatalf("Now() = %d after observing %d", got, hi)
	}
	if hi.Physical() != wall.Add(time.Hour) {
		t.Fatalf("Physical() = %s", hi.Physical())
	}
}
