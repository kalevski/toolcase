package logship

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// ── filter grammar (mirrors nginxpilot/internal/logship filter spec, G13) ────────

func mustCompile(t *testing.T, raw map[string][]string, profile map[string]fieldSpec) *Filter {
	t.Helper()
	f, err := CompileFilter(raw, profile)
	if err != nil {
		t.Fatalf("CompileFilter(%v): %v", raw, err)
	}
	return f
}

func TestFilterAppFields(t *testing.T) {
	f := mustCompile(t, map[string][]string{"level": {"warn", "error"}}, FieldsApp)
	if !f.Match(&Entry{F: Fields{Level: "error"}}) {
		t.Error("error should match {warn,error}")
	}
	if f.Match(&Entry{F: Fields{Level: "info"}}) {
		t.Error("info should not match {warn,error}")
	}

	// AND across fields, OR within.
	f = mustCompile(t, map[string][]string{"level": {"error"}, "stream": {"stderr"}}, FieldsApp)
	if !f.Match(&Entry{F: Fields{Level: "error", Stream: "stderr"}}) {
		t.Error("error+stderr should match")
	}
	if f.Match(&Entry{F: Fields{Level: "error", Stream: "stdout"}}) {
		t.Error("error+stdout should fail the stream AND")
	}
}

func TestFilterNegationAndGlob(t *testing.T) {
	// message glob with '*' crosses everything; leading ! negates.
	f := mustCompile(t, map[string][]string{"message": {"*timeout*"}}, FieldsApp)
	if !f.Match(&Entry{F: Fields{Message: "upstream timeout after 5s"}}) {
		t.Error("glob *timeout* should match")
	}
	f = mustCompile(t, map[string][]string{"message": {"!*healthz*"}}, FieldsApp)
	if f.Match(&Entry{F: Fields{Message: "GET /healthz 200"}}) {
		t.Error("negation should exclude healthz")
	}
	if !f.Match(&Entry{F: Fields{Message: "GET /api 200"}}) {
		t.Error("only-negative field means everything-except")
	}
}

func TestFilterStatusAndPathNoSep(t *testing.T) {
	f := mustCompile(t, map[string][]string{"status": {"4xx", ">=500"}}, FieldsAccess)
	for _, code := range []int{404, 500, 503} {
		if !f.Match(&Entry{F: Fields{Status: code}}) {
			t.Errorf("status %d should match {4xx,>=500}", code)
		}
	}
	if f.Match(&Entry{F: Fields{Status: 200}}) {
		t.Error("200 should not match")
	}

	// path glob: '*' does NOT cross '/'.
	f = mustCompile(t, map[string][]string{"path": {"/api/*"}}, FieldsAccess)
	if !f.Match(&Entry{F: Fields{Path: "/api/users"}}) {
		t.Error("/api/users should match /api/*")
	}
	if f.Match(&Entry{F: Fields{Path: "/api/users/1"}}) {
		t.Error("/api/users/1 should NOT match /api/* (no cross-slash)")
	}
}

func TestFilterUnknownField(t *testing.T) {
	if _, err := CompileFilter(map[string][]string{"bogus": {"x"}}, FieldsApp); err == nil {
		t.Error("unknown field should be a compile error")
	}
	if _, err := CompileFilter(map[string][]string{"level": {}}, FieldsApp); err == nil {
		t.Error("empty matcher list should be a compile error")
	}
}

func TestFilterAllProfile(t *testing.T) {
	// FieldsAll accepts both app and access fields.
	if _, err := CompileFilter(map[string][]string{"level": {"error"}, "status": {"5xx"}}, FieldsAll); err != nil {
		t.Errorf("FieldsAll should accept level+status: %v", err)
	}
}

// ── entry parsing + level normalization (G25) ────────────────────────────────────

func TestParseLineJSON(t *testing.T) {
	e := ParseLine([]byte(`{"level":"WARN","msg":"disk low","stream":"stdout"}`), ParseOptions{})
	if e.ParseError {
		t.Fatal("valid JSON should not be a parse error")
	}
	if e.F.Level != "warn" {
		t.Errorf("level = %q, want warn (normalized)", e.F.Level)
	}
	if e.F.Message != "disk low" {
		t.Errorf("message = %q", e.F.Message)
	}
}

func TestParseLineRawWrap(t *testing.T) {
	e := ParseLine([]byte("plain text line"), ParseOptions{Stream: "stderr"})
	if !e.ParseError {
		t.Error("non-JSON should be a parse error (raw-wrapped)")
	}
	var obj map[string]any
	if err := json.Unmarshal(e.Raw, &obj); err != nil {
		t.Fatalf("wrapped line must be valid JSON: %v", err)
	}
	if obj["raw"] != "plain text line" || obj["parse_error"] != true || obj["stream"] != "stderr" {
		t.Errorf("wrapped shape wrong: %v", obj)
	}
	if e.F.Stream != "stderr" {
		t.Errorf("stream field = %q, want stderr", e.F.Stream)
	}
}

func TestParseLineForceRaw(t *testing.T) {
	e := ParseLine([]byte(`{"level":"info"}`), ParseOptions{Raw: true})
	if !e.ParseError {
		t.Error("Raw:true should wrap even valid JSON")
	}
}

func TestNormalizeLevel(t *testing.T) {
	cases := map[string]string{
		"WARN": "warn", "warning": "warn", "30": "warn",
		"err": "error", "ERROR": "error", "40": "error",
		"fatal": "fatal", "panic": "fatal", "critical": "fatal",
		"trace": "debug", "10": "debug",
		"info": "info", "notice": "info",
		"weird": "weird", // unmapped passes through lowercased
		"":      "",
	}
	for in, want := range cases {
		if got := NormalizeLevel(in); got != want {
			t.Errorf("NormalizeLevel(%q) = %q, want %q", in, got, want)
		}
	}
}

// ── parse templates (plain-text → structured JSON) ───────────────────────────────

func TestTemplateParsesToJSON(t *testing.T) {
	tmpl, err := CompileTemplate("{level} | {time} - {message}")
	if err != nil {
		t.Fatalf("CompileTemplate: %v", err)
	}
	e := ParseLine([]byte("info | 12:20 - hello I'm a log"), ParseOptions{Templates: []*Template{tmpl}})
	if e.ParseError {
		t.Fatal("template match should not be a parse error")
	}
	if e.F.Level != "info" {
		t.Errorf("level = %q, want info", e.F.Level)
	}
	if e.F.Message != "hello I'm a log" {
		t.Errorf("message = %q, want the full trailing text", e.F.Message)
	}
	var obj map[string]any
	if err := json.Unmarshal(e.Raw, &obj); err != nil {
		t.Fatalf("Raw must be valid JSON: %v", err)
	}
	if obj["level"] != "info" || obj["time"] != "12:20" || obj["message"] != "hello I'm a log" {
		t.Errorf("rebuilt JSON wrong: %v", obj)
	}
}

func TestTemplateFallThroughAndFirstMatch(t *testing.T) {
	a, _ := CompileTemplate("{level}: {message}")
	b, _ := CompileTemplate("{level} | {message}")
	// First matching template wins.
	e := ParseLine([]byte("warn | disk low"), ParseOptions{Templates: []*Template{a, b}})
	if e.F.Level != "warn" || e.F.Message != "disk low" {
		t.Errorf("second template should match: level=%q message=%q", e.F.Level, e.F.Message)
	}
	// No template matches → raw-wrap fallback (never dropped).
	e = ParseLine([]byte("totally unstructured"), ParseOptions{Templates: []*Template{a}})
	if !e.ParseError {
		t.Error("non-matching line should raw-wrap")
	}
	// JSON still wins over templates.
	e = ParseLine([]byte(`{"level":"error"}`), ParseOptions{Templates: []*Template{a}})
	if e.ParseError || e.F.Level != "error" {
		t.Error("valid JSON should parse as JSON, not via template")
	}
}

func TestTemplateNormalizesLevelAndStatus(t *testing.T) {
	tmpl, _ := CompileTemplate("{level} {status} {message}")
	e := ParseLine([]byte("WARNING 503 upstream down"), ParseOptions{Templates: []*Template{tmpl}})
	if e.F.Level != "warn" {
		t.Errorf("level = %q, want warn (normalized)", e.F.Level)
	}
	if e.F.Status != 503 {
		t.Errorf("status = %d, want 503 (typed int)", e.F.Status)
	}
	// A status filter then works on the template-derived field.
	f, _ := CompileFilter(map[string][]string{"status": {"5xx"}}, FieldsAccess)
	if !f.Match(&e) {
		t.Error("status filter should match the template-parsed 503")
	}
}

func TestCompileTemplateErrors(t *testing.T) {
	for _, bad := range []string{"", "no fields here", "{a}{b}", "{bad-name}", "{unclosed"} {
		if _, err := CompileTemplate(bad); err == nil {
			t.Errorf("CompileTemplate(%q) should error", bad)
		}
	}
}

// ── shipper against a fake Loki (batch shape, filter, retry) — G30 ────────────────

func drainLoki(t *testing.T) (*httptest.Server, *[]lokiPush, *sync.Mutex) {
	t.Helper()
	var mu sync.Mutex
	var pushes []lokiPush
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var p lokiPush
		_ = json.Unmarshal(body, &p)
		mu.Lock()
		pushes = append(pushes, p)
		mu.Unlock()
		w.WriteHeader(http.StatusNoContent)
	}))
	return srv, &pushes, &mu
}

func TestShipperLokiBatchAndFilter(t *testing.T) {
	srv, pushes, mu := drainLoki(t)
	defer srv.Close()

	filter, _ := CompileFilter(map[string][]string{"level": {"error"}}, FieldsApp)
	sh := NewShipper(nil)
	sh.Configure([]Destination{{
		Name:          "loki",
		Type:          DestLoki,
		URL:           srv.URL,
		Labels:        Labels{Static: map[string]string{"job": "app"}, Dynamic: map[string]string{"level": "level"}},
		Filter:        filter,
		BatchSize:     2,
		FlushInterval: 20 * time.Millisecond,
	}})
	defer sh.Close()

	sh.Dispatch(ParseLine([]byte(`{"level":"error","msg":"boom"}`), ParseOptions{}))
	sh.Dispatch(ParseLine([]byte(`{"level":"info","msg":"noise"}`), ParseOptions{}))  // filtered out
	sh.Dispatch(ParseLine([]byte(`{"level":"error","msg":"boom2"}`), ParseOptions{})) // reaches batch size 2

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		mu.Lock()
		n := len(*pushes)
		mu.Unlock()
		if n > 0 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	mu.Lock()
	defer mu.Unlock()
	if len(*pushes) == 0 {
		t.Fatal("expected at least one Loki push")
	}
	var shipped int
	for _, p := range *pushes {
		for _, s := range p.Streams {
			if s.Stream["job"] != "app" || s.Stream["level"] != "error" {
				t.Errorf("unexpected stream labels: %v", s.Stream)
			}
			shipped += len(s.Values)
		}
	}
	if shipped != 2 {
		t.Errorf("shipped %d error lines, want 2 (info filtered out)", shipped)
	}
}

func TestShipperRetriesOn429(t *testing.T) {
	var mu sync.Mutex
	attempts := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.ReadAll(r.Body)
		mu.Lock()
		attempts++
		n := attempts
		mu.Unlock()
		if n == 1 {
			w.Header().Set("Retry-After", "0")
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer srv.Close()

	sh := NewShipper(nil)
	sh.Configure([]Destination{{
		Name: "http", Type: DestHTTP, URL: srv.URL, BatchSize: 1, FlushInterval: 20 * time.Millisecond, MaxRetries: 3,
	}})
	defer sh.Close()
	sh.Dispatch(ParseLine([]byte("hello"), ParseOptions{}))

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		mu.Lock()
		n := attempts
		mu.Unlock()
		if n >= 2 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	mu.Lock()
	defer mu.Unlock()
	if attempts < 2 {
		t.Errorf("expected a retry after 429, got %d attempt(s)", attempts)
	}
}

func TestHTTPSinkNDJSONBody(t *testing.T) {
	var mu sync.Mutex
	var got string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		mu.Lock()
		got = string(b)
		mu.Unlock()
		if r.Header.Get("X-QK-Batch-ID") == "" {
			t.Error("missing X-QK-Batch-ID dedupe header")
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	sh := NewShipper(nil)
	sh.Configure([]Destination{{Name: "c", Type: DestHTTP, URL: srv.URL, BatchSize: 2, FlushInterval: 10 * time.Millisecond}})
	defer sh.Close()
	sh.Dispatch(ParseLine([]byte(`{"a":1}`), ParseOptions{}))
	sh.Dispatch(ParseLine([]byte(`{"b":2}`), ParseOptions{}))

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		mu.Lock()
		done := got != ""
		mu.Unlock()
		if done {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	mu.Lock()
	defer mu.Unlock()
	if lines := strings.Count(strings.TrimSpace(got), "\n") + 1; lines != 2 {
		t.Errorf("expected 2 NDJSON lines, got %d: %q", lines, got)
	}
}
