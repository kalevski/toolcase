package ratelimit

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/webmail/internal/store"
)

type clock struct{ t time.Time }

func (c *clock) now() time.Time { return c.t }

func setup(t *testing.T) (*store.Store, *clock) {
	t.Helper()
	ck := &clock{t: time.Unix(1_700_000_000, 0)}
	s, err := store.Open(context.Background(), t.TempDir(), store.Options{Now: ck.now})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	return s, ck
}

func TestFailuresDelayAndBlock(t *testing.T) {
	s, ck := setup(t)
	ctx := context.Background()
	f := &Failures{Store: s, Bucket: "addr", Limit: 6, Window: 15 * time.Minute, FreeFailures: 2, Now: ck.now}

	for i := 0; i < 2; i++ { // free failures: no delay
		if d, _ := f.Check(ctx, "a@x.test"); !d.Allowed {
			t.Fatalf("attempt %d blocked", i)
		}
		f.Fail(ctx, "a@x.test")
	}
	if d, _ := f.Check(ctx, "a@x.test"); !d.Allowed {
		t.Fatal("blocked after free failures")
	}
	f.Fail(ctx, "a@x.test") // 3rd: 1s delay
	d, _ := f.Check(ctx, "a@x.test")
	if d.Allowed || d.RetryAfter != time.Second {
		t.Fatalf("want 1s delay, got %+v", d)
	}
	ck.t = ck.t.Add(2 * time.Second)
	if d, _ := f.Check(ctx, "a@x.test"); !d.Allowed {
		t.Fatal("delay should have elapsed")
	}
	f.Fail(ctx, "a@x.test") // 4th: 2s
	d, _ = f.Check(ctx, "a@x.test")
	if d.RetryAfter != 2*time.Second {
		t.Fatalf("want 2s, got %v", d.RetryAfter)
	}
	ck.t = ck.t.Add(3 * time.Second)
	f.Fail(ctx, "a@x.test") // 5th: 4s
	ck.t = ck.t.Add(5 * time.Second)
	f.Fail(ctx, "a@x.test") // 6th = limit: blocked for the window
	d, _ = f.Check(ctx, "a@x.test")
	if d.Allowed || d.RetryAfter < 14*time.Minute {
		t.Fatalf("want window block, got %+v", d)
	}
	// other keys are independent
	if d, _ := f.Check(ctx, "b@x.test"); !d.Allowed {
		t.Fatal("other key blocked")
	}
	// the window ends, the key is free again
	ck.t = ck.t.Add(16 * time.Minute)
	if d, _ := f.Check(ctx, "a@x.test"); !d.Allowed {
		t.Fatal("still blocked after the window")
	}
}

func TestFailuresReset(t *testing.T) {
	s, ck := setup(t)
	ctx := context.Background()
	f := &Failures{Store: s, Bucket: "addr", Limit: 3, Window: time.Minute, FreeFailures: 0, Now: ck.now}
	f.Fail(ctx, "k")
	f.Fail(ctx, "k")
	f.Reset(ctx, "k")
	if d, _ := f.Check(ctx, "k"); !d.Allowed {
		t.Fatal("reset did not clear")
	}
}

func TestWindowHit(t *testing.T) {
	s, ck := setup(t)
	ctx := context.Background()
	w := &Window{Store: s, Bucket: "branding", Limit: 3, Span: time.Minute, Now: ck.now}
	for i := 0; i < 3; i++ {
		if d, _ := w.Hit(ctx, "1.2.3.4"); !d.Allowed {
			t.Fatalf("hit %d denied", i)
		}
	}
	d, _ := w.Hit(ctx, "1.2.3.4")
	if d.Allowed || d.RetryAfter <= 0 {
		t.Fatalf("4th hit should be denied: %+v", d)
	}
	ck.t = ck.t.Add(61 * time.Second)
	if d, _ := w.Hit(ctx, "1.2.3.4"); !d.Allowed {
		t.Fatal("new window should allow")
	}
}

func TestWindowBlockedHitsDoNotWrite(t *testing.T) {
	s, ck := setup(t)
	ctx := context.Background()
	w := &Window{Store: s, Bucket: "branding", Limit: 3, Span: time.Minute, Now: ck.now}
	for i := 0; i < 4; i++ { // 3 allowed, the 4th is the store's first "over" decision
		w.Hit(ctx, "ip")
	}
	st, _ := s.RLGet(ctx, "branding", "ip")
	if st.Count != 4 {
		t.Fatalf("count %d", st.Count)
	}
	for i := 0; i < 50; i++ {
		ck.t = ck.t.Add(500 * time.Millisecond)
		d, err := w.Hit(ctx, "ip")
		if err != nil || d.Allowed || d.RetryAfter <= 0 {
			t.Fatalf("hit %d: %+v %v", i, d, err)
		}
	}
	if st, _ = s.RLGet(ctx, "branding", "ip"); st.Count != 4 {
		t.Fatalf("blocked hits wrote to the store: count %d", st.Count)
	}
	// Same RetryAfter semantics as the store path: time left in the window.
	d, _ := w.Hit(ctx, "ip")
	want := st.WindowStart.Add(time.Minute).Sub(ck.t)
	if d.RetryAfter != want {
		t.Fatalf("retry-after %v, want %v", d.RetryAfter, want)
	}
	// An unrelated key is untouched and still writes.
	if d, _ := w.Hit(ctx, "other"); !d.Allowed {
		t.Fatal("other key blocked")
	}
}

func TestWindowRolloverUnblocks(t *testing.T) {
	s, ck := setup(t)
	ctx := context.Background()
	w := &Window{Store: s, Bucket: "b", Limit: 1, Span: time.Minute, Now: ck.now}
	w.Hit(ctx, "k")
	w.Hit(ctx, "k") // over: remembered until the window ends
	ck.t = ck.t.Add(59 * time.Second)
	if d, _ := w.Hit(ctx, "k"); d.Allowed {
		t.Fatal("unblocked before the window ended")
	}
	ck.t = ck.t.Add(time.Minute) // window over
	if d, _ := w.Hit(ctx, "k"); !d.Allowed {
		t.Fatal("window rollover did not unblock")
	}
	// And the next window enforces again from the store.
	if d, _ := w.Hit(ctx, "k"); d.Allowed {
		t.Fatal("second hit of the new window should be over the limit")
	}
}

func TestWindowRestartEnforcesFromStore(t *testing.T) {
	s, ck := setup(t)
	ctx := context.Background()
	w1 := &Window{Store: s, Bucket: "b", Limit: 2, Span: time.Minute, Now: ck.now}
	for i := 0; i < 3; i++ {
		w1.Hit(ctx, "k")
	}
	w2 := &Window{Store: s, Bucket: "b", Limit: 2, Span: time.Minute, Now: ck.now} // fresh memory
	if d, _ := w2.Hit(ctx, "k"); d.Allowed {
		t.Fatal("restart forgot the block")
	}
	if len(w2.blocked) != 1 {
		t.Fatal("store decision should be re-learned")
	}
	// Counters from an earlier process under the limit are honoured too.
	w3 := &Window{Store: s, Bucket: "b2", Limit: 2, Span: time.Minute, Now: ck.now}
	w3.Hit(ctx, "k")
	w4 := &Window{Store: s, Bucket: "b2", Limit: 2, Span: time.Minute, Now: ck.now}
	w4.Hit(ctx, "k")
	if d, _ := w4.Hit(ctx, "k"); d.Allowed {
		t.Fatal("count did not survive restart")
	}
}

func TestWindowEvictionFallsBackToStore(t *testing.T) {
	s, ck := setup(t)
	ctx := context.Background()
	w := &Window{Store: s, Bucket: "b", Limit: 1, Span: time.Minute, Now: ck.now}
	w.Hit(ctx, "victim")
	w.Hit(ctx, "victim") // blocked and remembered
	for i := 0; i < blockedMax; i++ {
		k := fmt.Sprint("flood", i)
		w.remember(k, ck.t, ck.t)
	}
	if n := len(w.blocked); n > blockedMax {
		t.Fatalf("unbounded: %d", n)
	}
	if _, ok := w.blocked["victim"]; ok {
		t.Fatal("victim should have been evicted")
	}
	// Evicted, but the store still has the block.
	if d, _ := w.Hit(ctx, "victim"); d.Allowed {
		t.Fatal("eviction unblocked a key")
	}
	if _, ok := w.blocked["victim"]; !ok {
		t.Fatal("re-learned from the store")
	}
}

func TestWindowLongSpanNeverTrustsMemory(t *testing.T) {
	s, ck := setup(t)
	ctx := context.Background()
	w := &Window{Store: s, Bucket: "b", Limit: 1, Span: 2 * time.Hour, Now: ck.now}
	w.Hit(ctx, "k")
	w.Hit(ctx, "k")
	if len(w.blocked) != 0 {
		t.Fatal("memory used for a span the sweeper may cut short")
	}
}

func TestWindowConcurrent(t *testing.T) {
	s, ck := setup(t)
	ctx := context.Background()
	w := &Window{Store: s, Bucket: "b", Limit: 5, Span: time.Minute, Now: ck.now}
	var wg sync.WaitGroup
	var allowed atomic.Int64
	for g := 0; g < 16; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			for i := 0; i < 40; i++ {
				d, err := w.Hit(ctx, "shared")
				if err != nil {
					t.Error(err)
					return
				}
				if d.Allowed {
					allowed.Add(1)
				}
				w.Hit(ctx, fmt.Sprint("k", g, i%3))
			}
		}(g)
	}
	wg.Wait()
	if n := allowed.Load(); n != 5 {
		t.Fatalf("allowed %d, want exactly the limit (5)", n)
	}
}
