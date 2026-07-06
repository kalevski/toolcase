package tail

import (
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
