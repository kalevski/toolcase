package logship

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

const sampleLine = `{"ts":"2026-07-06T10:00:00+00:00","host":"api.example.com","server_name":"api.example.com","remote_addr":"203.0.113.7","method":"GET","path":"/api/users","query":"page=2&token=supersecret","status":200,"bytes_sent":512,"request_time":0.012,"upstream_time":"0.010","upstream_addr":"127.0.0.1:3000","scheme":"https","protocol":"HTTP/2.0","referer":"","user_agent":"curl/8.0","resource":"api.example.com","resource_type":"proxy"}`

func TestParseAccessLineFastPath(t *testing.T) {
	e := ParseAccessLine([]byte(sampleLine), ParseOptions{RedactParams: []string{}})
	if e.ParseError {
		t.Fatal("unexpected parse error")
	}
	if e.F.Host != "api.example.com" || e.F.Method != "GET" || e.F.Status != 200 ||
		e.F.Path != "/api/users" || e.F.Resource != "api.example.com" || e.F.ResourceType != "proxy" {
		t.Errorf("fast-path fields wrong: %+v", e.F)
	}
	want := time.Date(2026, 7, 6, 10, 0, 0, 0, time.UTC)
	if !e.TS.Equal(want) {
		t.Errorf("TS = %v, want %v", e.TS, want)
	}
	// Redaction off (empty deny-list) → raw preserved byte-for-byte.
	if string(e.Raw) != sampleLine {
		t.Error("raw line changed with redaction disabled")
	}
}

func TestParseAccessLineRedactsQuery(t *testing.T) {
	e := ParseAccessLine([]byte(sampleLine), ParseOptions{}) // nil = default deny-list
	var m map[string]any
	if err := json.Unmarshal(e.Raw, &m); err != nil {
		t.Fatalf("redacted line is not JSON: %v", err)
	}
	q := m["query"].(string)
	if strings.Contains(q, "supersecret") {
		t.Errorf("token value leaked: %q", q)
	}
	if !strings.Contains(q, "page=2") || !strings.Contains(q, "token="+redactedValue) {
		t.Errorf("query = %q, want page preserved and token redacted", q)
	}
	// Untouched fields survive the rewrite.
	if m["upstream_time"] != "0.010" || m["status"].(float64) != 200 {
		t.Error("rewrite lost unrelated fields")
	}
}

func TestParseAccessLineAnonymizeIP(t *testing.T) {
	e := ParseAccessLine([]byte(sampleLine), ParseOptions{RedactParams: []string{}, AnonymizeIP: true})
	var m map[string]any
	_ = json.Unmarshal(e.Raw, &m)
	if m["remote_addr"] != "203.0.113.0" {
		t.Errorf("remote_addr = %v, want 203.0.113.0", m["remote_addr"])
	}
}

func TestAnonymizeIPv6(t *testing.T) {
	got, ok := anonymizeIP("2001:db8:1:2:3:4:5:6")
	if !ok || got != "2001:db8:1::" {
		t.Errorf("anonymizeIP v6 = %q %v", got, ok)
	}
}

func TestParseAccessLineGarbage(t *testing.T) {
	for _, raw := range []string{
		"not json at all",
		`{"ts":"2026-07-06T10:00:00+00:00","host":"api.example.com","truncated`,
		"",
		`<190>Jul  6 10:00:00 host nginx: nothing`,
	} {
		e := ParseAccessLine([]byte(raw), ParseOptions{})
		if !e.ParseError {
			t.Errorf("%q: expected parse_error", raw)
		}
		var m map[string]any
		if err := json.Unmarshal(e.Raw, &m); err != nil {
			t.Fatalf("wrapped line is not JSON: %v", err)
		}
		if m["parse_error"] != true || m["raw"] != raw {
			t.Errorf("wrap shape wrong: %v", m)
		}
	}
}

func TestStripSyslogHeader(t *testing.T) {
	dgram := []byte(`<190>Jul  6 10:00:00 edge-1 nginxpilot: {"status":200}`)
	if got := string(stripSyslogHeader(dgram)); got != `{"status":200}` {
		t.Errorf("stripSyslogHeader = %q", got)
	}
	// No JSON payload → passed through whole (becomes a parse_error entry).
	if got := string(stripSyslogHeader([]byte("garbage"))); got != "garbage" {
		t.Errorf("stripSyslogHeader passthrough = %q", got)
	}
}

func TestRedactQueryEncodedName(t *testing.T) {
	got, changed := redactQuery("a=1&TOKEN=x&api%5Fkey=y", DefaultRedactParams)
	if !changed {
		t.Fatal("expected change")
	}
	if strings.Contains(got, "=x") || strings.Contains(got, "=y") {
		t.Errorf("redactQuery = %q, secrets leaked", got)
	}
	if !strings.HasPrefix(got, "a=1&") {
		t.Errorf("redactQuery = %q, clean param mangled", got)
	}
}
