package pipeline

import "time"

// SetPersistTiming shortens the timeout and the first retry pause of the writes
// that record how a run ended; the returned function restores them.
func SetPersistTiming(timeout, retry time.Duration) (restore func()) {
	t, r := persistTimeout, persistRetry
	persistTimeout, persistRetry = timeout, retry
	return func() { persistTimeout, persistRetry = t, r }
}
