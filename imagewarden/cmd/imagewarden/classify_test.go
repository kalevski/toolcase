package main

import (
	"os"
	"path/filepath"
	"testing"
)

// withDevNullStdio silences stdout+stderr for the duration of fn so the usage
// and error lines cmdClassify prints don't clutter test output, restoring the
// originals afterward.
func withDevNullStdio(t *testing.T, fn func()) {
	t.Helper()
	devnull, err := os.OpenFile(os.DevNull, os.O_WRONLY, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer devnull.Close()
	origOut, origErr := os.Stdout, os.Stderr
	os.Stdout, os.Stderr = devnull, devnull
	defer func() { os.Stdout, os.Stderr = origOut, origErr }()
	fn()
}

// TestCmdClassifyNoFilesUsageError checks the zero-files guard: with no
// positional file paths, classify is a usage error and returns 2 (spec §7),
// before any config or model work.
func TestCmdClassifyNoFilesUsageError(t *testing.T) {
	var code int
	withDevNullStdio(t, func() { code = cmdClassify(nil) })
	if code != 2 {
		t.Fatalf("cmdClassify with no files = %d, want 2", code)
	}
}

// TestCmdClassifyBadConfigPath checks the config-error path. An explicit
// --config that doesn't exist is a hard error (config.Load only tolerates a
// missing file at DefaultPath), caught before buildService loads the model — so
// this exercises the offline failure path without needing libonnxruntime.
func TestCmdClassifyBadConfigPath(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "nope.yml")
	var code int
	withDevNullStdio(t, func() {
		code = cmdClassify([]string{"--config", missing, "some.jpg"})
	})
	if code != 1 {
		t.Fatalf("cmdClassify with missing --config = %d, want 1", code)
	}
}
