// Package ratelimit implements the rate limits of binvault spec §4.9, which a
// bucket (§6.3) and a bucket token (§6.4) can each carry:
//
//   - requests_per_second and burst: a token bucket consulted once per
//     request (AllowRequest), at admission (§3.5 step 1); a request over the
//     limit is answered 503 SlowDown with Retry-After;
//   - bytes_in_per_second and bytes_out_per_second: byte token buckets that
//     pace uploads and downloads (WrapReader, WrapWriter; §3.5 step 2). A
//     transfer is slowed, never failed, and the budget is shared by all the
//     concurrent transfers through the same Limiter.
//
// A request must pass both its token's and its bucket's limits: a Set holds
// them in that order. Anonymous reads count against the bucket's alone.
// Pipeline tokens, the admin API and /_healthz are exempt, which callers
// implement by not consulting a Limiter. State lives in memory on the node
// that homes the bucket, so limits are exact in a cluster, and it resets when
// the node restarts.
package ratelimit

import (
	"context"
	"io"
	"math"
	"sync"
	"time"
)

const (
	// maxChunk is the most bytes one paced Read or Write moves per wait.
	maxChunk = 64 << 10
	// maxRetryAfter caps Retry-After for very low request rates.
	maxRetryAfter = 24 * time.Hour
)

// Limits are the rate limits of a bucket or a token (§4.9), with the field
// names of the admin API. A zero (or negative) field leaves its dimension
// unlimited.
type Limits struct {
	// RequestsPerSecond is the sustained request rate.
	RequestsPerSecond float64 `json:"requests_per_second,omitempty"`
	// Burst is how many requests may arrive at once. Zero means the default,
	// 2*ceil(RequestsPerSecond). It does nothing without a request rate.
	Burst int `json:"burst,omitempty"`
	// BytesInPerSecond paces request bodies (uploads).
	BytesInPerSecond int64 `json:"bytes_in_per_second,omitempty"`
	// BytesOutPerSecond paces response bodies (downloads).
	BytesOutPerSecond int64 `json:"bytes_out_per_second,omitempty"`
}

// IsZero reports whether l imposes no limit: no positive, finite request rate
// and no positive bandwidth. A Burst on its own imposes nothing.
func (l Limits) IsZero() bool {
	return requestRate(l) == 0 && l.BytesInPerSecond <= 0 && l.BytesOutPerSecond <= 0
}

// requestRate is the effective request rate; 0 means unlimited.
func requestRate(l Limits) float64 {
	if r := l.RequestsPerSecond; r > 0 && !math.IsInf(r, 1) {
		return r
	}
	return 0
}

func requestBurst(l Limits) float64 {
	if l.Burst > 0 {
		return float64(l.Burst)
	}
	return 2 * math.Ceil(l.RequestsPerSecond)
}

func byteRate(n int64) float64 {
	if n > 0 {
		return float64(n)
	}
	return 0
}

// Limiter enforces one Limits: a request bucket plus an upload and a download
// byte bucket. It is safe for concurrent use. A nil *Limiter is unlimited, and
// every method accepts a nil receiver.
type Limiter struct {
	mu     sync.Mutex
	limits Limits
	req    bucket // tokens are requests
	in     bucket // tokens are bytes
	out    bucket

	// The bandwidth clock and sleeper; tests replace them.
	now   func() time.Time
	sleep func(ctx context.Context, until time.Time) error
}

// New returns a Limiter enforcing l. It is never nil, even for zero limits, so
// that it can be updated later.
func New(l Limits) *Limiter { return newLimiter(l, time.Now, sleepUntil) }

func newLimiter(l Limits, now func() time.Time, sleep func(context.Context, time.Time) error) *Limiter {
	lim := &Limiter{now: now, sleep: sleep}
	lim.Update(l)
	return lim
}

// Update replaces the limits, for later requests and for the remaining bytes
// of transfers in progress. Unused allowances carry over, capped at the new
// bursts, and a dimension that was unlimited starts with a full burst.
// Updating to the same limits changes nothing. The request bucket is credited
// the time since its last request at the new rate.
func (lim *Limiter) Update(l Limits) {
	if lim == nil {
		return
	}
	lim.mu.Lock()
	defer lim.mu.Unlock()
	lim.limits = l
	lim.req.set(requestRate(l), requestBurst(l))
	now := lim.now()
	lim.in.setBytes(now, byteRate(l.BytesInPerSecond))
	lim.out.setBytes(now, byteRate(l.BytesOutPerSecond))
}

// Limits returns the limits as last given to New or Update (a Burst of 0
// stays 0).
func (lim *Limiter) Limits() Limits {
	if lim == nil {
		return Limits{}
	}
	lim.mu.Lock()
	defer lim.mu.Unlock()
	return lim.limits
}

// AllowRequest takes one request from the token bucket at time now, the
// caller's clock (pass time.Now()). Over the limit it returns false and how
// long until a request would be admitted, rounded up to whole seconds and at
// least 1s, ready for a Retry-After header (capped at 24h). A denied request
// takes nothing.
func (lim *Limiter) AllowRequest(now time.Time) (ok bool, retryAfter time.Duration) {
	ok, retryAfter, _ = lim.allow(now)
	return ok, retryAfter
}

// allow is AllowRequest that also reports whether a request was taken.
func (lim *Limiter) allow(now time.Time) (ok bool, retryAfter time.Duration, took bool) {
	if lim == nil {
		return true, 0, false
	}
	lim.mu.Lock()
	defer lim.mu.Unlock()
	b := &lim.req
	if b.rate == 0 {
		return true, 0, false
	}
	b.advance(now)
	if b.tokens >= 1 {
		b.tokens--
		return true, 0, true
	}
	return false, retryAfterFor((1 - b.tokens) / b.rate), false
}

// unallow gives back a request taken by allow.
func (lim *Limiter) unallow() {
	lim.mu.Lock()
	defer lim.mu.Unlock()
	if b := &lim.req; b.rate > 0 {
		b.tokens = math.Min(b.burst, b.tokens+1)
	}
}

func retryAfterFor(seconds float64) time.Duration {
	s := math.Ceil(seconds - 1e-9) // whole seconds, forgiving float noise
	switch {
	case s < 1:
		return time.Second
	case s >= maxRetryAfter.Seconds():
		return maxRetryAfter
	}
	return time.Duration(s) * time.Second
}

// WrapReader returns a reader that paces reads from r to BytesInPerSecond
// (uploads). Each Read first waits until its bytes fit the budget, then reads
// at most one second's worth and at most 64 KiB; bytes the underlying Read
// does not deliver are given back. The budget is one token bucket shared by
// every transfer through lim, and it follows Update mid-transfer. Once ctx is
// done Read returns ctx.Err(), at once if it is waiting. Like most readers,
// the result is for one goroutine at a time. A nil lim returns r itself.
func (lim *Limiter) WrapReader(ctx context.Context, r io.Reader) io.Reader {
	if lim == nil {
		return r
	}
	return Set{lim}.WrapReader(ctx, r)
}

// WrapWriter returns a writer that paces writes to w to BytesOutPerSecond
// (downloads), like WrapReader: a large Write is passed on in slices of at
// most one second's worth and at most 64 KiB, each after its wait. Once ctx
// is done Write returns ctx.Err() with the count written so far. A nil lim
// returns w itself.
func (lim *Limiter) WrapWriter(ctx context.Context, w io.Writer) io.Writer {
	if lim == nil {
		return w
	}
	return Set{lim}.WrapWriter(ctx, w)
}

// Set is the limiters that apply to one request, in order: the token's, then
// the bucket's. nil entries are skipped.
type Set []*Limiter

// AllowRequest admits a request only if every limiter in s does, consulted in
// order. A request denied by one limiter takes nothing from the others;
// retryAfter is the denying limiter's.
func (s Set) AllowRequest(now time.Time) (bool, time.Duration) {
	var stack [4]bool
	took := stack[:0]
	for _, lim := range s {
		ok, retry, t := lim.allow(now)
		if !ok {
			for j, t := range took {
				if t {
					s[j].unallow()
				}
			}
			return false, retry
		}
		took = append(took, t)
	}
	return true, 0
}

// WrapReader paces reads from r to the BytesInPerSecond of every limiter in
// s at once, so the slowest one sets the pace; see Limiter.WrapReader. With
// no non-nil limiter it returns r itself.
func (s Set) WrapReader(ctx context.Context, r io.Reader) io.Reader {
	p := s.pacer(ctx, upload)
	if p == nil {
		return r
	}
	return &reader{pacer: p, r: r}
}

// WrapWriter paces writes to w to the BytesOutPerSecond of every limiter in s
// at once; see Limiter.WrapWriter. With no non-nil limiter it returns w
// itself.
func (s Set) WrapWriter(ctx context.Context, w io.Writer) io.Writer {
	p := s.pacer(ctx, download)
	if p == nil {
		return w
	}
	return &writer{pacer: p, w: w}
}

func (s Set) pacer(ctx context.Context, d direction) *pacer {
	var lims []*Limiter
	for _, lim := range s {
		if lim != nil {
			lims = append(lims, lim)
		}
	}
	if len(lims) == 0 {
		return nil
	}
	if ctx == nil {
		ctx = context.Background()
	}
	return &pacer{ctx: ctx, d: d, lims: lims, held: make([]bool, len(lims))}
}

// bucket is a token bucket; a zero rate means unlimited.
type bucket struct {
	rate, burst, tokens float64
	last                time.Time
	started             bool // last is set
}

// set reconfigures b; a bucket that was unlimited starts full.
func (b *bucket) set(rate, burst float64) {
	switch {
	case rate <= 0:
		*b = bucket{}
	case b.rate <= 0:
		*b = bucket{rate: rate, burst: burst, tokens: burst}
	default:
		b.rate, b.burst = rate, burst
		b.tokens = math.Min(b.tokens, burst)
	}
}

// setBytes reconfigures a byte bucket at time now: the time so far is
// credited at the old rate, and the burst is one second of the new one.
func (b *bucket) setBytes(now time.Time, rate float64) {
	if b.rate > 0 {
		b.advance(now)
	}
	b.set(rate, rate)
}

// advance refills b up to now. Time going backwards refills nothing.
func (b *bucket) advance(now time.Time) {
	if !b.started {
		b.last, b.started = now, true
		return
	}
	if d := now.Sub(b.last); d > 0 {
		b.tokens = math.Min(b.burst, b.tokens+d.Seconds()*b.rate)
		b.last = now
	}
}

type direction uint8

const (
	upload direction = iota
	download
)

func (lim *Limiter) bytes(d direction) *bucket {
	if d == upload {
		return &lim.in
	}
	return &lim.out
}

// chunk returns how many bytes one paced call may move in direction d, or 0
// when d is unlimited.
func (lim *Limiter) chunk(d direction) int {
	lim.mu.Lock()
	defer lim.mu.Unlock()
	b := lim.bytes(d)
	if b.rate == 0 {
		return 0
	}
	return int(math.Max(1, math.Min(maxChunk, b.burst)))
}

// reserve takes n bytes in direction d. limited is false when d is unlimited
// and nothing was taken; otherwise wait reports whether the bytes may move
// only at until.
func (lim *Limiter) reserve(d direction, n int) (until time.Time, wait, limited bool) {
	lim.mu.Lock()
	defer lim.mu.Unlock()
	b := lim.bytes(d)
	if b.rate == 0 {
		return time.Time{}, false, false
	}
	now := lim.now()
	b.advance(now)
	b.tokens -= float64(n)
	if b.tokens >= 0 {
		return now, false, true
	}
	return now.Add(durationOf(-b.tokens / b.rate)), true, true
}

// refund gives back n reserved bytes that were not moved.
func (lim *Limiter) refund(d direction, n int) {
	lim.mu.Lock()
	defer lim.mu.Unlock()
	if b := lim.bytes(d); b.rate > 0 {
		b.tokens = math.Min(b.burst, b.tokens+float64(n))
	}
}

func durationOf(seconds float64) time.Duration {
	const limit = float64(math.MaxInt64 / 2)
	ns := math.Ceil(seconds * 1e9)
	if ns > limit {
		return time.Duration(limit)
	}
	return time.Duration(ns)
}

func sleepUntil(ctx context.Context, until time.Time) error {
	d := time.Until(until)
	if d <= 0 {
		return nil
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// pacer admits bytes through every limiter of a Set in one direction.
type pacer struct {
	ctx  context.Context
	d    direction
	lims []*Limiter
	held []bool // which limiters the last admit took from
}

// admit waits until up to want bytes may move through every limiter and
// returns how many: at most the smallest chunk among them.
func (p *pacer) admit(want int) (int, error) {
	n := want
	for _, lim := range p.lims {
		if c := lim.chunk(p.d); c > 0 && c < n {
			n = c
		}
	}
	var until time.Time
	var waiter *Limiter
	for i, lim := range p.lims {
		u, wait, limited := lim.reserve(p.d, n)
		p.held[i] = limited
		if wait && (waiter == nil || u.After(until)) {
			until, waiter = u, lim
		}
	}
	if waiter != nil {
		if err := waiter.sleep(p.ctx, until); err != nil {
			p.release(n)
			return 0, err
		}
	}
	return n, nil
}

// release gives back n bytes taken by the last admit.
func (p *pacer) release(n int) {
	if n <= 0 {
		return
	}
	for i, lim := range p.lims {
		if p.held[i] {
			lim.refund(p.d, n)
		}
	}
}

type reader struct {
	*pacer
	r io.Reader
}

func (r *reader) Read(b []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	if len(b) == 0 {
		return r.r.Read(b)
	}
	n, err := r.admit(len(b))
	if err != nil {
		return 0, err
	}
	m, err := r.r.Read(b[:n])
	r.release(n - m)
	return m, err
}

type writer struct {
	*pacer
	w io.Writer
}

func (w *writer) Write(b []byte) (int, error) {
	if err := w.ctx.Err(); err != nil {
		return 0, err
	}
	if len(b) == 0 {
		return w.w.Write(b)
	}
	written := 0
	for len(b) > 0 {
		if err := w.ctx.Err(); err != nil {
			return written, err
		}
		n, err := w.admit(len(b))
		if err != nil {
			return written, err
		}
		m, err := w.w.Write(b[:n])
		written += m
		w.release(n - m)
		if err != nil {
			return written, err
		}
		if m < n {
			return written, io.ErrShortWrite
		}
		b = b[n:]
	}
	return written, nil
}
