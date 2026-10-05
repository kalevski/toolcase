package pipeline

import (
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

func TestDecideAfter(t *testing.T) {
	now := time.Date(2026, 10, 2, 12, 0, 0, 0, time.UTC)
	back := []time.Duration{10 * time.Second, time.Minute}
	mid := func() float64 { return 0.5 }
	since := now.Add(-time.Minute)

	// success
	if v := decideAfter(CallResult{Outcome: OutcomeOK, Status: 204}, 1, 5, back, since, now, mid); v.State != meta.RunSucceeded {
		t.Errorf("ok: %+v", v)
	}
	// transient: retried with the backoff of that attempt
	v := decideAfter(CallResult{Outcome: OutcomeTransient, Status: 503, Err: "boom"}, 1, 5, back, since, now, mid)
	if v.State != meta.RunQueued || !v.Retry || !v.NotBefore.Equal(now.Add(10*time.Second)) || v.Error != "boom" {
		t.Errorf("first retry: %+v", v)
	}
	v = decideAfter(CallResult{Outcome: OutcomeTransient}, 2, 5, back, since, now, mid)
	if !v.NotBefore.Equal(now.Add(time.Minute)) {
		t.Errorf("second retry: %+v", v)
	}
	v = decideAfter(CallResult{Outcome: OutcomeTransient}, 4, 5, back, since, now, mid)
	if !v.NotBefore.Equal(now.Add(time.Minute)) {
		t.Errorf("the last backoff repeats: %+v", v)
	}
	// Retry-After replaces the backoff
	v = decideAfter(CallResult{Outcome: OutcomeTransient, RetryAfter: 3 * time.Second}, 1, 5, back, since, now, mid)
	if !v.NotBefore.Equal(now.Add(3 * time.Second)) {
		t.Errorf("Retry-After honoured: %+v", v)
	}
	// attempts exhausted
	v = decideAfter(CallResult{Outcome: OutcomeTransient, Err: "boom"}, 5, 5, back, since, now, mid)
	if v.State != meta.RunFailed || v.Error == "" {
		t.Errorf("exhausted: %+v", v)
	}
	// a single-attempt pipeline never retries
	if v = decideAfter(CallResult{Outcome: OutcomeTransient}, 1, 1, back, since, now, mid); v.State != meta.RunFailed {
		t.Errorf("max_attempts 1: %+v", v)
	}
	// 24 hours of retrying are the cap
	old := now.Add(-RetryWindow)
	if v = decideAfter(CallResult{Outcome: OutcomeTransient}, 2, 10, back, old, now, mid); v.State != meta.RunFailed {
		t.Errorf("24h cap: %+v", v)
	}
	if v = decideAfter(CallResult{Outcome: OutcomeTransient}, 2, 10, back, old.Add(time.Second), now, mid); v.State != meta.RunQueued {
		t.Errorf("just inside the window: %+v", v)
	}
	// permanent failures never retry
	for _, o := range []Outcome{OutcomeRejected, OutcomeFailed} {
		if v = decideAfter(CallResult{Outcome: o, Err: "x"}, 1, 5, back, since, now, mid); v.State != meta.RunFailed || v.Retry {
			t.Errorf("outcome %v: %+v", o, v)
		}
	}
	// an abandoned call (shutdown) goes back to the queue without counting
	if v = decideAfter(CallResult{Outcome: OutcomeCanceled}, 1, 5, back, since, now, mid); v.State != meta.RunQueued || !v.Uncounted || v.Retry {
		t.Errorf("canceled: %+v", v)
	}
}
