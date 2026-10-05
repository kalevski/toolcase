package auth

import (
	"sync"
	"time"
)

// Throttle counts failed authentications per client address in a sliding
// window and blocks an address above the limit (spec §4.8). Keys are never
// blocked, only addresses, so a public access key id cannot be used to lock a
// token out.
type Throttle struct {
	limit  int
	window time.Duration
	now    func() time.Time

	mu      sync.Mutex
	byAddr  map[string][]time.Time
	lastGC  time.Time
	maxAddr int
}

// NewThrottle returns a throttle allowing `limit` failures per `window`; a
// limit of 0 disables it.
func NewThrottle(limit int, window time.Duration) *Throttle {
	return &Throttle{limit: limit, window: window, now: time.Now, byAddr: map[string][]time.Time{}, maxAddr: 100_000}
}

// Fail records a failed authentication from addr.
func (t *Throttle) Fail(addr string) {
	if t == nil || t.limit <= 0 {
		return
	}
	now := t.now()
	t.mu.Lock()
	defer t.mu.Unlock()
	t.gc(now)
	ts := t.prune(t.byAddr[addr], now)
	if len(ts) >= t.limit { // keep the memory per address bounded
		ts = ts[len(ts)-t.limit+1:]
	}
	if _, ok := t.byAddr[addr]; !ok && len(t.byAddr) >= t.maxAddr {
		return // under a distributed flood, stop growing; existing offenders stay counted
	}
	t.byAddr[addr] = append(ts, now)
}

// Blocked reports whether addr is over the limit, and when the oldest failure
// leaves the window (the Retry-After to send).
func (t *Throttle) Blocked(addr string) (bool, time.Duration) {
	if t == nil || t.limit <= 0 {
		return false, 0
	}
	now := t.now()
	t.mu.Lock()
	defer t.mu.Unlock()
	ts := t.prune(t.byAddr[addr], now)
	if len(ts) == 0 {
		delete(t.byAddr, addr)
		return false, 0
	}
	t.byAddr[addr] = ts
	if len(ts) < t.limit {
		return false, 0
	}
	wait := ts[0].Add(t.window).Sub(now)
	if wait < time.Second {
		wait = time.Second
	}
	return true, wait
}

func (t *Throttle) prune(ts []time.Time, now time.Time) []time.Time {
	cut := now.Add(-t.window)
	i := 0
	for i < len(ts) && !ts[i].After(cut) {
		i++
	}
	return ts[i:]
}

// gc drops idle addresses at most once a minute.
func (t *Throttle) gc(now time.Time) {
	if now.Sub(t.lastGC) < time.Minute {
		return
	}
	t.lastGC = now
	for a, ts := range t.byAddr {
		if len(t.prune(ts, now)) == 0 {
			delete(t.byAddr, a)
		}
	}
}
