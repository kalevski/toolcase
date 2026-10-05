package app

import "time"

// SetJobStartDelay changes how long after boot the first lifecycle pass and the first scrub
// wait (tests); the returned func restores the previous value.
func SetJobStartDelay(d time.Duration) (restore func()) {
	old := jobStartDelay
	jobStartDelay = d
	return func() { jobStartDelay = old }
}
