package state

import (
	"math"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// latencyBuckets are the cumulative histogram "le" (less-or-equal) bounds in
// milliseconds, Prometheus-style (spec §8, task 021 emits these verbatim as
// `_bucket{le="..."}` lines plus an implicit +Inf bucket = LatCount).
var latencyBuckets = []float64{5, 10, 20, 50, 100, 200, 500}

// ringSize is the number of most-recent latency observations kept for
// percentile computation. Older observations are overwritten in place
// (spec §4.5/§8: fixed-size, no growth).
const ringSize = 1024

// State holds process-lifetime counters and recent latency history for
// GET /status and GET /metrics. Every field that sits on the classify hot
// path is a plain atomic (Add/Load, no allocation, no lock) so concurrent
// requests never contend on a shared mutex; only the ring buffer — needed
// for percentiles, which can't be computed from an atomic alone — is guarded
// by a tiny mutex held for the duration of a single slice write. That mutex
// never overlaps with the counter or histogram updates, so it adds at most
// one short critical section per request, not per counter.
type State struct {
	startedAt time.Time

	requests atomic.Int64
	allow    atomic.Int64
	review   atomic.Int64
	block    atomic.Int64

	// errByCode is pre-populated in New with every status code the API ever
	// emits (spec §5's error table), so the hot path only ever does a map
	// read (safe for concurrent readers once the map stops being written)
	// followed by an atomic.Add — it never writes to the map itself.
	errByCode map[int]*atomic.Int64

	// buckets is a cumulative, monotonic latency histogram: buckets[i] counts
	// every observation with ms <= latencyBuckets[i]. latCount is the total
	// observation count (the implicit +Inf bucket / Prometheus "_count");
	// latSum is the running sum in ms (the "_sum"). All three are safe to
	// read concurrently with Load and are never touched by the ring mutex.
	buckets  []atomic.Int64
	latSum   atomic.Int64
	latCount atomic.Int64

	// mu guards only the ring below — never the counters or histogram above.
	// The ring supports percentiles, which need the actual recent value
	// distribution rather than a running aggregate; a plain slice behind a
	// short-held mutex is simpler and just as fast as a lock-free ring for
	// one float64 write per request, so we didn't reach for atomics here.
	mu   sync.Mutex
	ring [ringSize]float64
	idx  int
	full bool
}

// New builds a State with its boot timestamp set to now and every known
// error-code counter pre-created.
func New() *State {
	codes := []int{400, 401, 413, 415, 422, 429, 500, 503}
	m := make(map[int]*atomic.Int64, len(codes))
	for _, c := range codes {
		m[c] = new(atomic.Int64)
	}
	return &State{
		startedAt: time.Now(),
		errByCode: m,
		buckets:   make([]atomic.Int64, len(latencyBuckets)),
	}
}

// NewState is an alias for New, kept for callers that prefer the explicit
// name at the call site (e.g. state.NewState() reads unambiguously next to
// other packages' constructors in cmd/imagewarden/run.go).
func NewState() *State { return New() }

// RecordRequest increments the total request counter. Hot path: one atomic
// add, no allocation.
func (s *State) RecordRequest() { s.requests.Add(1) }

// RecordDecision tallies a classify verdict by name. It takes a plain
// string ("allow"/"review"/"block") rather than policy.Decision so that
// internal/state — like internal/policy and internal/imaging — imports no
// app-internal package (spec §4's import-boundary discipline, pinned by
// task 041's test). Callers pass string(verdict.Decision). An unrecognized
// value is a no-op rather than an error: state must never fail a request.
func (s *State) RecordDecision(d string) {
	switch d {
	case "allow":
		s.allow.Add(1)
	case "review":
		s.review.Add(1)
	case "block":
		s.block.Add(1)
	}
}

// RecordError tallies an HTTP error response by status code. Codes outside
// the pre-populated set (see New) are silently dropped rather than growing
// the map at request time — the hot path never allocates or writes to
// errByCode itself, only to the *atomic.Int64 values it already holds.
func (s *State) RecordError(code int) {
	if c := s.errByCode[code]; c != nil {
		c.Add(1)
	}
}

// ObserveLatency records one request's latency in milliseconds: it updates
// the cumulative histogram and sum/count atomically, then appends to the
// ring buffer under the ring's short-held mutex.
func (s *State) ObserveLatency(ms float64) {
	s.latCount.Add(1)
	s.latSum.Add(int64(ms))
	for i, bound := range latencyBuckets {
		if ms <= bound {
			s.buckets[i].Add(1)
		}
	}

	s.mu.Lock()
	s.ring[s.idx] = ms
	s.idx = (s.idx + 1) % len(s.ring)
	if s.idx == 0 {
		s.full = true
	}
	s.mu.Unlock()
}

// Bucket is one cumulative histogram bucket in a Snapshot.
type Bucket struct {
	Le    float64
	Count int64
}

// Snapshot is a plain-value copy of State at one instant, used by both
// GET /status and GET /metrics so the percentile math lives in exactly one
// place.
type Snapshot struct {
	Uptime       time.Duration
	Requests     int64
	Allow        int64
	Review       int64
	Block        int64
	ErrorsByCode map[int]int64
	P50          float64
	P95          float64
	P99          float64
	Buckets      []Bucket
	LatSum       float64
	LatCount     int64
}

// Snapshot reads every counter (lock-free Load calls) and, under the ring
// mutex, copies and sorts the populated portion of the ring to compute
// percentiles. The copy+sort happens on every call rather than being
// maintained incrementally — /status and /metrics are polled at human/scrape
// intervals, not per classify request, so trading a little CPU here keeps
// the hot path free of any percentile bookkeeping.
func (s *State) Snapshot() Snapshot {
	errs := make(map[int]int64, len(s.errByCode))
	for code, c := range s.errByCode {
		errs[code] = c.Load()
	}

	buckets := make([]Bucket, len(latencyBuckets))
	for i, bound := range latencyBuckets {
		buckets[i] = Bucket{Le: bound, Count: s.buckets[i].Load()}
	}

	p50, p95, p99 := s.percentiles()

	return Snapshot{
		Uptime:       time.Since(s.startedAt),
		Requests:     s.requests.Load(),
		Allow:        s.allow.Load(),
		Review:       s.review.Load(),
		Block:        s.block.Load(),
		ErrorsByCode: errs,
		P50:          p50,
		P95:          p95,
		P99:          p99,
		Buckets:      buckets,
		LatSum:       float64(s.latSum.Load()),
		LatCount:     s.latCount.Load(),
	}
}

// percentiles copies the populated window of the ring under mu, sorts the
// copy, and returns p50/p95/p99. Index rule: for a sorted n-element sample,
// percentile p uses index ceil(p*n)-1, clamped to [0, n-1] — e.g. for n=100,
// p50 -> index 49 (the 50th smallest value), p99 -> index 98 (the 99th
// smallest value). An empty ring (no observations yet) returns all zeros.
func (s *State) percentiles() (p50, p95, p99 float64) {
	s.mu.Lock()
	n := s.idx
	if s.full {
		n = len(s.ring)
	}
	cp := make([]float64, n)
	copy(cp, s.ring[:n])
	s.mu.Unlock()

	sort.Float64s(cp)

	pct := func(p float64) float64 {
		if n == 0 {
			return 0
		}
		i := int(math.Ceil(p*float64(n))) - 1
		if i < 0 {
			i = 0
		}
		if i >= n {
			i = n - 1
		}
		return cp[i]
	}

	return pct(0.50), pct(0.95), pct(0.99)
}
