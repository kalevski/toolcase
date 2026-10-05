package pipeline

import (
	"net/http"
	"testing"
	"time"
)

func TestBackoffSchedule(t *testing.T) {
	list := []time.Duration{10 * time.Second, time.Minute, 10 * time.Minute, time.Hour}
	mid := func() float64 { return 0.5 } // no jitter
	for n, want := range map[int]time.Duration{1: 10 * time.Second, 2: time.Minute, 3: 10 * time.Minute, 4: time.Hour, 5: time.Hour, 50: time.Hour} {
		if got := Backoff(list, n, mid); got != want {
			t.Errorf("Backoff(%d) = %v, want %v (the last value repeats)", n, got, want)
		}
	}
	if Backoff(nil, 1, mid) != 0 || Backoff(list, 0, mid) != 0 {
		t.Error("nothing to wait for")
	}
}

func TestJitterIsPlusMinusTwentyPercent(t *testing.T) {
	d := 100 * time.Second
	if got := Jitter(d, func() float64 { return 0 }); got != 80*time.Second {
		t.Errorf("low end = %v", got)
	}
	if got := Jitter(d, func() float64 { return 0.9999999 }); got < 119*time.Second || got > 120*time.Second {
		t.Errorf("high end = %v", got)
	}
	for i := 0; i < 1000; i++ {
		if got := Jitter(d, nil); got < 80*time.Second || got > 120*time.Second {
			t.Fatalf("jitter out of range: %v", got)
		}
	}
	if Jitter(0, nil) != 0 || Jitter(-time.Second, nil) != 0 {
		t.Error("no delay, no jitter")
	}
}

func TestParseRetryAfter(t *testing.T) {
	now := time.Date(2026, 10, 2, 12, 0, 0, 0, time.UTC)
	later := now.Add(90 * time.Second).UTC().Format(http.TimeFormat)
	past := now.Add(-time.Hour).UTC().Format(http.TimeFormat)
	far := now.Add(48 * time.Hour).UTC().Format(http.TimeFormat)
	tests := []struct {
		in   string
		want time.Duration
		ok   bool
	}{
		{"", 0, false}, {"  ", 0, false}, {"30", 30 * time.Second, true}, {" 5 ", 5 * time.Second, true}, {"0", 0, true},
		{"-5", 0, false}, {"abc", 0, false}, {"1.5", 0, false},
		{"3600", time.Hour, true}, {"3601", time.Hour, true}, {"99999999999", time.Hour, true},
		{later, 90 * time.Second, true}, {past, 0, true}, {far, time.Hour, true},
	}
	for _, tc := range tests {
		got, ok := ParseRetryAfter(tc.in, now)
		if got != tc.want || ok != tc.ok {
			t.Errorf("ParseRetryAfter(%q) = %v, %v; want %v, %v", tc.in, got, ok, tc.want, tc.ok)
		}
	}
}
