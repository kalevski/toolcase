package auth

import (
	"testing"
	"time"
)

func TestThrottle(t *testing.T) {
	now := time.Date(2026, 10, 2, 12, 0, 0, 0, time.UTC)
	th := NewThrottle(3, time.Minute)
	th.now = func() time.Time { return now }

	for i := 0; i < 2; i++ {
		th.Fail("1.2.3.4")
	}
	if b, _ := th.Blocked("1.2.3.4"); b {
		t.Fatal("blocked below the limit")
	}
	th.Fail("1.2.3.4")
	b, wait := th.Blocked("1.2.3.4")
	if !b || wait != time.Minute {
		t.Fatalf("blocked=%v wait=%v", b, wait)
	}
	// other addresses are unaffected
	if b, _ := th.Blocked("5.6.7.8"); b {
		t.Fatal("unrelated address blocked")
	}
	// the window slides
	now = now.Add(61 * time.Second)
	if b, _ := th.Blocked("1.2.3.4"); b {
		t.Fatal("still blocked after the window")
	}
	// Retry-After shrinks as the oldest failure ages
	for i := 0; i < 3; i++ {
		th.Fail("9.9.9.9")
		now = now.Add(10 * time.Second)
	}
	b, wait = th.Blocked("9.9.9.9")
	if !b || wait != 30*time.Second {
		t.Fatalf("blocked=%v wait=%v", b, wait)
	}
}

func TestThrottleDisabledAndNil(t *testing.T) {
	var nilT *Throttle
	nilT.Fail("x")
	if b, _ := nilT.Blocked("x"); b {
		t.Fatal("nil throttle blocks")
	}
	off := NewThrottle(0, time.Minute)
	for i := 0; i < 100; i++ {
		off.Fail("x")
	}
	if b, _ := off.Blocked("x"); b {
		t.Fatal("disabled throttle blocks")
	}
}
