package pipeline

import (
	"fmt"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// RetryWindow is how long an after run keeps being retried (spec §7.10): time
// the run was held by a disabled or paused pipeline does not count.
const RetryWindow = 24 * time.Hour

// verdict is what an attempt of an after run led to.
type verdict struct {
	// State is the run's new state: succeeded, failed, or queued (a retry, or a
	// run that goes back to the queue because the node is shutting down).
	State string
	// NotBefore is when a queued run may start again.
	NotBefore time.Time
	// Error describes a failure for the run record.
	Error string
	// Retry marks a queued verdict that counts as a retry (not a shutdown).
	Retry bool
	// Uncounted: the attempt did not count (shutdown); the run's attempt number
	// goes back by one.
	Uncounted bool
}

// decideAfter applies spec §7.7 and §7.10 step 4 to the result of attempt
// number `attempt` (1-based) of an after run: success, a retry with backoff
// (Retry-After honoured) while attempts and the 24 h window last, or a
// permanent failure.
func decideAfter(res CallResult, attempt, maxAttempts int, backoff []time.Duration, runnableSince, now time.Time, rnd func() float64) verdict {
	switch res.Outcome {
	case OutcomeOK:
		return verdict{State: meta.RunSucceeded}
	case OutcomeCanceled:
		return verdict{State: meta.RunQueued, Uncounted: true}
	case OutcomeTransient:
		if attempt >= maxAttempts {
			return verdict{State: meta.RunFailed, Error: fmt.Sprintf("%s (gave up after %d attempt(s))", res.Err, attempt)}
		}
		if !runnableSince.IsZero() && now.Sub(runnableSince) >= RetryWindow {
			return verdict{State: meta.RunFailed, Error: res.Err + " (gave up: still failing after 24 hours)"}
		}
		delay := res.RetryAfter
		if delay <= 0 {
			delay = Backoff(backoff, attempt, rnd)
		}
		return verdict{State: meta.RunQueued, NotBefore: now.Add(delay), Error: res.Err, Retry: true}
	}
	// 422 and every other status: a permanent failure, no retry (spec §7.7)
	return verdict{State: meta.RunFailed, Error: res.Err}
}
