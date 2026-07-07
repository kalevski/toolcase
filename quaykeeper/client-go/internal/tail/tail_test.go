package tail

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

// collector accumulates tailed lines for assertions.
type collector struct {
	mu    sync.Mutex
	lines []string
}

func (c *collector) add(_ string, line []byte) {
	c.mu.Lock()
	c.lines = append(c.lines, string(line))
	c.mu.Unlock()
}

func (c *collector) snapshot() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]string, len(c.lines))
	copy(out, c.lines)
	return out
}

func waitFor(t *testing.T, c *collector, n int) []string {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if got := c.snapshot(); len(got) >= n {
			return got
		}
		time.Sleep(20 * time.Millisecond)
	}
	return c.snapshot()
}

func TestTailFromStartAndAppend(t *testing.T) {
	dir := t.TempDir()
	logPath := filepath.Join(dir, "app.log")
	if err := os.WriteFile(logPath, []byte("line1\nline2\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	tailer, err := New(Options{
		Globs:        []string{filepath.Join(dir, "*.log")},
		StateDir:     filepath.Join(dir, "state"),
		FromStart:    true,
		PollInterval: 30 * time.Millisecond,
	})
	if err != nil {
		t.Fatal(err)
	}
	c := &collector{}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	defer func() { cancel(); <-done }()
	go func() { defer close(done); _ = tailer.Run(ctx, c.add) }()

	got := waitFor(t, c, 2)
	if len(got) < 2 || got[0] != "line1" || got[1] != "line2" {
		t.Fatalf("from-start: got %v, want [line1 line2]", got)
	}

	// Append after attach — the poller should pick up only the new complete line.
	f, _ := os.OpenFile(logPath, os.O_APPEND|os.O_WRONLY, 0o644)
	_, _ = f.WriteString("line3\npartial")
	_ = f.Close()

	got = waitFor(t, c, 3)
	if len(got) < 3 || got[2] != "line3" {
		t.Fatalf("append: got %v, want line3 at [2] (partial not yet emitted)", got)
	}
	// A trailing partial (no newline) must NOT be emitted until it completes.
	for _, l := range got {
		if l == "partial" {
			t.Error("partial line emitted before its newline arrived")
		}
	}

	// Complete the partial line on a later poll — it must be emitted exactly once.
	f, _ = os.OpenFile(logPath, os.O_APPEND|os.O_WRONLY, 0o644)
	_, _ = f.WriteString("-done\n")
	_ = f.Close()

	got = waitFor(t, c, 4)
	count := 0
	for _, l := range got {
		if l == "partial-done" {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("partial-done emitted %d times, want exactly 1 (got %v)", count, got)
	}
}

// TestTailDoesNotReplayExistingFileOnSecondPoll is bug 1's reproduction: an
// untracked file with no new bytes must persist its start-at-EOF offset on
// first sight, or the next poll re-derives start=0 and replays the file.
func TestTailDoesNotReplayExistingFileOnSecondPoll(t *testing.T) {
	dir := t.TempDir()
	logPath := filepath.Join(dir, "app.log")
	if err := os.WriteFile(logPath, []byte("old1\nold2\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	tailer, err := New(Options{
		Globs:        []string{filepath.Join(dir, "*.log")},
		StateDir:     filepath.Join(dir, "state"),
		FromStart:    false, // start at EOF — pre-existing lines must never ship
		PollInterval: 20 * time.Millisecond,
	})
	if err != nil {
		t.Fatal(err)
	}
	c := &collector{}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	defer func() { cancel(); <-done }()
	go func() { defer close(done); _ = tailer.Run(ctx, c.add) }()

	// Sit through several poll intervals with no growth — the bug replayed the
	// whole file starting on the second poll.
	time.Sleep(200 * time.Millisecond)
	if got := c.snapshot(); len(got) != 0 {
		t.Fatalf("existing file replayed: got %v, want none", got)
	}

	// New content afterward must still ship normally.
	f, _ := os.OpenFile(logPath, os.O_APPEND|os.O_WRONLY, 0o644)
	_, _ = f.WriteString("new1\n")
	_ = f.Close()
	got := waitFor(t, c, 1)
	if len(got) != 1 || got[0] != "new1" {
		t.Fatalf("append after quiet period: got %v, want [new1]", got)
	}
}

// TestScanFromTruncatesOverLongLine is bug 2's core case: an over-long line
// whose terminating newline arrives within the same read is capped at
// maxLine bytes plus a marker, not accumulated without bound.
func TestScanFromTruncatesOverLongLine(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "big.log")
	huge := bytes.Repeat([]byte("x"), maxLine*2+123)
	content := append(append([]byte{}, huge...), []byte("\nshort\n")...)
	if err := os.WriteFile(path, content, 0o644); err != nil {
		t.Fatal(err)
	}
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	var lines [][]byte
	consumed, partial, truncated := scanFrom(f, nil, false, func(line []byte) {
		out := make([]byte, len(line))
		copy(out, line)
		lines = append(lines, out)
	})
	if truncated {
		t.Fatal("truncated should reset to false once the line's newline is consumed")
	}
	if len(partial) != 0 {
		t.Fatalf("partial should be empty after a complete line, got %d bytes", len(partial))
	}
	if consumed != int64(len(content)) {
		t.Fatalf("consumed = %d, want %d", consumed, len(content))
	}
	if len(lines) != 2 {
		t.Fatalf("got %d lines, want 2", len(lines))
	}
	want := append(bytes.Repeat([]byte("x"), maxLine), truncatedMarker...)
	if !bytes.Equal(lines[0], want) {
		t.Fatalf("truncated line mismatch: got %d bytes, want %d bytes", len(lines[0]), len(want))
	}
	if string(lines[1]) != "short" {
		t.Fatalf("second line = %q, want short", lines[1])
	}
}

// TestScanFromCarriesTruncatedLineAcrossPolls covers the case the original
// bug dropped entirely: an over-long line whose newline only arrives on a
// later poll. The partial state must stay bounded (not grow per overflow)
// and the truncated line must be emitted exactly once, not lost.
func TestScanFromCarriesTruncatedLineAcrossPolls(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "big2.log")
	huge := bytes.Repeat([]byte("y"), maxLine*3)
	if err := os.WriteFile(path, huge, 0o644); err != nil {
		t.Fatal(err)
	}
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	var lines [][]byte
	collect := func(line []byte) {
		out := make([]byte, len(line))
		copy(out, line)
		lines = append(lines, out)
	}

	consumed1, partial1, truncated1 := scanFrom(f, nil, false, collect)
	if len(lines) != 0 {
		t.Fatalf("no newline yet — nothing should be emitted, got %d lines", len(lines))
	}
	if !truncated1 {
		t.Fatal("expected truncated=true after exceeding maxLine with no newline")
	}
	if cap(partial1) > maxLine+len(truncatedMarker) {
		t.Fatalf("partial grew unbounded: cap=%d (want <= %d)", cap(partial1), maxLine+len(truncatedMarker))
	}
	// Any still-unconsumed sub-cap tail is intentionally left unread (no newline,
	// under the overflow threshold) — the next poll's Seek(consumed1) re-reads it
	// from disk, so nothing is lost even though consumed1 < len(huge).
	if consumed1 <= 0 || consumed1 > int64(len(huge)) {
		t.Fatalf("consumed1 = %d, want in (0, %d]", consumed1, len(huge))
	}

	// Next poll: the newline (and a following line) finally arrives.
	f2, _ := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0o644)
	_, _ = f2.WriteString("\nnext\n")
	_ = f2.Close()
	if _, err := f.Seek(consumed1, 0); err != nil {
		t.Fatal(err)
	}
	_, partial2, truncated2 := scanFrom(f, partial1, truncated1, collect)
	if truncated2 {
		t.Fatal("truncated should reset to false once the line's newline is consumed")
	}
	if len(partial2) != 0 {
		t.Fatalf("partial2 should be empty, got %d bytes", len(partial2))
	}
	if len(lines) != 2 {
		t.Fatalf("got %d lines, want 2 (truncated big line + next), got %v", len(lines), lines)
	}
	want := append(bytes.Repeat([]byte("y"), maxLine), truncatedMarker...)
	if !bytes.Equal(lines[0], want) {
		t.Fatalf("emitted truncated line mismatch (len got=%d want=%d)", len(lines[0]), len(want))
	}
	if string(lines[1]) != "next" {
		t.Fatalf("second line = %q, want next", lines[1])
	}
}

func TestTailResumesFromOffset(t *testing.T) {
	dir := t.TempDir()
	logPath := filepath.Join(dir, "app.log")
	stateDir := filepath.Join(dir, "state")
	os.WriteFile(logPath, []byte("a\nb\n"), 0o644)

	// First run consumes a,b and persists the offset.
	t1, _ := New(Options{Globs: []string{logPath}, StateDir: stateDir, FromStart: true, PollInterval: 20 * time.Millisecond})
	c1 := &collector{}
	ctx1, cancel1 := context.WithCancel(context.Background())
	done1 := make(chan struct{})
	go func() { defer close(done1); _ = t1.Run(ctx1, c1.add) }()
	waitFor(t, c1, 2)
	cancel1()
	<-done1 // Run does a final saveState on ctx cancel — offset is now persisted

	// Append, then a fresh tailer with the SAME state dir must resume — not replay.
	f, _ := os.OpenFile(logPath, os.O_APPEND|os.O_WRONLY, 0o644)
	f.WriteString("c\n")
	f.Close()

	t2, _ := New(Options{Globs: []string{logPath}, StateDir: stateDir, PollInterval: 20 * time.Millisecond})
	c2 := &collector{}
	ctx2, cancel2 := context.WithCancel(context.Background())
	done2 := make(chan struct{})
	defer func() { cancel2(); <-done2 }()
	go func() { defer close(done2); _ = t2.Run(ctx2, c2.add) }()

	got := waitFor(t, c2, 1)
	if len(got) != 1 || got[0] != "c" {
		t.Fatalf("resume: got %v, want only [c] (a,b already consumed in run 1)", got)
	}
}
