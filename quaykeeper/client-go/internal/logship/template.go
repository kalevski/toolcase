package logship

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// Template turns a plain-text line into a structured entry via a simple
// "{field} literal {field}" grammar (no regex to author). Example:
//
//	"{level} | {time} - {message}"
//
// compiles to ^(?P<level>.+?) \| (?P<time>.+?) - (?P<message>.+?)$ and turns
//
//	info | 12:20 - hello I'm a log
//
// into {"level":"info","time":"12:20","message":"hello I'm a log"} — real JSON on
// the wire, so filters, Loki labels and LogQL `| json` all work on it. Known field
// names (level/message/stream/host/status/…) also populate the typed fast-path
// fields; unknown names (like "time") live only in the JSON body.
type Template struct {
	src    string
	re     *regexp.Regexp
	fields []string // capture names, in match order
}

// String returns the original template source (used to dedupe templates).
func (t *Template) String() string { return t.src }

var templateFieldRe = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

// CompileTemplate compiles a "{field} literal {field}" template. Literals are
// regex-escaped; each `{name}` becomes a named capture. Two adjacent `{fields}`
// with no separator are rejected (they can't be split deterministically).
func CompileTemplate(tmpl string) (*Template, error) {
	if strings.TrimSpace(tmpl) == "" {
		return nil, fmt.Errorf("empty template")
	}
	var pat strings.Builder
	pat.WriteString("^")
	var fields []string
	var lit strings.Builder
	flushLit := func() {
		if lit.Len() > 0 {
			pat.WriteString(regexp.QuoteMeta(lit.String()))
			lit.Reset()
		}
	}
	lastWasToken := false
	for i := 0; i < len(tmpl); {
		if tmpl[i] == '{' {
			end := strings.IndexByte(tmpl[i:], '}')
			if end < 0 {
				return nil, fmt.Errorf("unclosed '{' in template %q", tmpl)
			}
			name := tmpl[i+1 : i+end]
			if !templateFieldRe.MatchString(name) {
				return nil, fmt.Errorf("template %q: bad field name %q (must match [A-Za-z_][A-Za-z0-9_]*)", tmpl, name)
			}
			if lastWasToken {
				return nil, fmt.Errorf("template %q: two adjacent {fields} need a literal separator between them", tmpl)
			}
			flushLit()
			// Non-greedy; the trailing `$` anchor forces the final capture to consume
			// the rest, so no special-casing of the last field is needed.
			pat.WriteString("(?P<" + name + ">.+?)")
			fields = append(fields, name)
			i += end + 1
			lastWasToken = true
		} else {
			lit.WriteByte(tmpl[i])
			i++
			lastWasToken = false
		}
	}
	flushLit()
	pat.WriteString("$")

	if len(fields) == 0 {
		return nil, fmt.Errorf("template %q has no {fields}", tmpl)
	}
	re, err := regexp.Compile(pat.String())
	if err != nil {
		return nil, fmt.Errorf("template %q: %w", tmpl, err)
	}
	return &Template{src: tmpl, re: re, fields: fields}, nil
}

// apply matches one line and, on success, returns the structured entry.
func (t *Template) apply(raw []byte, opts ParseOptions) (Entry, bool) {
	line := trimNewline(raw)
	m := t.re.FindSubmatch(line)
	if m == nil {
		return Entry{}, false
	}
	obj := make(map[string]any, len(t.fields)+1)
	e := Entry{TS: opts.now()}
	for i, name := range t.fields {
		val := string(m[i+1])
		obj[name] = val
		switch name {
		case "level", "lvl", "severity":
			e.F.Level = NormalizeLevel(val)
		case "message", "msg":
			e.F.Message = val
		case "stream":
			e.F.Stream = val
		case "host":
			e.F.Host = val
		case "method":
			e.F.Method = val
		case "path":
			e.F.Path = val
		case "scheme":
			e.F.Scheme = val
		case "resource":
			e.F.Resource = val
		case "resource_type":
			e.F.ResourceType = val
		case "user_agent":
			e.F.UserAgent = val
		case "status":
			if n, err := strconv.Atoi(strings.TrimSpace(val)); err == nil {
				e.F.Status = n
			}
		}
	}
	if e.F.Stream == "" && opts.Stream != "" {
		e.F.Stream = opts.Stream
		obj["stream"] = opts.Stream
	}
	out, err := json.Marshal(obj)
	if err != nil {
		return Entry{}, false
	}
	e.Raw = out
	return e, true
}
