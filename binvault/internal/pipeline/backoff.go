package pipeline

import (
	"math/rand/v2"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// MaxRetryAfter caps a service's Retry-After (spec §7.7).
const MaxRetryAfter = time.Hour

// Backoff returns the delay before the attempt that follows attempt n
// (n >= 1): the n-th entry of list, the last one repeating, with ±20% jitter
// (spec §7.2). rnd returns a value in [0,1); nil uses the process generator.
func Backoff(list []time.Duration, n int, rnd func() float64) time.Duration {
	if len(list) == 0 || n < 1 {
		return 0
	}
	i := n - 1
	if i >= len(list) {
		i = len(list) - 1
	}
	return Jitter(list[i], rnd)
}

// Jitter spreads d by ±20%.
func Jitter(d time.Duration, rnd func() float64) time.Duration {
	if d <= 0 {
		return 0
	}
	if rnd == nil {
		rnd = rand.Float64
	}
	return time.Duration(float64(d) * (0.8 + 0.4*rnd()))
}

// ParseRetryAfter reads a Retry-After header, in seconds or as an HTTP date,
// capped at MaxRetryAfter. ok is false when the header is absent or invalid.
func ParseRetryAfter(v string, now time.Time) (d time.Duration, ok bool) {
	v = strings.TrimSpace(v)
	if v == "" {
		return 0, false
	}
	if n, err := strconv.ParseInt(v, 10, 64); err == nil {
		if n < 0 {
			return 0, false
		}
		d = time.Duration(n) * time.Second
		if n > int64(MaxRetryAfter/time.Second) {
			d = MaxRetryAfter
		}
		return d, true
	}
	if t, err := http.ParseTime(v); err == nil {
		d = t.Sub(now)
		if d < 0 {
			d = 0
		}
		if d > MaxRetryAfter {
			d = MaxRetryAfter
		}
		return d, true
	}
	return 0, false
}
