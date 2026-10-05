// Package ratelimit implements the SQLite-backed counters of spec §3.3: failed
// logins per IP and per address with an exponential delay, and a plain
// fixed-window limiter for the public branding route.
package ratelimit

import (
	"context"
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

// Window is a fixed-window request limiter.
type Window struct {
	Store  *store.Store
	Bucket string
	Limit  int
	Span   time.Duration
	Now    func() time.Time
}

// Hit counts one request and reports whether it is within the limit.
func (w *Window) Hit(ctx context.Context, key string) (Decision, error) {
	now := time.Now()
	if w.Now != nil {
		now = w.Now()
	}
	st, err := w.Store.RLIncr(ctx, w.Bucket, key, now, w.Span, func(int) time.Duration { return 0 })
	if err != nil {
		return Decision{}, err
	}
	if st.Count > w.Limit {
		return Decision{RetryAfter: st.WindowStart.Add(w.Span).Sub(now)}, nil
	}
	return Decision{Allowed: true}, nil
}
