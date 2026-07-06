package logship

import (
	"encoding/json"
	"strconv"
	"strings"
	"time"
)

// Entry is one log line ready to ship: the raw bytes as they go on the wire plus
// the typed fast-path fields filters and labels read.
type Entry struct {
	Raw        []byte
	TS         time.Time
	F          Fields
	ParseError bool // did not parse as JSON — wrapped as {"raw":…,"parse_error":true}
}

// Fields are the typed fast-path fields extracted at intake. App logs populate
// Level/Stream/Message; a tailed nginx access log also populates the access fields.
type Fields struct {
	Level        string
	Stream       string
	Message      string
	Host         string
	ServerName   string
	Method       string
	Path         string
	Scheme       string
	Resource     string
	ResourceType string
	UserAgent    string
	Status       int
}

// Field returns a named field's string value for filtering / labeling.
func (e *Entry) Field(name string) (string, bool) {
	switch name {
	case "level":
		return e.F.Level, true
	case "stream":
		return e.F.Stream, true
	case "message":
		return e.F.Message, true
	case "raw":
		return string(e.Raw), true
	case "host":
		return e.F.Host, true
	case "server_name":
		return e.F.ServerName, true
	case "method":
		return e.F.Method, true
	case "path":
		return e.F.Path, true
	case "scheme":
		return e.F.Scheme, true
	case "resource":
		return e.F.Resource, true
	case "resource_type":
		return e.F.ResourceType, true
	case "user_agent":
		return e.F.UserAgent, true
	}
	return "", false
}

// ParseOptions tune line parsing at intake.
type ParseOptions struct {
	// Stream stamps the origin ("stdout"/"stderr") on every entry from this
	// source, unless the line's own JSON declares one.
	Stream string
	// Raw forces every line to be wrapped as {"raw":…} without attempting a JSON
	// parse (the `logs --format raw` mode: treat the app's output as opaque text).
	Raw bool
	// Templates are tried (in order, first match wins) on a line that isn't JSON,
	// turning "{level} | {message}"-style text into a structured JSON entry before
	// the raw-wrap fallback.
	Templates []*Template
	// Now injects the clock for tests.
	Now func() time.Time
}

func (o ParseOptions) now() time.Time {
	if o.Now != nil {
		return o.Now()
	}
	return time.Now()
}

// appLine mirrors the common JSON shapes emitted by app loggers and nginxpilot's
// access format. Field aliases are handled after unmarshal.
type appLine struct {
	Level     string `json:"level"`
	Lvl       string `json:"lvl"`
	Severity  string `json:"severity"`
	Stream    string `json:"stream"`
	Message   string `json:"message"`
	Msg       string `json:"msg"`
	TS        string `json:"ts"`
	Time      string `json:"time"`
	Timestamp string `json:"timestamp"`
	// nginx access fields (present when tailing nginxpilot's JSON access log)
	Host         string          `json:"host"`
	ServerName   string          `json:"server_name"`
	Method       string          `json:"method"`
	Path         string          `json:"path"`
	Scheme       string          `json:"scheme"`
	Resource     string          `json:"resource"`
	ResourceType string          `json:"resource_type"`
	UserAgent    string          `json:"user_agent"`
	Status       json.RawMessage `json:"status"`
}

// ParseLine turns one raw log line into an Entry. Valid JSON becomes a structured
// entry (enabling level/field filters); a non-JSON line is wrapped as
// {"raw":…,"parse_error":true,"stream":…} and still shipped — never dropped.
func ParseLine(raw []byte, opts ParseOptions) Entry {
	if opts.Raw {
		return wrapRaw(raw, opts)
	}
	trimmed := trimSpace(raw)
	var line appLine
	// JSON first (the common case for structured app logs + nginx access logs).
	if len(trimmed) > 0 && trimmed[0] == '{' && json.Unmarshal(trimmed, &line) == nil {
		return jsonEntry(raw, line, opts)
	}
	// Then any parse templates (plain-text → structured), first match wins.
	for _, t := range opts.Templates {
		if t == nil {
			continue
		}
		if e, ok := t.apply(raw, opts); ok {
			return e
		}
	}
	return wrapRaw(raw, opts)
}

// jsonEntry builds an Entry from a parsed JSON access/app line.
func jsonEntry(raw []byte, line appLine, opts ParseOptions) Entry {
	stream := firstNonEmpty(line.Stream, opts.Stream)
	e := Entry{
		Raw: raw,
		TS:  opts.now(),
		F: Fields{
			Level:        NormalizeLevel(firstNonEmpty(line.Level, line.Lvl, line.Severity)),
			Stream:       stream,
			Message:      firstNonEmpty(line.Message, line.Msg),
			Host:         line.Host,
			ServerName:   line.ServerName,
			Method:       line.Method,
			Path:         line.Path,
			Scheme:       line.Scheme,
			Resource:     line.Resource,
			ResourceType: line.ResourceType,
			UserAgent:    line.UserAgent,
			Status:       parseStatus(line.Status),
		},
	}
	if ts := firstNonEmpty(line.TS, line.Time, line.Timestamp); ts != "" {
		if t, err := time.Parse(time.RFC3339, ts); err == nil {
			e.TS = t
		}
	}
	return e
}

// wrapRaw wraps a non-JSON line so it still ships as valid JSON, preserving the
// origin stream so a `stream` filter still works on plain-text output.
func wrapRaw(raw []byte, opts ParseOptions) Entry {
	obj := map[string]any{"raw": string(trimNewline(raw)), "parse_error": true}
	if opts.Stream != "" {
		obj["stream"] = opts.Stream
	}
	wrapped, err := json.Marshal(obj)
	if err != nil {
		wrapped = []byte(`{"parse_error":true}`)
	}
	return Entry{Raw: wrapped, TS: opts.now(), F: Fields{Stream: opts.Stream}, ParseError: true}
}

// levelAliases maps common level spellings to the syslog-ish canonical set (G25).
var levelAliases = map[string]string{
	"trace": "debug", "debug": "debug", "verbose": "debug", "dbg": "debug",
	"info": "info", "information": "info", "notice": "info", "log": "info",
	"warn": "warn", "warning": "warn", "wrn": "warn",
	"err": "error", "error": "error", "fatal": "fatal", "critical": "fatal",
	"crit": "fatal", "panic": "fatal", "emerg": "fatal", "alert": "fatal",
}

// numericLevels maps common numeric level scales (syslog / bunyan / python) to
// the canonical set. Bunyan: 10/20/30/40/50/60; syslog: 0..7; python: 10..50.
var numericLevels = map[int]string{
	10: "debug", 20: "info", 30: "warn", 40: "error", 50: "fatal", 60: "fatal",
	0: "fatal", 1: "fatal", 2: "fatal", 3: "error", 4: "warn", 5: "info", 6: "info", 7: "debug",
}

// NormalizeLevel maps an app's level spelling to debug|info|warn|error|fatal.
// An unmapped value passes through lowercased so filters on custom schemes work.
func NormalizeLevel(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	if s == "" {
		return ""
	}
	if canonical, ok := levelAliases[s]; ok {
		return canonical
	}
	if n, err := strconv.Atoi(s); err == nil {
		if canonical, ok := numericLevels[n]; ok {
			return canonical
		}
	}
	return s
}

func parseStatus(raw json.RawMessage) int {
	if len(raw) == 0 {
		return 0
	}
	var n int
	if err := json.Unmarshal(raw, &n); err == nil {
		return n
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		if n, err := strconv.Atoi(s); err == nil {
			return n
		}
	}
	return 0
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func trimSpace(b []byte) []byte {
	i, j := 0, len(b)
	for i < j && (b[i] == ' ' || b[i] == '\t' || b[i] == '\n' || b[i] == '\r') {
		i++
	}
	for j > i && (b[j-1] == ' ' || b[j-1] == '\t' || b[j-1] == '\n' || b[j-1] == '\r') {
		j--
	}
	return b[i:j]
}

func trimNewline(b []byte) []byte {
	for len(b) > 0 && (b[len(b)-1] == '\n' || b[len(b)-1] == '\r') {
		b = b[:len(b)-1]
	}
	return b
}
