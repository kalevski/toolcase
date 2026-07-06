package logship

import (
	"encoding/json"
	"net/netip"
	"net/url"
	"strings"
	"time"
)

// Entry is one log line ready to ship: the raw JSON bytes plus the typed
// fast-path fields filters and Loki labels read. The full line is never held
// as a map (G7) — anything not a fast-path field stays in Raw and is queryable
// downstream (LogQL `| json`).
type Entry struct {
	Raw []byte    // the JSON line as shipped (redacted)
	TS  time.Time // event time (nginx $time_iso8601, or receive time)
	F   Fields
	// ParseError marks a line that did not parse as JSON and was wrapped as
	// {"raw": "...", "parse_error": true} — never dropped silently (G1).
	ParseError bool
}

// Fields are the typed fast-path fields extracted at intake.
type Fields struct {
	Host         string
	ServerName   string
	Method       string
	Path         string
	Scheme       string
	Resource     string
	ResourceType string
	UserAgent    string
	Level        string
	Stream       string
	Status       int
}

// Field returns a named field's string value for filtering / labeling.
func (e *Entry) Field(name string) (string, bool) {
	switch name {
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
	case "level":
		return e.F.Level, true
	case "stream":
		return e.F.Stream, true
	case "raw":
		return string(e.Raw), true
	}
	return "", false
}

// DefaultRedactParams is the default query-parameter deny-list redacted at
// intake before any destination sees the line (G29) — query strings routinely
// carry OAuth codes and API tokens.
var DefaultRedactParams = []string{"token", "code", "secret", "password", "key", "authorization", "api_key", "apikey", "access_token", "refresh_token"}

// redactedValue replaces a denied query parameter's value.
const redactedValue = "REDACTED"

// ParseOptions tune access-line parsing at intake.
type ParseOptions struct {
	// RedactParams is the query-parameter deny-list (nil = DefaultRedactParams,
	// empty = redaction off). Comparison is case-insensitive.
	RedactParams []string
	// AnonymizeIP zeroes the last octet (IPv4) / last 80 bits (IPv6) of
	// remote_addr for GDPR-shaped deployments.
	AnonymizeIP bool
	// Now injects the clock for tests.
	Now func() time.Time
}

func (o ParseOptions) now() time.Time {
	if o.Now != nil {
		return o.Now()
	}
	return time.Now()
}

func (o ParseOptions) redactParams() []string {
	if o.RedactParams == nil {
		return DefaultRedactParams
	}
	return o.RedactParams
}

// accessLine mirrors the nginxpilot_json log_format (nginxconf.LogFormatInclude).
type accessLine struct {
	TS           string `json:"ts"`
	Host         string `json:"host"`
	ServerName   string `json:"server_name"`
	RemoteAddr   string `json:"remote_addr"`
	Method       string `json:"method"`
	Path         string `json:"path"`
	Query        string `json:"query"`
	Status       int    `json:"status"`
	Scheme       string `json:"scheme"`
	UserAgent    string `json:"user_agent"`
	Resource     string `json:"resource"`
	ResourceType string `json:"resource_type"`
	Level        string `json:"level"`
	Stream       string `json:"stream"`
}

// ParseAccessLine turns one raw log line into an Entry. Unparseable input
// (truncated syslog datagrams, non-JSON lines) is wrapped as
// {"raw": "...", "parse_error": true} and still shipped — the caller counts it.
func ParseAccessLine(raw []byte, opts ParseOptions) Entry {
	var line accessLine
	if err := json.Unmarshal(raw, &line); err != nil {
		return wrapRaw(raw, opts)
	}

	e := Entry{
		Raw: raw,
		TS:  opts.now(),
		F: Fields{
			Host:         line.Host,
			ServerName:   line.ServerName,
			Method:       line.Method,
			Path:         line.Path,
			Scheme:       line.Scheme,
			Resource:     line.Resource,
			ResourceType: line.ResourceType,
			UserAgent:    line.UserAgent,
			Level:        strings.ToLower(line.Level),
			Stream:       line.Stream,
			Status:       line.Status,
		},
	}
	if ts, err := time.Parse(time.RFC3339, line.TS); err == nil {
		e.TS = ts
	}

	updates := map[string]string{}
	if q, changed := redactQuery(line.Query, opts.redactParams()); changed {
		updates["query"] = q
	}
	if opts.AnonymizeIP {
		if ip, changed := anonymizeIP(line.RemoteAddr); changed {
			updates["remote_addr"] = ip
		}
	}
	if len(updates) > 0 {
		e.Raw = rewriteLine(raw, updates)
	}
	return e
}

// wrapRaw wraps a non-JSON line so it still ships as valid JSON.
func wrapRaw(raw []byte, opts ParseOptions) Entry {
	wrapped, err := json.Marshal(map[string]any{"raw": string(raw), "parse_error": true})
	if err != nil { // cannot happen for a string map; belt and braces
		wrapped = []byte(`{"parse_error":true}`)
	}
	return Entry{Raw: wrapped, TS: opts.now(), ParseError: true}
}

// rewriteLine re-serializes the line with the given fields replaced. Only
// called when redaction actually changed something, so the common path never
// pays a second parse.
func rewriteLine(raw []byte, updates map[string]string) []byte {
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return raw
	}
	for k, v := range updates {
		m[k] = v
	}
	out, err := json.Marshal(m)
	if err != nil {
		return raw
	}
	return out
}

// redactQuery replaces the value of every denied parameter in a raw query
// string ("a=1&token=x" → "a=1&token=REDACTED"). Parameter-name comparison is
// case-insensitive; the rest of the string is preserved verbatim (it is log
// data, not a URL to re-encode).
func redactQuery(query string, deny []string) (string, bool) {
	if query == "" || len(deny) == 0 {
		return query, false
	}
	denySet := make(map[string]bool, len(deny))
	for _, p := range deny {
		denySet[strings.ToLower(p)] = true
	}
	parts := strings.Split(query, "&")
	changed := false
	for i, part := range parts {
		name, _, hasVal := strings.Cut(part, "=")
		if !hasVal {
			continue
		}
		decoded, err := url.QueryUnescape(name)
		if err != nil {
			decoded = name
		}
		if denySet[strings.ToLower(decoded)] {
			parts[i] = name + "=" + redactedValue
			changed = true
		}
	}
	if !changed {
		return query, false
	}
	return strings.Join(parts, "&"), true
}

// anonymizeIP zeroes the host part of an address: the last octet of an IPv4,
// the last 80 bits of an IPv6. Returns ("", false) for unparseable input.
func anonymizeIP(addr string) (string, bool) {
	ip, err := netip.ParseAddr(addr)
	if err != nil {
		return "", false
	}
	if ip.Is4() {
		b := ip.As4()
		b[3] = 0
		return netip.AddrFrom4(b).String(), true
	}
	b := ip.As16()
	for i := 6; i < 16; i++ {
		b[i] = 0
	}
	return netip.AddrFrom16(b).String(), true
}
