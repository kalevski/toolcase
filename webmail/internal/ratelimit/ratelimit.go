// Package ratelimit implements the SQLite-backed counters of spec §3.3: failed
// logins per IP and per address with an exponential delay, and a plain
// fixed-window limiter for the public branding and invite routes (with a bounded
// in-memory block list in front of its SQLite counter).
package ratelimit

import (
	"container/list"
	"context"
	"sync"
	"time"

	"github.com/kalevski/toolcase/webmail/internal/store"
)

// Decision is the outcome of a check.
type Decision struct {
	Allowed    bool
	RetryAfter time.Duration
}

// Failures limits failed attempts per key: after FreeFailures the key is
// delayed 1s, 2s, 4s ... (capped at the window); at Limit failures within the
// window it is blocked until the window ends.
type Failures struct {
	Store        *store.Store
	Bucket       string
	Limit        int
	Window       time.Duration
	FreeFailures int
	Now          func() time.Time
}

func (f *Failures) now() time.Time {
	if f.Now != nil {
		return f.Now()
	}
	return time.Now()
}

// Check reports whether an attempt for key may proceed.
func (f *Failures) Check(ctx context.Context, key string) (Decision, error) {
	st, err := f.Store.RLGet(ctx, f.Bucket, key)
	if err != nil {
		return Decision{}, err
	}
	now := f.now()
	if st.Count == 0 || !now.Before(st.WindowStart.Add(f.Window)) {
		return Decision{Allowed: true}, nil
	}
	if st.Count >= f.Limit {
		return Decision{RetryAfter: st.WindowStart.Add(f.Window).Sub(now)}, nil
	}
	if now.Before(st.BlockedUntil) {
		return Decision{RetryAfter: st.BlockedUntil.Sub(now)}, nil
	}
	return Decision{Allowed: true}, nil
}

// Fail records a failed attempt.
func (f *Failures) Fail(ctx context.Context, key string) error {
	_, err := f.Store.RLIncr(ctx, f.Bucket, key, f.now(), f.Window, func(n int) time.Duration {
		if n < f.Limit && n <= f.FreeFailures {
			return 0
		}
		if n >= f.Limit {
			return f.Window
		}
		shift := n - f.FreeFailures - 1
		if shift > 20 {
			shift = 20
		}
		d := time.Second << shift
		if d > f.Window {
			d = f.Window
		}
		return d
	})
	return err
}

// Reset clears a key after a success.
func (f *Failures) Reset(ctx context.Context, key string) error {
	return f.Store.RLReset(ctx, f.Bucket, key)
}

const (
	// blockedMax bounds the in-memory block list of a Window.
	blockedMax = 10_000
	// sweepHorizon is how long the server keeps an ended counter (RLSweep): a
	// longer Span could see its row swept mid-window, so such a Window never
	// trusts memory.
	sweepHorizon = time.Hour
)

// Window is a fixed-window request limiter. Hits normally cost one SQLite
// write; once the store has said a key is over the limit, the key is also
// remembered in memory until the end of that window and further hits are
// refused without touching the store. The memory is never the source of
// truth: it only repeats a decision the store already made for a window that
// has not ended, so it cannot block anyone the store would not. It is bounded
// (oldest evicted; an evicted or restarted key just goes back to the store).
// The zero value of the unexported fields is ready to use.
type Window struct {
	Store  *store.Store
	Bucket string
	Limit  int
	Span   time.Duration
	Now    func() time.Time

	mu      sync.Mutex
	blocked map[string]*list.Element // key -> element holding *blockEntry
	order   *list.List               // front = oldest
}

type blockEntry struct {
	key   string
	start time.Time // window start the store reported
	end   int64     // unix second at which the store would open a new window
}

// Hit counts one request and reports whether it is within the limit.
func (w *Window) Hit(ctx context.Context, key string) (Decision, error) {
	now := time.Now()
	if w.Now != nil {
		now = w.Now()
	}
	if start, ok := w.blockedNow(key, now); ok {
		return Decision{RetryAfter: start.Add(w.Span).Sub(now)}, nil
	}
	st, err := w.Store.RLIncr(ctx, w.Bucket, key, now, w.Span, func(int) time.Duration { return 0 })
	if err != nil {
		return Decision{}, err
	}
	if st.Count > w.Limit {
		w.remember(key, st.WindowStart, now)
		return Decision{RetryAfter: st.WindowStart.Add(w.Span).Sub(now)}, nil
	}
	return Decision{Allowed: true}, nil
}

// windowEnd mirrors the store's rollover rule (RLIncr starts a new window once
// now >= start + whole seconds of the span).
func (w *Window) windowEnd(start time.Time) int64 {
	return start.Unix() + int64(w.Span.Seconds())
}

// blockedNow reports a remembered, still-running over-limit window for key.
func (w *Window) blockedNow(key string, now time.Time) (time.Time, bool) {
	w.mu.Lock()
	defer w.mu.Unlock()
	el, ok := w.blocked[key]
	if !ok {
		return time.Time{}, false
	}
	e := el.Value.(*blockEntry)
	if now.Unix() >= e.end { // the store would roll the window over: ask it
		w.removeLocked(el)
		return time.Time{}, false
	}
	return e.start, true
}

// remember records an over-limit decision the store just made.
func (w *Window) remember(key string, start, now time.Time) {
	if w.Span > sweepHorizon {
		return
	}
	end := w.windowEnd(start)
	if end <= now.Unix() { // the store would not keep this window
		return
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.blocked == nil {
		w.blocked, w.order = map[string]*list.Element{}, list.New()
	}
	if el, ok := w.blocked[key]; ok {
		w.removeLocked(el)
	}
	for w.order.Len() >= blockedMax {
		w.removeLocked(w.order.Front()) // oldest first, and the oldest are the soonest to end
	}
	w.blocked[key] = w.order.PushBack(&blockEntry{key: key, start: start, end: end})
}

func (w *Window) removeLocked(el *list.Element) {
	delete(w.blocked, el.Value.(*blockEntry).key)
	w.order.Remove(el)
}
