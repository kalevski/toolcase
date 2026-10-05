// Package hlc implements a hybrid logical clock: 48 bits of wall-clock
// milliseconds plus a 16-bit counter packed into a uint64. Every timestamp a
// Clock issues is strictly greater than every timestamp it has issued or
// observed, so "I saw your change, then made mine" always orders mine later —
// even when the servers' wall clocks disagree a little (binvault spec §8.5).
package hlc

import (
	"sync"
	"time"
)

// logicalBits is the width of the counter below the millisecond field.
const logicalBits = 16

// Timestamp is a packed HLC value. Comparing two Timestamps as integers
// compares them in HLC order.
type Timestamp uint64

// Physical returns the wall-clock part.
func (t Timestamp) Physical() time.Time {
	return time.UnixMilli(int64(t >> logicalBits)).UTC()
}

// FromTime is the smallest timestamp at wall time w.
func FromTime(w time.Time) Timestamp {
	return Timestamp(uint64(w.UnixMilli()) << logicalBits)
}

// Clock issues monotonic timestamps. Safe for concurrent use.
type Clock struct {
	mu   sync.Mutex
	last Timestamp
	wall func() time.Time
}

// New returns a clock that has already observed last (e.g. the value
// persisted before a restart).
func New(last Timestamp, wall func() time.Time) *Clock {
	if wall == nil {
		wall = time.Now
	}
	return &Clock{last: last, wall: wall}
}

// Now issues a new timestamp, strictly greater than any seen so far.
func (c *Clock) Now() Timestamp {
	c.mu.Lock()
	defer c.mu.Unlock()
	if cand := FromTime(c.wall()); cand > c.last {
		c.last = cand
	} else {
		c.last++ // same millisecond (or wall clock went back): bump the counter
	}
	return c.last
}

// Observe folds a remote timestamp in, so the next Now() orders after it.
func (c *Clock) Observe(t Timestamp) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if t > c.last {
		c.last = t
	}
}

// Last returns the highest timestamp issued or observed.
func (c *Clock) Last() Timestamp {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.last
}
