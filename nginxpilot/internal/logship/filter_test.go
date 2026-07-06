package logship

import (
	"strings"
	"testing"
)

// entryWith builds a test entry from a field map (status via "status" key as int).
func entryWith(fields map[string]any) *Entry {
	e := &Entry{Raw: []byte("{}")}
	for k, v := range fields {
		switch k {
		case "host":
			e.F.Host = v.(string)
		case "server_name":
			e.F.ServerName = v.(string)
		case "method":
			e.F.Method = v.(string)
		case "path":
			e.F.Path = v.(string)
		case "scheme":
			e.F.Scheme = v.(string)
		case "resource":
			e.F.Resource = v.(string)
		case "resource_type":
			e.F.ResourceType = v.(string)
		case "user_agent":
			e.F.UserAgent = v.(string)
		case "level":
			e.F.Level = v.(string)
		case "stream":
			e.F.Stream = v.(string)
		case "status":
			e.F.Status = v.(int)
		case "raw":
			e.Raw = []byte(v.(string))
		}
	}
	return e
}

// TestFilterSpec is the table-tested filter grammar spec (log_ides.md §2.3,
// G13). It is the single source of truth for matcher semantics; other
// implementations (client-go) must copy this table.
func TestFilterSpec(t *testing.T) {
	cases := []struct {
		name   string
		filter map[string][]string
		entry  map[string]any
		want   bool
	}{
		// --- host: exact, glob, case-insensitivity ---
		{"host exact match", map[string][]string{"host": {"api.example.com"}}, map[string]any{"host": "api.example.com"}, true},
		{"host exact mismatch", map[string][]string{"host": {"api.example.com"}}, map[string]any{"host": "www.example.com"}, false},
		{"host case-insensitive", map[string][]string{"host": {"API.Example.COM"}}, map[string]any{"host": "api.example.com"}, true},
		{"host glob suffix", map[string][]string{"host": {"*.shop.example.com"}}, map[string]any{"host": "eu.shop.example.com"}, true},
		{"host glob crosses labels", map[string][]string{"host": {"*.example.com"}}, map[string]any{"host": "a.b.example.com"}, true},
		{"host glob no match", map[string][]string{"host": {"*.shop.example.com"}}, map[string]any{"host": "shop.example.com"}, false},
		{"host OR within field", map[string][]string{"host": {"a.example.com", "b.example.com"}}, map[string]any{"host": "b.example.com"}, true},
		{"host empty field fails positive", map[string][]string{"host": {"a.example.com"}}, map[string]any{}, false},

		// --- status: exact, class, comparison ---
		{"status exact", map[string][]string{"status": {"404"}}, map[string]any{"status": 404}, true},
		{"status exact mismatch", map[string][]string{"status": {"404"}}, map[string]any{"status": 403}, false},
		{"status class 4xx", map[string][]string{"status": {"4xx"}}, map[string]any{"status": 418}, true},
		{"status class 4xx excludes 500", map[string][]string{"status": {"4xx"}}, map[string]any{"status": 500}, false},
		{"status class OR", map[string][]string{"status": {"4xx", "5xx"}}, map[string]any{"status": 502}, true},
		{"status >=500", map[string][]string{"status": {">=500"}}, map[string]any{"status": 500}, true},
		{"status >=500 excludes 499", map[string][]string{"status": {">=500"}}, map[string]any{"status": 499}, false},
		{"status <400", map[string][]string{"status": {"<400"}}, map[string]any{"status": 302}, true},
		{"status >499", map[string][]string{"status": {">499"}}, map[string]any{"status": 500}, true},
		{"status <=299", map[string][]string{"status": {"<=299"}}, map[string]any{"status": 299}, true},

		// --- method / scheme / resource_type: exact set, case-insensitive ---
		{"method set match", map[string][]string{"method": {"GET", "POST"}}, map[string]any{"method": "POST"}, true},
		{"method set mismatch", map[string][]string{"method": {"GET", "POST"}}, map[string]any{"method": "DELETE"}, false},
		{"method case-insensitive", map[string][]string{"method": {"get"}}, map[string]any{"method": "GET"}, true},
		{"resource_type set", map[string][]string{"resource_type": {"proxy"}}, map[string]any{"resource_type": "proxy"}, true},
		{"scheme set", map[string][]string{"scheme": {"https"}}, map[string]any{"scheme": "http"}, false},

		// --- path: glob where '*' does NOT cross '/', negation ---
		{"path exact", map[string][]string{"path": {"/healthz"}}, map[string]any{"path": "/healthz"}, true},
		{"path glob single segment", map[string][]string{"path": {"/api/*"}}, map[string]any{"path": "/api/users"}, true},
		{"path glob does not cross slash", map[string][]string{"path": {"/api/*"}}, map[string]any{"path": "/api/users/42"}, false},
		{"path glob middle", map[string][]string{"path": {"/api/*/detail"}}, map[string]any{"path": "/api/users/detail"}, true},
		{"path glob middle no cross", map[string][]string{"path": {"/api/*/detail"}}, map[string]any{"path": "/api/a/b/detail"}, false},
		{"path case-sensitive", map[string][]string{"path": {"/API"}}, map[string]any{"path": "/api"}, false},
		{"path negation only = everything except", map[string][]string{"path": {"!/healthz", "!/metrics"}}, map[string]any{"path": "/api/users"}, true},
		{"path negation excludes", map[string][]string{"path": {"!/healthz", "!/metrics"}}, map[string]any{"path": "/metrics"}, false},
		{"path positive AND negative", map[string][]string{"path": {"/api/*", "!/api/internal"}}, map[string]any{"path": "/api/users"}, true},
		{"path negative beats positive", map[string][]string{"path": {"/api/*", "!/api/internal"}}, map[string]any{"path": "/api/internal"}, false},
		{"path escaped bang is literal", map[string][]string{"path": {`\!weird`}}, map[string]any{"path": "!weird"}, true},
		{"path escaped star is literal", map[string][]string{"path": {`/a\*b`}}, map[string]any{"path": "/a*b"}, true},
		{"path escaped star not wildcard", map[string][]string{"path": {`/a\*b`}}, map[string]any{"path": "/axb"}, false},

		// --- user_agent: glob, case-sensitive ---
		{"user_agent glob", map[string][]string{"user_agent": {"*Googlebot*"}}, map[string]any{"user_agent": "Mozilla/5.0 Googlebot/2.1"}, true},
		{"user_agent negation", map[string][]string{"user_agent": {"!*health-check*"}}, map[string]any{"user_agent": "kube-probe health-check"}, false},

		// --- resource ---
		{"resource exact", map[string][]string{"resource": {"api.example.com"}}, map[string]any{"resource": "api.example.com"}, true},
		{"resource glob absorbs literal star", map[string][]string{"resource": {"*.example.com"}}, map[string]any{"resource": "*.example.com"}, true},
		{"resource wildcard entity escaped", map[string][]string{"resource": {`\*.example.com`}}, map[string]any{"resource": "*.example.com"}, true},
		{"resource escaped star is exact", map[string][]string{"resource": {`\*.example.com`}}, map[string]any{"resource": "a.example.com"}, false},

		// --- AND across fields ---
		{"AND across fields both match", map[string][]string{"host": {"api.example.com"}, "status": {"5xx"}}, map[string]any{"host": "api.example.com", "status": 502}, true},
		{"AND across fields one fails", map[string][]string{"host": {"api.example.com"}, "status": {"5xx"}}, map[string]any{"host": "api.example.com", "status": 200}, false},

		// --- nil filter ---
		{"nil filter matches everything", nil, map[string]any{"host": "x", "status": 200}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f, err := CompileFilter(tc.filter, FieldsAccess)
			if err != nil {
				t.Fatalf("CompileFilter: %v", err)
			}
			if got := f.Match(entryWith(tc.entry)); got != tc.want {
				t.Errorf("Match = %v, want %v", got, tc.want)
			}
		})
	}
}

// TestFilterAppProfile covers the client-go field profile (level/stream/raw).
func TestFilterAppProfile(t *testing.T) {
	f, err := CompileFilter(map[string][]string{"level": {"warn", "error"}}, FieldsApp)
	if err != nil {
		t.Fatalf("CompileFilter: %v", err)
	}
	if !f.Match(entryWith(map[string]any{"level": "error"})) {
		t.Error("level error should match")
	}
	if f.Match(entryWith(map[string]any{"level": "info"})) {
		t.Error("level info should not match")
	}
	// raw glob
	f, err = CompileFilter(map[string][]string{"raw": {"*panic*"}}, FieldsApp)
	if err != nil {
		t.Fatalf("CompileFilter: %v", err)
	}
	if !f.Match(entryWith(map[string]any{"raw": "goroutine panic: boom"})) {
		t.Error("raw glob should match")
	}
}

// TestFilterCompileErrors pins the validation surface: unknown fields, empty
// lists, malformed matchers are all parse-time errors (400 at the API).
func TestFilterCompileErrors(t *testing.T) {
	cases := []struct {
		name    string
		filter  map[string][]string
		wantSub string
	}{
		{"unknown field", map[string][]string{"remote_addr": {"1.2.3.4"}}, "not filterable"},
		{"unknown field level in access profile", map[string][]string{"level": {"warn"}}, "not filterable"},
		{"empty matcher list", map[string][]string{"host": {}}, "must not be empty"},
		{"empty matcher", map[string][]string{"host": {""}}, "empty matcher"},
		{"bare bang", map[string][]string{"path": {"!"}}, "'!' needs a pattern"},
		{"bad status", map[string][]string{"status": {"6xx"}}, "must be an exact code"},
		{"bad status word", map[string][]string{"status": {"teapot"}}, "must be an exact code"},
		{"bad comparison", map[string][]string{"status": {">=9000"}}, "100..599"},
		{"trailing backslash", map[string][]string{"path": {`/a\`}}, `trailing '\'`},
		{"unknown escape", map[string][]string{"path": {`/a\b`}}, "unknown escape"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := CompileFilter(tc.filter, FieldsAccess)
			if err == nil {
				t.Fatal("expected error")
			}
			if !strings.Contains(err.Error(), tc.wantSub) {
				t.Errorf("error %q does not contain %q", err, tc.wantSub)
			}
		})
	}
}
