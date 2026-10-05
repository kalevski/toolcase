package ratelimit

import (
	"bytes"
	"context"
	"errors"
	"io"
	"math"
	"strings"
	"sync"
	"testing"
	"time"
)

var t0 = time.Date(2026, 10, 2, 12, 0, 0, 0, time.UTC)

// fakeClock is a virtual clock for the bandwidth buckets: a sleep moves it to
// the wake-up time at once, so concurrent sleepers follow the timeline they
// would in real time, without waiting.
type fakeClock struct {
	mu     sync.Mutex
	t      time.Time
	sleeps int
}

func newFakeClock() *fakeClock { return &fakeClock{t: t0} }

func (c *fakeClock) now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.t
}

func (c *fakeClock) sleep(ctx context.Context, until time.Time) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.sleeps++
	if until.After(c.t) {
		c.t = until
	}
	return nil
}

func (c *fakeClock) elapsed() time.Duration { return c.now().Sub(t0) }

func (c *fakeClock) limiter(l Limits) *Limiter { return newLimiter(l, c.now, c.sleep) }

// endless yields zero bytes forever and records the size of each Read.
type endless struct {
	mu    sync.Mutex
	sizes []int
}

func (e *endless) Read(p []byte) (int, error) {
	e.mu.Lock()
	e.sizes = append(e.sizes, len(p))
	e.mu.Unlock()
	clear(p)
	return len(p), nil
}

// trickle returns at most n bytes per Read.
type trickle struct{ n int }

func (t trickle) Read(p []byte) (int, error) { return min(len(p), t.n), nil }

// recorder records the size of each Write.
type recorder struct {
	bytes.Buffer
	sizes []int
}

func (r *recorder) Write(p []byte) (int, error) {
	r.sizes = append(r.sizes, len(p))
	return r.Buffer.Write(p)
}

func within(got, want, tol time.Duration) bool { return got >= want-tol && got <= want+tol }

func TestLimitsIsZero(t *testing.T) {
	tests := []struct {
		l    Limits
		want bool
	}{
		{Limits{}, true},
		{Limits{Burst: 5}, true},
		{Limits{RequestsPerSecond: -1, BytesInPerSecond: -1, BytesOutPerSecond: -1}, true},
		{Limits{RequestsPerSecond: math.NaN()}, true},
		{Limits{RequestsPerSecond: math.Inf(1)}, true},
		{Limits{RequestsPerSecond: 0.1}, false},
		{Limits{BytesInPerSecond: 1}, false},
		{Limits{BytesOutPerSecond: 1}, false},
	}
	for _, tc := range tests {
		if got := tc.l.IsZero(); got != tc.want {
			t.Errorf("%+v.IsZero() = %v, want %v", tc.l, got, tc.want)
		}
	}
}

// unlimited is where admitted and admitted2 stop counting.
const unlimited = 10000

// admitted counts the requests allowed at one instant.
func admitted(lim *Limiter, now time.Time) int {
	n := 0
	for n < unlimited {
		if ok, _ := lim.AllowRequest(now); !ok {
			break
		}
		n++
	}
	return n
}

func TestBurst(t *testing.T) {
	tests := []struct {
		l    Limits
		want int
	}{
		{Limits{RequestsPerSecond: 10}, 20}, // default: twice the rate
		{Limits{RequestsPerSecond: 8}, 16},
		{Limits{RequestsPerSecond: 2.5}, 6}, // 2*ceil(2.5)
		{Limits{RequestsPerSecond: 0.5}, 2}, // 2*ceil(0.5)
		{Limits{RequestsPerSecond: 10, Burst: 3}, 3},
		{Limits{RequestsPerSecond: 0.1, Burst: 1}, 1},
	}
	for _, tc := range tests {
		if got := admitted(New(tc.l), t0); got != tc.want {
			t.Errorf("%+v: %d requests at once, want %d", tc.l, got, tc.want)
		}
	}
}

func TestBurstThenSteadyRate(t *testing.T) {
	lim := New(Limits{RequestsPerSecond: 8}) // burst 16, one token per 125ms
	if got := admitted(lim, t0); got != 16 {
		t.Fatalf("burst admitted %d, want 16", got)
	}
	for k := 1; k <= 40; k++ {
		now := t0.Add(time.Duration(k) * 125 * time.Millisecond)
		if got := admitted(lim, now); got != 1 {
			t.Fatalf("step %d: admitted %d, want 1", k, got)
		}
		ok, retry := lim.AllowRequest(now)
		if ok || retry != time.Second {
			t.Fatalf("step %d: over the rate = %v, %v; want false, 1s", k, ok, retry)
		}
	}
	// After a pause the bucket refills to the burst, not beyond.
	if got := admitted(lim, t0.Add(time.Hour)); got != 16 {
		t.Errorf("after an hour admitted %d, want 16", got)
	}
}

func TestRetryAfter(t *testing.T) {
	type step struct {
		at    time.Duration // since t0
		ok    bool
		retry time.Duration
	}
	tests := []struct {
		name  string
		l     Limits
		steps []step
	}{
		{"1/s", Limits{RequestsPerSecond: 1, Burst: 1}, []step{
			{0, true, 0},
			{0, false, time.Second},
			{300 * time.Millisecond, false, time.Second}, // 0.7s, rounded up
			{time.Second, true, 0},
		}},
		{"1 per 4s", Limits{RequestsPerSecond: 0.25, Burst: 1}, []step{
			{0, true, 0},
			{0, false, 4 * time.Second},
			{time.Second, false, 3 * time.Second},
			{1500 * time.Millisecond, false, 3 * time.Second}, // 2.5s, rounded up
			{3999 * time.Millisecond, false, time.Second},
			{4 * time.Second, true, 0},
		}},
		{"fast rate still says 1s", Limits{RequestsPerSecond: 100, Burst: 1}, []step{
			{0, true, 0},
			{0, false, time.Second},
		}},
		{"very slow rate is capped", Limits{RequestsPerSecond: 1e-6, Burst: 1}, []step{
			{0, true, 0},
			{0, false, 24 * time.Hour},
		}},
		{"clock going back refills nothing", Limits{RequestsPerSecond: 1, Burst: 1}, []step{
			{10 * time.Second, true, 0},
			{5 * time.Second, false, time.Second},
			{10*time.Second + 500*time.Millisecond, false, time.Second},
			{11 * time.Second, true, 0},
		}},
	}
	for _, tc := range tests {
		lim := New(tc.l)
		for i, s := range tc.steps {
			ok, retry := lim.AllowRequest(t0.Add(s.at))
			if ok != s.ok || retry != s.retry {
				t.Errorf("%s step %d: AllowRequest = %v, %v; want %v, %v", tc.name, i, ok, retry, s.ok, s.retry)
			}
		}
	}
}

func TestUpdateRequests(t *testing.T) {
	lim := New(Limits{RequestsPerSecond: 1, Burst: 1})
	if ok, _ := lim.AllowRequest(t0); !ok {
		t.Fatal("first request denied")
	}
	if ok, _ := lim.AllowRequest(t0); ok {
		t.Fatal("second request admitted")
	}

	// A faster rate applies at once; the empty bucket is not refilled.
	lim.Update(Limits{RequestsPerSecond: 10, Burst: 10})
	if ok, _ := lim.AllowRequest(t0); ok {
		t.Error("Update refilled the bucket")
	}
	if got := admitted(lim, t0.Add(100*time.Millisecond)); got != 1 {
		t.Errorf("100ms at 10/s admitted %d, want 1", got)
	}
	if got := lim.Limits(); got != (Limits{RequestsPerSecond: 10, Burst: 10}) {
		t.Errorf("Limits() = %+v", got)
	}

	// A smaller burst caps what was saved.
	if got := admitted(lim, t0.Add(10*time.Second)); got != 10 {
		t.Fatalf("refilled bucket admitted %d, want 10", got)
	}
	lim.Update(Limits{RequestsPerSecond: 10, Burst: 3})
	if got := admitted(lim, t0.Add(20*time.Second)); got != 3 {
		t.Errorf("after lowering the burst admitted %d, want 3", got)
	}

	// Unlimited, then limited again with a full default burst.
	lim.Update(Limits{})
	if got := admitted(lim, t0.Add(20*time.Second)); got != unlimited {
		t.Errorf("unlimited admitted only %d", got)
	}
	lim.Update(Limits{RequestsPerSecond: 1})
	if got := admitted(lim, t0.Add(20*time.Second)); got != 2 {
		t.Errorf("re-limited admitted %d, want the default burst 2", got)
	}

	// The same limits again change nothing.
	lim.Update(Limits{RequestsPerSecond: 1})
	if ok, _ := lim.AllowRequest(t0.Add(20 * time.Second)); ok {
		t.Error("an identical Update refilled the bucket")
	}
}

func TestAllowRequestConcurrent(t *testing.T) {
	l := Limits{RequestsPerSecond: 1, Burst: 100}
	lim := New(l)
	var wg sync.WaitGroup
	var mu sync.Mutex
	allowed := 0
	for range 50 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range 20 {
				if ok, _ := lim.AllowRequest(t0); ok {
					mu.Lock()
					allowed++
					mu.Unlock()
				}
				lim.Update(l) // concurrent no-op reconfiguration
				_ = lim.Limits()
			}
		}()
	}
	wg.Wait()
	if allowed != 100 {
		t.Errorf("allowed %d of 1000 concurrent requests, want exactly the burst of 100", allowed)
	}
}

func TestNilLimiter(t *testing.T) {
	var lim *Limiter
	if ok, retry := lim.AllowRequest(t0); !ok || retry != 0 {
		t.Errorf("nil AllowRequest = %v, %v", ok, retry)
	}
	lim.Update(Limits{RequestsPerSecond: 1}) // must not panic
	if got := lim.Limits(); got != (Limits{}) {
		t.Errorf("nil Limits() = %+v", got)
	}
	r, w := strings.NewReader("x"), new(bytes.Buffer)
	if got := lim.WrapReader(context.Background(), r); got != io.Reader(r) {
		t.Error("nil WrapReader wrapped")
	}
	if got := lim.WrapWriter(context.Background(), w); got != io.Writer(w) {
		t.Error("nil WrapWriter wrapped")
	}
	for _, s := range []Set{nil, {}, {nil, nil}} {
		if ok, _ := s.AllowRequest(t0); !ok {
			t.Errorf("Set %v denied", s)
		}
		if s.WrapReader(context.Background(), r) != io.Reader(r) || s.WrapWriter(context.Background(), w) != io.Writer(w) {
			t.Errorf("Set %v wrapped", s)
		}
	}
}

func TestZeroLimits(t *testing.T) {
	c := newFakeClock()
	lim := c.limiter(Limits{})
	if !lim.Limits().IsZero() {
		t.Error("zero limits are not zero")
	}
	if got := admitted(lim, t0); got != unlimited {
		t.Errorf("zero limits admitted only %d", got)
	}
	src := bytes.Repeat([]byte("binvault"), 1<<17) // 1 MiB
	var dst bytes.Buffer
	if _, err := io.Copy(lim.WrapWriter(context.Background(), &dst), lim.WrapReader(context.Background(), bytes.NewReader(src))); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(dst.Bytes(), src) {
		t.Error("data changed")
	}
	if c.sleeps != 0 || c.elapsed() != 0 {
		t.Errorf("zero limits slept %d times", c.sleeps)
	}
}

func TestReaderPacing(t *testing.T) {
	c := newFakeClock()
	lim := c.limiter(Limits{BytesInPerSecond: 1000}) // burst and chunk: 1000 bytes
	src := &endless{}
	if _, err := io.ReadFull(lim.WrapReader(context.Background(), src), make([]byte, 10000)); err != nil {
		t.Fatal(err)
	}
	if got := c.elapsed(); !within(got, 9*time.Second, time.Millisecond) {
		t.Errorf("10000 bytes at 1000 B/s (1000 burst) took %v, want 9s", got)
	}
	for _, n := range src.sizes {
		if n > 1000 {
			t.Fatalf("a Read asked for %d bytes, more than the burst", n)
		}
	}
	// The download budget is separate and unlimited.
	before := c.elapsed()
	if _, err := lim.WrapWriter(context.Background(), io.Discard).Write(make([]byte, 1<<20)); err != nil {
		t.Fatal(err)
	}
	if c.elapsed() != before {
		t.Error("an upload limit slowed a download")
	}
}

func TestWriterPacing(t *testing.T) {
	c := newFakeClock()
	lim := c.limiter(Limits{BytesOutPerSecond: 1000})
	dst := &recorder{}
	n, err := lim.WrapWriter(context.Background(), dst).Write(bytes.Repeat([]byte{7}, 10000))
	if n != 10000 || err != nil {
		t.Fatalf("Write = %d, %v", n, err)
	}
	if got := c.elapsed(); !within(got, 9*time.Second, time.Millisecond) {
		t.Errorf("10000 bytes at 1000 B/s took %v, want 9s", got)
	}
	if len(dst.sizes) != 10 {
		t.Errorf("passed on in %d writes %v, want 10 of 1000", len(dst.sizes), dst.sizes)
	}
	if !bytes.Equal(dst.Bytes(), bytes.Repeat([]byte{7}, 10000)) {
		t.Error("data changed")
	}
}

func TestChunkSize(t *testing.T) {
	tests := []struct {
		rate int64
		want int // largest Read passed on
	}{
		{100, 100},
		{50000, 50000},
		{10 << 20, 64 << 10},
	}
	for _, tc := range tests {
		c := newFakeClock()
		lim := c.limiter(Limits{BytesInPerSecond: tc.rate})
		src := &endless{}
		if _, err := io.ReadFull(lim.WrapReader(context.Background(), src), make([]byte, 3*tc.want)); err != nil {
			t.Fatal(err)
		}
		if got := max(src.sizes[0], src.sizes[len(src.sizes)-1]); got != tc.want {
			t.Errorf("rate %d: Reads of %v, want at most %d", tc.rate, src.sizes, tc.want)
		}
	}
}

func TestShortReadsGiveBack(t *testing.T) {
	c := newFakeClock()
	lim := c.limiter(Limits{BytesInPerSecond: 1000})
	// 10 bytes per Read: each Read reserves 1000 and gives back 990.
	if _, err := io.ReadFull(lim.WrapReader(context.Background(), trickle{10}), make([]byte, 5000)); err != nil {
		t.Fatal(err)
	}
	if got := c.elapsed(); !within(got, 4*time.Second, 50*time.Millisecond) {
		t.Errorf("5000 bytes in 10-byte reads took %v, want about 4s", got)
	}
}

// TestSharedBandwidth runs three transfers through one Limiter on the virtual
// clock: they share one budget.
func TestSharedBandwidth(t *testing.T) {
	c := newFakeClock()
	lim := c.limiter(Limits{BytesInPerSecond: 1000})
	var wg sync.WaitGroup
	for range 3 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := io.ReadFull(lim.WrapReader(context.Background(), &endless{}), make([]byte, 10000)); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	// 30000 bytes, 1000 of them burst: 29s, not the 9s of separate budgets.
	if got := c.elapsed(); !within(got, 29*time.Second, time.Millisecond) {
		t.Errorf("3 x 10000 bytes at a shared 1000 B/s took %v, want 29s", got)
	}
}

// TestSharedBandwidthRealTime is the same in real time, with wide tolerance.
func TestSharedBandwidthRealTime(t *testing.T) {
	const rate = 200000 // burst 200000, chunks of 64 KiB
	lim := New(Limits{BytesOutPerSecond: rate})
	start := time.Now()
	var wg sync.WaitGroup
	for range 3 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := lim.WrapWriter(context.Background(), io.Discard).Write(make([]byte, 100000)); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	// 300000 bytes, 200000 of them burst: 0.5s at the limit.
	elapsed := time.Since(start)
	if elapsed < 400*time.Millisecond || elapsed > 2500*time.Millisecond {
		t.Errorf("3 x 100000 bytes at a shared %d B/s took %v, want about 500ms", rate, elapsed)
	}
	t.Logf("throughput beyond the burst: %.0f B/s (limit %d)", 100000/elapsed.Seconds(), rate)
}

func TestUpdateBandwidth(t *testing.T) {
	c := newFakeClock()
	lim := c.limiter(Limits{})
	r := lim.WrapReader(context.Background(), &endless{}) // one transfer across every phase
	read := func(n int) time.Duration {
		t.Helper()
		before := c.elapsed()
		if _, err := io.ReadFull(r, make([]byte, n)); err != nil {
			t.Fatal(err)
		}
		return c.elapsed() - before
	}
	if d := read(10000); d != 0 {
		t.Errorf("unlimited read took %v", d)
	}
	lim.Update(Limits{BytesInPerSecond: 1000}) // starts with a full 1000-byte burst
	if d := read(5000); !within(d, 4*time.Second, time.Millisecond) {
		t.Errorf("5000 bytes at 1000 B/s took %v, want 4s", d)
	}
	lim.Update(Limits{BytesInPerSecond: 2000}) // nothing saved, twice the pace
	if d := read(10000); !within(d, 5*time.Second, time.Millisecond) {
		t.Errorf("10000 bytes at 2000 B/s took %v, want 5s", d)
	}
	lim.Update(Limits{})
	if d := read(1 << 20); d != 0 {
		t.Errorf("read after lifting the limit took %v", d)
	}
}

func TestCancelDuringWait(t *testing.T) {
	lim := New(Limits{BytesInPerSecond: 10, BytesOutPerSecond: 10}) // bursts of 10 bytes

	ctx, cancel := context.WithCancel(context.Background())
	time.AfterFunc(50*time.Millisecond, cancel)
	start := time.Now()
	n, err := lim.WrapWriter(ctx, io.Discard).Write(make([]byte, 100))
	if n != 10 || !errors.Is(err, context.Canceled) {
		t.Errorf("Write = %d, %v; want 10, context.Canceled", n, err)
	}
	if d := time.Since(start); d > 900*time.Millisecond {
		t.Errorf("cancelled Write returned after %v", d)
	}

	ctx, cancel = context.WithCancel(context.Background())
	r := lim.WrapReader(ctx, &endless{})
	if n, err := r.Read(make([]byte, 100)); n != 10 || err != nil {
		t.Fatalf("first Read = %d, %v; want the 10-byte burst", n, err)
	}
	time.AfterFunc(50*time.Millisecond, cancel)
	start = time.Now()
	if n, err := r.Read(make([]byte, 100)); n != 0 || !errors.Is(err, context.Canceled) {
		t.Errorf("waiting Read = %d, %v; want 0, context.Canceled", n, err)
	}
	if d := time.Since(start); d > 900*time.Millisecond {
		t.Errorf("cancelled Read returned after %v", d)
	}

	// The cancelled reservations were given back.
	lim.mu.Lock()
	in, out := lim.in.tokens, lim.out.tokens
	lim.mu.Unlock()
	if in < -1e-9 || out < -1e-9 {
		t.Errorf("budgets after cancelling: in %v, out %v; want nothing owed", in, out)
	}
}

func TestDoneContextBeforeIO(t *testing.T) {
	c := newFakeClock()
	lim := c.limiter(Limits{BytesInPerSecond: 1000, BytesOutPerSecond: 1000})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	src := &endless{}
	if n, err := lim.WrapReader(ctx, src).Read(make([]byte, 10)); n != 0 || !errors.Is(err, context.Canceled) {
		t.Errorf("Read = %d, %v", n, err)
	}
	dst := &recorder{}
	if n, err := lim.WrapWriter(ctx, dst).Write(make([]byte, 10)); n != 0 || !errors.Is(err, context.Canceled) {
		t.Errorf("Write = %d, %v", n, err)
	}
	if len(src.sizes) != 0 || len(dst.sizes) != 0 {
		t.Error("I/O happened after the context was done")
	}
}

func TestSetAllowRequest(t *testing.T) {
	t.Run("token denies first", func(t *testing.T) {
		token := New(Limits{RequestsPerSecond: 1, Burst: 2})
		bucket := New(Limits{RequestsPerSecond: 100, Burst: 100})
		s := Set{token, bucket}
		if got := admitted2(s, t0); got != 2 {
			t.Errorf("admitted %d, want the token's burst of 2", got)
		}
		if ok, retry := s.AllowRequest(t0); ok || retry != time.Second {
			t.Errorf("AllowRequest = %v, %v; want the token's denial", ok, retry)
		}
		if got := tokens(bucket); got != 98 {
			t.Errorf("bucket holds %v, want 98: denied requests must not reach it", got)
		}
	})
	t.Run("bucket denies, token gets its request back", func(t *testing.T) {
		token := New(Limits{RequestsPerSecond: 100, Burst: 100})
		bucket := New(Limits{RequestsPerSecond: 0.25, Burst: 2})
		s := Set{token, nil, bucket}
		if got := admitted2(s, t0); got != 2 {
			t.Errorf("admitted %d, want the bucket's burst of 2", got)
		}
		for range 10 {
			if ok, retry := s.AllowRequest(t0); ok || retry != 4*time.Second {
				t.Fatalf("AllowRequest = %v, %v; want the bucket's 4s denial", ok, retry)
			}
		}
		if got := tokens(token); got != 98 {
			t.Errorf("token holds %v, want 98: requests the bucket denied must be given back", got)
		}
	})
	t.Run("unlimited members", func(t *testing.T) {
		s := Set{New(Limits{}), New(Limits{RequestsPerSecond: 1, Burst: 1})}
		if got := admitted2(s, t0); got != 1 {
			t.Errorf("admitted %d, want 1", got)
		}
	})
}

func admitted2(s Set, now time.Time) int {
	n := 0
	for n < unlimited {
		if ok, _ := s.AllowRequest(now); !ok {
			break
		}
		n++
	}
	return n
}

func tokens(lim *Limiter) float64 {
	lim.mu.Lock()
	defer lim.mu.Unlock()
	return lim.req.tokens
}

func TestSetWrappers(t *testing.T) {
	for _, slowFirst := range []bool{false, true} {
		c := newFakeClock()
		fast := c.limiter(Limits{BytesInPerSecond: 2000, BytesOutPerSecond: 2000})
		slow := c.limiter(Limits{BytesInPerSecond: 1000, BytesOutPerSecond: 1000})
		s := Set{fast, nil, slow}
		if slowFirst {
			s = Set{slow, fast}
		}
		if _, err := io.ReadFull(s.WrapReader(context.Background(), &endless{}), make([]byte, 11000)); err != nil {
			t.Fatal(err)
		}
		// The slower limiter sets the pace: (11000-1000)/1000.
		if got := c.elapsed(); !within(got, 10*time.Second, time.Millisecond) {
			t.Errorf("slowFirst=%v: read took %v, want 10s", slowFirst, got)
		}
		// The slow budget was charged for every byte, once: what it started
		// with plus its refills up to its last reservation, minus what is left.
		slow.mu.Lock()
		spent := slow.in.burst + slow.in.rate*slow.in.last.Sub(t0).Seconds() - slow.in.tokens
		slow.mu.Unlock()
		if math.Abs(spent-11000) > 1 {
			t.Errorf("slowFirst=%v: slow budget spent %v, want 11000", slowFirst, spent)
		}
		// Downloads have their own budgets, still holding a full burst.
		before := c.elapsed()
		if n, err := s.WrapWriter(context.Background(), io.Discard).Write(make([]byte, 5000)); n != 5000 || err != nil {
			t.Fatalf("Write = %d, %v", n, err)
		}
		if got := c.elapsed() - before; !within(got, 4*time.Second, time.Millisecond) {
			t.Errorf("slowFirst=%v: write took %v, want 4s", slowFirst, got)
		}
	}
}

// TestConcurrentUse exercises every method at once for the race detector.
func TestConcurrentUse(t *testing.T) {
	c := newFakeClock()
	lim := c.limiter(Limits{RequestsPerSecond: 50, BytesInPerSecond: 4096, BytesOutPerSecond: 4096})
	var wg sync.WaitGroup
	for i := range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range 50 {
				lim.AllowRequest(t0.Add(time.Duration(j) * time.Millisecond))
				io.CopyN(lim.WrapWriter(context.Background(), io.Discard), lim.WrapReader(context.Background(), &endless{}), 3000)
				if i == 0 && j%10 == 0 {
					lim.Update(Limits{RequestsPerSecond: float64(10 + j), BytesInPerSecond: int64(2048 + j), BytesOutPerSecond: 4096})
				}
				_ = lim.Limits()
			}
		}()
	}
	wg.Wait()
}
