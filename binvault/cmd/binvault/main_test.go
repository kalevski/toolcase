package main

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestParseCommand(t *testing.T) {
	for _, c := range []struct {
		args []string
		sub  string
		rest []string
	}{
		{nil, "run", nil},
		{[]string{"run"}, "run", []string{}},
		{[]string{"validate", "--deep"}, "validate", []string{"--deep"}},
		{[]string{"--help"}, "help", []string{"--help"}},
		{[]string{"-h"}, "help", []string{"-h"}},
		{[]string{"-help"}, "help", []string{"-help"}},
		{[]string{"help"}, "help", []string{}},
		{[]string{"run", "-h"}, "help", []string{"-h"}},
		{[]string{"validate", "--deep", "--help"}, "help", []string{"--deep", "--help"}},
		{[]string{"version", "-h"}, "help", []string{"-h"}},
		{[]string{"serve"}, "serve", []string{}}, // not a command: main answers it with the usage and exit 2
	} {
		sub, rest := parseCommand(c.args)
		if sub != c.sub || len(rest) != len(c.rest) {
			t.Errorf("%v: got %q %v, want %q %v", c.args, sub, rest, c.sub, c.rest)
		}
	}
}

func env(extra ...string) []string {
	return append([]string{
		"BINVAULT_ADMIN_TOKEN=" + strings.Repeat("a", 40),
		"BINVAULT_MASTER_KEY=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
	}, extra...)
}

// The boot warnings go through the process logger, so BINVAULT_LOG_FORMAT=json is JSON on every
// line (spec §2.3, §9.1); in logfmt they are logfmt lines.
func TestBootWarningsFollowTheLogFormat(t *testing.T) {
	var out bytes.Buffer
	cfg, _, code := loadConfigFrom(env("BINVAULT_LOG_FORMAT=json", "BINVAULT_LISTNE=:1", "BINVAULT_CLUSTER_KEY=x"), &out)
	if cfg == nil || code != 0 {
		t.Fatalf("%v %d: %s", cfg, code, out.String())
	}
	lines := strings.Split(strings.TrimSpace(out.String()), "\n")
	if len(lines) != 2 {
		t.Fatalf("want the two warnings, got %q", out.String())
	}
	for _, l := range lines {
		var rec map[string]any
		if err := json.Unmarshal([]byte(l), &rec); err != nil {
			t.Fatalf("a warning is not JSON: %q", l)
		}
		if rec["level"] != "WARN" || rec["warning"] == nil {
			t.Errorf("%v", rec)
		}
	}
	if !strings.Contains(lines[0], "BINVAULT_LISTNE") || !strings.Contains(lines[1], "BINVAULT_CLUSTER_KEY") {
		t.Errorf("%q", lines)
	}

	out.Reset()
	if cfg, _, _ := loadConfigFrom(env("BINVAULT_LISTNE=:1"), &out); cfg == nil {
		t.Fatal("not loaded")
	}
	if got := out.String(); !strings.Contains(got, "level=WARN") || !strings.Contains(got, "BINVAULT_LISTNE") || strings.HasPrefix(got, "{") {
		t.Errorf("logfmt warning: %q", got)
	}

	// the level applies to them like to any other line
	out.Reset()
	if cfg, _, _ := loadConfigFrom(env("BINVAULT_LISTNE=:1", "BINVAULT_LOG_LEVEL=error"), &out); cfg == nil || out.Len() != 0 {
		t.Errorf("a warning at log level error: %q", out.String())
	}
}

// A configuration that does not load is reported as a JSON line when json logging is asked for, and as
// the readable multi-line text otherwise; the exit code is 2 either way.
func TestConfigurationErrorsFollowTheLogFormat(t *testing.T) {
	var out bytes.Buffer
	cfg, _, code := loadConfigFrom([]string{"BINVAULT_ADMIN_TOKEN=short", "BINVAULT_LOG_FORMAT=json"}, &out)
	if cfg != nil || code != 2 {
		t.Fatalf("%v %d", cfg, code)
	}
	var rec map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(out.Bytes()), &rec); err != nil || rec["level"] != "ERROR" || !strings.Contains(rec["error"].(string), "BINVAULT_ADMIN_TOKEN") {
		t.Fatalf("not a JSON error line: %q (%v)", out.String(), err)
	}

	out.Reset()
	cfg, _, code = loadConfigFrom([]string{"BINVAULT_ADMIN_TOKEN=short"}, &out)
	if cfg != nil || code != 2 || !strings.HasPrefix(out.String(), "configuration error:\n") {
		t.Fatalf("%v %d %q", cfg, code, out.String())
	}
}
