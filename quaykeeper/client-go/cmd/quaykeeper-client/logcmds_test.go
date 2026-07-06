package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/quaykeeper-client/internal/logship"
)

// TestPumpCapturesAndTees verifies the run-supervisor's core: every child line is
// teed VERBATIM to the real fd (so `docker logs` is unaffected) AND shipped.
func TestPumpCapturesAndTees(t *testing.T) {
	dir := t.TempDir()
	out := filepath.Join(dir, "shipped.ndjson")

	sh := logship.NewShipper(nil)
	sh.Configure([]logship.Destination{{
		Name: "file", Type: logship.DestFile, Path: out, BatchSize: 1, FlushInterval: 10 * time.Millisecond,
	}})

	ingest := func(line []byte, stream string) {
		sh.Dispatch(logship.ParseLine(line, logship.ParseOptions{Stream: stream}))
	}
	input := "hello plain\n" + `{"level":"error","msg":"boom"}` + "\n" + "no trailing newline"
	var tee bytes.Buffer
	pump(strings.NewReader(input), &tee, "stdout", ingest)
	sh.Close() // flush buffered batches

	// Tee preserves each line + a newline (the partial last line is flushed too, G23).
	teeStr := tee.String()
	for _, want := range []string{"hello plain\n", `{"level":"error","msg":"boom"}` + "\n", "no trailing newline\n"} {
		if !strings.Contains(teeStr, want) {
			t.Errorf("tee missing %q; got %q", want, teeStr)
		}
	}

	body, err := os.ReadFile(out)
	if err != nil {
		t.Fatalf("read shipped file: %v", err)
	}
	lines := strings.Split(strings.TrimSpace(string(body)), "\n")
	if len(lines) != 3 {
		t.Fatalf("shipped %d lines, want 3:\n%s", len(lines), body)
	}
	// The plain lines are raw-wrapped with the stream stamp; the JSON line passes through.
	if !strings.Contains(lines[0], `"raw":"hello plain"`) || !strings.Contains(lines[0], `"stream":"stdout"`) {
		t.Errorf("line 0 not raw-wrapped with stream: %s", lines[0])
	}
	if !strings.Contains(lines[1], `"level":"error"`) {
		t.Errorf("line 1 should be the passthrough JSON: %s", lines[1])
	}
}

func TestSplitList(t *testing.T) {
	got := splitList("/a/*.log, /b/*.log ,, /c.log")
	want := []string{"/a/*.log", "/b/*.log", "/c.log"}
	if len(got) != len(want) {
		t.Fatalf("splitList = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("splitList[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}
