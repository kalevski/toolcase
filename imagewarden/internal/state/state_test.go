package state

import (
	"sync"
	"testing"
)

// TestConcurrentCounters hammers the hot-path methods from many goroutines
// and asserts the atomics land every increment with no lost updates. Run
// with `go test -race` (per task) to also confirm there's no data race on
// the counters or the errByCode map reads.
func TestConcurrentCounters(t *testing.T) {
	s := New()

	const goroutines = 100
	const perGoroutine = 1000

	var wg sync.WaitGroup
	wg.Add(goroutines)
	for g := 0; g < goroutines; g++ {
		go func() {
			defer wg.Done()
			for i := 0; i < perGoroutine; i++ {
				s.RecordRequest()
				s.RecordDecision("allow")
				s.RecordError(429)
			}
		}()
	}
	wg.Wait()

	snap := s.Snapshot()
	want := int64(goroutines * perGoroutine)
	if snap.Requests != want {
		t.Errorf("Requests = %d, want %d", snap.Requests, want)
	}
	if snap.Allow != want {
		t.Errorf("Allow = %d, want %d", snap.Allow, want)
	}
	if snap.ErrorsByCode[429] != want {
		t.Errorf("ErrorsByCode[429] = %d, want %d", snap.ErrorsByCode[429], want)
	}
}

// TestConcurrentObserveLatency exercises ObserveLatency (the one method
// that touches the ring mutex in addition to atomics) from many goroutines
// concurrently, so -race also covers the ring write path.
func TestConcurrentObserveLatency(t *testing.T) {
	s := New()

	const goroutines = 50
	const perGoroutine = 200

	var wg sync.WaitGroup
	wg.Add(goroutines)
	for g := 0; g < goroutines; g++ {
		go func() {
			defer wg.Done()
			for i := 0; i < perGoroutine; i++ {
				s.ObserveLatency(10)
			}
		}()
	}
	wg.Wait()

	snap := s.Snapshot()
	want := int64(goroutines * perGoroutine)
	if snap.LatCount != want {
		t.Errorf("LatCount = %d, want %d", snap.LatCount, want)
	}
	if snap.LatSum != float64(want*10) {
		t.Errorf("LatSum = %v, want %v", snap.LatSum, float64(want*10))
	}
}

// TestRecordDecision covers every recognized decision string plus the
// no-op fallback for anything else, so a typo'd or future decision name
// never panics or silently corrupts an unrelated counter.
func TestRecordDecision(t *testing.T) {
	s := New()
	s.RecordDecision("allow")
	s.RecordDecision("allow")
	s.RecordDecision("review")
	s.RecordDecision("block")
	s.RecordDecision("nonsense") // unrecognized: no-op, must not panic or touch a counter

	snap := s.Snapshot()
	if snap.Allow != 2 {
		t.Errorf("Allow = %d, want 2", snap.Allow)
	}
	if snap.Review != 1 {
		t.Errorf("Review = %d, want 1", snap.Review)
	}
	if snap.Block != 1 {
		t.Errorf("Block = %d, want 1", snap.Block)
	}
}

// TestRecordErrorTallying checks known codes tally independently and an
// unrecognized code is a silent no-op (the hot path must never grow the map
// or fail a request over an unexpected status code).
func TestRecordErrorTallying(t *testing.T) {
	s := New()
	s.RecordError(429)
	s.RecordError(429)
	s.RecordError(503)
	s.RecordError(999) // not pre-populated: no-op

	snap := s.Snapshot()
	if snap.ErrorsByCode[429] != 2 {
		t.Errorf("ErrorsByCode[429] = %d, want 2", snap.ErrorsByCode[429])
	}
	if snap.ErrorsByCode[503] != 1 {
		t.Errorf("ErrorsByCode[503] = %d, want 1", snap.ErrorsByCode[503])
	}
	if _, ok := snap.ErrorsByCode[999]; ok {
		t.Errorf("ErrorsByCode contains unrecognized code 999, want absent")
	}
	for _, code := range []int{400, 401, 413, 415, 422} {
		if snap.ErrorsByCode[code] != 0 {
			t.Errorf("ErrorsByCode[%d] = %d, want 0 (never recorded)", code, snap.ErrorsByCode[code])
		}
	}
}

// TestPercentilesKnownDistribution feeds exactly 1..100 ms and checks the
// documented index rule: for a sorted n-sample, percentile p reads index
// ceil(p*n)-1. For n=100 that's index 49 (value 50) for p50, index 94
// (value 95) for p95, index 98 (value 99) for p99.
func TestPercentilesKnownDistribution(t *testing.T) {
	s := New()
	for ms := 1; ms <= 100; ms++ {
		s.ObserveLatency(float64(ms))
	}

	snap := s.Snapshot()
	if snap.P50 != 50 {
		t.Errorf("P50 = %v, want 50", snap.P50)
	}
	if snap.P95 != 95 {
		t.Errorf("P95 = %v, want 95", snap.P95)
	}
	if snap.P99 != 99 {
		t.Errorf("P99 = %v, want 99", snap.P99)
	}
}

// TestPercentilesEmptyRing asserts a fresh State (no observations yet)
// reports zero percentiles rather than panicking or dividing by zero.
func TestPercentilesEmptyRing(t *testing.T) {
	s := New()
	snap := s.Snapshot()
	if snap.P50 != 0 || snap.P95 != 0 || snap.P99 != 0 {
		t.Errorf("percentiles on empty ring = (%v, %v, %v), want (0, 0, 0)", snap.P50, snap.P95, snap.P99)
	}
}

// TestRingWraparound writes more observations than the ring's capacity and
// confirms only the most recent window drives percentiles — the oldest
// values (1..500) must be fully evicted once 1524 observations (500 more
// than ringSize) have been written, leaving exactly the window 501..1524.
func TestRingWraparound(t *testing.T) {
	s := New()

	const total = ringSize + 500
	for ms := 1; ms <= total; ms++ {
		s.ObserveLatency(float64(ms))
	}

	if !s.full {
		t.Fatal("full = false after writing past ring capacity, want true")
	}

	// Sorted window is exactly [501..1524] (1024 values): index rule
	// ceil(p*1024)-1 picks out 501+index for each percentile.
	snap := s.Snapshot()
	wantP50 := float64(501 + 511)  // ceil(0.50*1024)-1 = 511
	wantP95 := float64(501 + 972)  // ceil(0.95*1024)-1 = 972
	wantP99 := float64(501 + 1013) // ceil(0.99*1024)-1 = 1013

	if snap.P50 != wantP50 {
		t.Errorf("P50 = %v, want %v", snap.P50, wantP50)
	}
	if snap.P95 != wantP95 {
		t.Errorf("P95 = %v, want %v", snap.P95, wantP95)
	}
	if snap.P99 != wantP99 {
		t.Errorf("P99 = %v, want %v", snap.P99, wantP99)
	}
}

// TestBucketsMonotonicAndBounded checks the cumulative histogram is
// non-decreasing across bucket bounds and that no bucket count exceeds the
// total observation count (LatCount, the implicit +Inf bucket).
func TestBucketsMonotonicAndBounded(t *testing.T) {
	s := New()
	for _, ms := range []float64{1, 5, 15, 50, 99, 300, 1000, 1000} {
		s.ObserveLatency(ms)
	}

	snap := s.Snapshot()
	if len(snap.Buckets) != len(latencyBuckets) {
		t.Fatalf("len(Buckets) = %d, want %d", len(snap.Buckets), len(latencyBuckets))
	}
	for i := 1; i < len(snap.Buckets); i++ {
		if snap.Buckets[i].Count < snap.Buckets[i-1].Count {
			t.Errorf("Buckets[%d].Count (%d) < Buckets[%d].Count (%d), want non-decreasing",
				i, snap.Buckets[i].Count, i-1, snap.Buckets[i-1].Count)
		}
	}
	last := snap.Buckets[len(snap.Buckets)-1]
	if last.Count > snap.LatCount {
		t.Errorf("last bucket count %d > LatCount %d", last.Count, snap.LatCount)
	}

	// Two observations (300, 1000, 1000) fall above the largest bound (500),
	// so the top bucket must be strictly less than the total count.
	if last.Count >= snap.LatCount {
		t.Errorf("last bucket count %d should be < LatCount %d (some observations exceed every bound)", last.Count, snap.LatCount)
	}
}

// TestUptimeAndConstructorAlias checks New/NewState both produce a usable
// State with a non-negative uptime.
func TestUptimeAndConstructorAlias(t *testing.T) {
	for _, ctor := range []func() *State{New, NewState} {
		s := ctor()
		snap := s.Snapshot()
		if snap.Uptime < 0 {
			t.Errorf("Uptime = %v, want >= 0", snap.Uptime)
		}
	}
}
