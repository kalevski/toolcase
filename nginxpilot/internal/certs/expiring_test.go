package certs

import (
	"testing"
	"time"
)

func TestExpiringWithin(t *testing.T) {
	now := time.Now()
	idx := &Index{entries: map[string]Entry{
		"due.example.com":      {NotAfter: now.Add(12 * time.Hour)},
		"boundary.example.com": {NotAfter: now.Add(24 * time.Hour)}, // exactly at threshold → NOT due (strict <)
		"fresh.example.com":    {NotAfter: now.Add(60 * 24 * time.Hour)},
		"unparsed.example.com": {}, // zero NotAfter → skipped
		"expired.example.com":  {NotAfter: now.Add(-time.Hour)},
	}}

	due := idx.ExpiringWithin(now, 24*time.Hour)
	got := map[string]bool{}
	for _, c := range due {
		got[c.Domain] = true
	}
	if !got["due.example.com"] || !got["expired.example.com"] {
		t.Errorf("due/expired certs missing: %v", got)
	}
	if got["fresh.example.com"] || got["unparsed.example.com"] || got["boundary.example.com"] {
		t.Errorf("not-due certs included: %v", got)
	}

	var nilIdx *Index
	if out := nilIdx.ExpiringWithin(now, time.Hour); len(out) != 0 {
		t.Errorf("nil index must yield empty, got %v", out)
	}
}
