package ratelimit

import (
	"context"
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
