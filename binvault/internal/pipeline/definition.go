package pipeline

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/glob"
	"github.com/kalevski/toolcase/binvault/internal/keypat"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// Stages (spec §7.1).
const (
	StageBefore = "before"
	StageAfter  = "after"
)

// Event names (spec §7.5).
const (
	EventCreated = engine.EventCreated
	EventUpdated = engine.EventUpdated
	EventDeleted = engine.EventDeleted
)

// Limits of spec §3.8 and §7.2.
const (
	MaxPipelines          = 256
	MaxAttachments        = 32
	MaxEnabledBefore      = 8
	maxHeaders            = 16
	maxDescription        = 500
	maxPatterns           = 100
	maxGrants             = 16
	maxGrantKeys          = 32
	maxURL                = 2048
	minSigningSecret      = 32
	maxSigningSecret      = 1024
	maxHeaderValue        = 4096
	maxBackoffEntries     = 10
	maxConcurrencyCeiling = 256
	maxAfterTimeout       = 30 * time.Minute
	minTimeout            = time.Second
	maxBeforeBackoff      = 5 * time.Second
	maxAfterBackoff       = 24 * time.Hour
)

// Redacted is what every service.headers value reads in responses (spec §6.5).
const Redacted = "***"

var nameRe = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,62}$`)

// Definition is a pipeline as the admin API shows and accepts it (spec §7.2).
// Secrets never appear in it: header values read Redacted and the signing
// secret is replaced by Service.HasSigningSecret.
type Definition struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Enabled     bool     `json:"enabled"`
	Paused      bool     `json:"paused"`
	Stage       string   `json:"stage"`
	Events      []string `json:"events"`
	Match       Match    `json:"match"`
	Service     Service  `json:"service"`
	Token       Token    `json:"token"`
	Limits      Limits   `json:"limits"`
	Retry       Retry    `json:"retry"`
	OnError     string   `json:"on_error"`

	// Read-only.
	Revision   int64     `json:"revision"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
	AttachedTo []string  `json:"attached_to,omitzero"` // detail only (an empty list is shown as [])
}

// Match selects objects (spec §7.3). Every condition present must hold; a list
// matches if any element does.
type Match struct {
	Keys              []string `json:"keys,omitempty"`
	ExcludeKeys       []string `json:"exclude_keys,omitempty"`
	ContentType       []string `json:"content_type,omitempty"`
	ContentTypeSource string   `json:"content_type_source,omitempty"`
	Operations        []string `json:"operations,omitempty"`
	MinSize           *int64   `json:"min_size,omitempty"`
	MaxSize           *int64   `json:"max_size,omitempty"`
}

// Service is where and how to call (spec §7.2).
type Service struct {
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	// SigningSecret is input only: absent keeps the stored secret, null removes
	// it, a string replaces it.
	SigningSecret    nullableString `json:"signing_secret,omitzero"`
	HasSigningSecret bool           `json:"has_signing_secret,omitempty"`
	Timeout          string         `json:"timeout"`
	S3Endpoint       string         `json:"s3_endpoint,omitempty"`
}

// Token holds the grants of the token a call receives (spec §7.8). A nil
// Grants takes the default (read on {key}); an empty one mints no token.
type Token struct {
	Grants []meta.Grant `json:"grants"`
}

// Limits bound the load a service sees.
type Limits struct {
	MaxConcurrency int    `json:"max_concurrency"`
	QueueTimeout   string `json:"queue_timeout,omitempty"` // before only
}

// Retry says how transient failures are retried.
type Retry struct {
	MaxAttempts int      `json:"max_attempts"`
	Backoff     []string `json:"backoff"`
}

// nullableString tells an absent JSON field from null from a string.
type nullableString struct {
	Set  bool
	Null bool
	V    string
}

func (n *nullableString) UnmarshalJSON(b []byte) error {
	n.Set = true
	if bytes.Equal(bytes.TrimSpace(b), []byte("null")) {
		n.Null, n.V = true, ""
		return nil
	}
	n.Null = false
	return json.Unmarshal(b, &n.V)
}

func (n nullableString) MarshalJSON() ([]byte, error) {
	if !n.Set || n.Null {
		return []byte("null"), nil
	}
	return json.Marshal(n.V)
}

// IsZero lets encoding/json omit an absent signing secret (omitzero).
func (n nullableString) IsZero() bool { return !n.Set }

// DefaultGrants is the token of a pipeline that names none (spec §7.2).
func DefaultGrants() []meta.Grant {
	return []meta.Grant{{Actions: []string{auth.Read}, Keys: []string{"{key}"}}}
}

// NewDefinition returns the starting point a request body is decoded onto: the
// defaults that do not depend on the stage.
func NewDefinition() Definition {
	return Definition{Enabled: true}
}

// Env is what validation needs from the process configuration.
type Env struct {
	// BeforeTotalTimeout is BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT: the
	// ceiling of a before pipeline's timeout (spec §7.2).
	BeforeTotalTimeout time.Duration
}

var (
	allEvents     = []string{EventCreated, EventUpdated, EventDeleted}
	defaultEvents = []string{EventCreated, EventUpdated}
	allOps        = []string{"put", "post", "copy", "multipart", "delete", "delete_version", "lifecycle", "backfill"}
	beforeOps     = []string{"put", "post", "copy", "multipart", "delete"}
)

// Normalize fills in the defaults of the definition's stage and validates it,
// returning the problem of every invalid field by its JSON path. A definition
// with problems is not changed beyond the defaults.
func (d *Definition) Normalize(env Env) map[string]string {
	f := map[string]string{}
	switch d.Stage {
	case StageBefore, StageAfter:
	case "":
		f["stage"] = `required: "before" or "after"`
	default:
		f["stage"] = `must be "before" or "after"`
	}
	before := d.Stage == StageBefore

	if !nameRe.MatchString(d.Name) {
		f["name"] = "must match ^[a-z0-9][a-z0-9_-]{0,62}$"
	}
	if utf8.RuneCountInString(d.Description) > maxDescription {
		f["description"] = fmt.Sprintf("at most %d characters", maxDescription)
	}
	if d.Paused && before {
		f["paused"] = "only after pipelines can be paused (use on_error or enabled on a before pipeline)"
	}

	// events
	if len(d.Events) == 0 {
		d.Events = append([]string(nil), defaultEvents...)
	}
	d.Events = dedupe(d.Events)
	for _, e := range d.Events {
		if !contains(allEvents, e) {
			f["events"] = fmt.Sprintf("unknown event %q (known: %s)", e, strings.Join(allEvents, ", "))
			break
		}
	}

	d.Match.validate("match", d.Stage, f)
	d.validateService(env, f)
	d.validateToken(f)
	d.validateLimitsRetry(env, f)

	// on_error
	switch {
	case d.OnError == "" && before:
		d.OnError = "reject"
	case d.OnError == "":
		d.OnError = "stop"
	case before && d.OnError != "reject" && d.OnError != "continue":
		f["on_error"] = `a before pipeline's on_error is "reject" or "continue"`
	case d.Stage == StageAfter && d.OnError != "stop" && d.OnError != "continue":
		f["on_error"] = `an after pipeline's on_error is "stop" or "continue"`
	}
	return f
}

func (d *Definition) validateService(env Env, f map[string]string) {
	s := &d.Service
	if err := checkServiceURL(s.URL, "url"); err != "" {
		f["service.url"] = err
	}
	if s.S3Endpoint != "" {
		if err := checkServiceURL(s.S3Endpoint, "s3_endpoint"); err != "" {
			f["service.s3_endpoint"] = err
		}
	}
	if s.Headers == nil {
		s.Headers = map[string]string{}
	}
	if len(s.Headers) > maxHeaders {
		f["service.headers"] = fmt.Sprintf("at most %d headers", maxHeaders)
	}
	seen := map[string]string{}
	names := make([]string, 0, len(s.Headers))
	for name := range s.Headers {
		names = append(names, name)
	}
	sort.Strings(names) // deterministic problem reports
	for _, name := range names {
		val := s.Headers[name]
		key := "service.headers." + name
		if msg := checkHeader(name, val); msg != "" {
			f[key] = msg
			continue
		}
		low := strings.ToLower(name)
		if prev, dup := seen[low]; dup {
			f[key] = fmt.Sprintf("duplicates header %q", prev)
		}
		seen[low] = name
	}
	if s.SigningSecret.Set && !s.SigningSecret.Null {
		n := utf8.RuneCountInString(s.SigningSecret.V)
		switch {
		case n < minSigningSecret:
			f["service.signing_secret"] = fmt.Sprintf("must be at least %d characters", minSigningSecret)
		case n > maxSigningSecret:
			f["service.signing_secret"] = fmt.Sprintf("at most %d characters", maxSigningSecret)
		}
	}
	// timeout
	before := d.Stage == StageBefore
	if s.Timeout == "" {
		switch {
		case !before:
			s.Timeout = "30s"
		case env.BeforeTotalTimeout > 0 && env.BeforeTotalTimeout < 20*time.Second:
			s.Timeout = env.BeforeTotalTimeout.String() // the default may not exceed the chain budget
		default:
			s.Timeout = "20s"
		}
	}
	t, err := time.ParseDuration(s.Timeout)
	switch {
	case err != nil:
		f["service.timeout"] = `not a duration such as "30s"`
	case t < minTimeout:
		f["service.timeout"] = "at least 1s"
	case before && env.BeforeTotalTimeout > 0 && t > env.BeforeTotalTimeout:
		f["service.timeout"] = fmt.Sprintf("a before pipeline's timeout may not exceed BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT (%s)", env.BeforeTotalTimeout)
	case !before && d.Stage != "" && t > maxAfterTimeout:
		f["service.timeout"] = "at most 30m"
	}
}

func (d *Definition) validateToken(f map[string]string) {
	if d.Token.Grants == nil {
		d.Token.Grants = DefaultGrants()
	}
	gs := d.Token.Grants
	if len(gs) > maxGrants {
		f["token.grants"] = fmt.Sprintf("at most %d grants", maxGrants)
		return
	}
	before := d.Stage == StageBefore
	for i, g := range gs {
		at := func(field, msg string) { f[fmt.Sprintf("token.grants[%d].%s", i, field)] = msg }
		if len(g.Actions) == 0 {
			at("actions", "must not be empty")
		}
		var staged bool
		for _, a := range g.Actions {
			switch {
			case !auth.ValidAction(a):
				at("actions", fmt.Sprintf("unknown action %q", a))
			case before && a == auth.Purge:
				at("actions", `a before pipeline's token cannot "purge"`)
			}
			if a == auth.Create || a == auth.Write || a == auth.Delete || a == auth.Tag {
				staged = true
			}
		}
		if g.Keys != nil && len(g.Keys) == 0 {
			at("keys", "must not be empty (omit it for every key)")
		}
		if len(g.Keys) > maxGrantKeys {
			at("keys", fmt.Sprintf("at most %d patterns", maxGrantKeys))
		}
		for j, k := range g.Keys {
			if err := keypat.ValidateTemplate(k); err != nil {
				at(fmt.Sprintf("keys[%d]", j), strings.TrimPrefix(err.Error(), "keypat: "))
			}
		}
		if before && staged && !(len(g.Keys) == 1 && g.Keys[0] == "{key}") {
			at("keys", `a before pipeline's create, write, delete and tag grants must be exactly ["{key}"]: it works on the staged object only`)
		}
	}
}

func (d *Definition) validateLimitsRetry(env Env, f map[string]string) {
	before := d.Stage == StageBefore
	l := &d.Limits
	if l.MaxConcurrency == 0 {
		l.MaxConcurrency = 8
	}
	if l.MaxConcurrency < 1 || l.MaxConcurrency > maxConcurrencyCeiling {
		f["limits.max_concurrency"] = fmt.Sprintf("between 1 and %d", maxConcurrencyCeiling)
	}
	if before {
		if l.QueueTimeout == "" {
			l.QueueTimeout = "5s"
		}
		qt, err := time.ParseDuration(l.QueueTimeout)
		switch {
		case err != nil:
			f["limits.queue_timeout"] = `not a duration such as "5s"`
		case qt <= 0:
			f["limits.queue_timeout"] = "must be positive"
		}
	} else {
		l.QueueTimeout = "" // before only; ignored here
	}

	r := &d.Retry
	maxAttempts, defBackoff := 5, []string{"10s", "1m", "10m", "1h"}
	ceiling, maxBackoff := 10, maxAfterBackoff
	if before {
		maxAttempts, defBackoff, ceiling, maxBackoff = 1, []string{"1s"}, 3, maxBeforeBackoff
	}
	if r.MaxAttempts == 0 {
		r.MaxAttempts = maxAttempts
	}
	if r.MaxAttempts < 1 || r.MaxAttempts > ceiling {
		f["retry.max_attempts"] = fmt.Sprintf("between 1 and %d for a %s pipeline", ceiling, d.Stage)
	}
	if len(r.Backoff) == 0 {
		r.Backoff = defBackoff
	}
	if len(r.Backoff) > maxBackoffEntries {
		f["retry.backoff"] = fmt.Sprintf("at most %d delays", maxBackoffEntries)
		return
	}
	for i, b := range r.Backoff {
		v, err := time.ParseDuration(b)
		switch {
		case err != nil:
			f[fmt.Sprintf("retry.backoff[%d]", i)] = `not a duration such as "10s"`
		case v <= 0:
			f[fmt.Sprintf("retry.backoff[%d]", i)] = "must be positive"
		case v > maxBackoff && d.Stage != "":
			f[fmt.Sprintf("retry.backoff[%d]", i)] = fmt.Sprintf("at most %s for a %s pipeline", maxBackoff, d.Stage)
		}
	}
}

// validate checks a match filter. stage "" skips the operation rule.
func (m *Match) validate(path, stage string, f map[string]string) {
	checkGlobs := func(field string, pats []string) {
		if len(pats) > maxPatterns {
			f[path+"."+field] = fmt.Sprintf("at most %d patterns", maxPatterns)
			return
		}
		for i, p := range pats {
			if err := glob.Valid(p); err != nil {
				f[fmt.Sprintf("%s.%s[%d]", path, field, i)] = strings.TrimPrefix(err.Error(), "glob: ")
				return
			}
		}
	}
	checkGlobs("keys", m.Keys)
	checkGlobs("exclude_keys", m.ExcludeKeys)
	if len(m.ContentType) > maxPatterns {
		f[path+".content_type"] = fmt.Sprintf("at most %d patterns", maxPatterns)
	} else if err := engine.ValidatePatterns(m.ContentType); err != nil {
		f[path+".content_type"] = err.Error()
	}
	switch m.ContentTypeSource {
	case "", "declared", "sniffed":
	default:
		f[path+".content_type_source"] = `must be "declared" or "sniffed"`
	}
	allowed := allOps
	if stage == StageBefore {
		allowed = beforeOps
	}
	for _, op := range m.Operations {
		if !contains(allOps, op) {
			f[path+".operations"] = fmt.Sprintf("unknown operation %q (known: %s)", op, strings.Join(allOps, ", "))
			break
		}
		if !contains(allowed, op) {
			f[path+".operations"] = fmt.Sprintf("a before pipeline cannot run for %q (only %s can)", op, strings.Join(beforeOps, ", "))
			break
		}
	}
	if m.MinSize != nil && *m.MinSize < 0 {
		f[path+".min_size"] = "must not be negative"
	}
	if m.MaxSize != nil && *m.MaxSize < 0 {
		f[path+".max_size"] = "must not be negative"
	}
	if m.MinSize != nil && m.MaxSize != nil && *m.MinSize > *m.MaxSize {
		f[path+".max_size"] = "must not be smaller than min_size"
	}
}

// checkServiceURL accepts http and https URLs with a host and no userinfo,
// query or fragment.
func checkServiceURL(raw, what string) string {
	if raw == "" {
		return "required"
	}
	if len(raw) > maxURL {
		return fmt.Sprintf("at most %d characters", maxURL)
	}
	u, err := url.Parse(raw)
	switch {
	case err != nil:
		return "not a valid URL"
	case u.Scheme != "http" && u.Scheme != "https":
		return "the scheme must be http or https"
	case u.Hostname() == "":
		return "a host is required"
	case u.User != nil:
		return "must not carry userinfo (use service.headers for credentials)"
	case u.Fragment != "" || strings.Contains(raw, "#"):
		return "must not carry a fragment"
	}
	if what == "s3_endpoint" && (u.RawQuery != "" || strings.Contains(raw, "?")) {
		return "must not carry a query"
	}
	return ""
}

var forbiddenHeaders = map[string]bool{
	"host": true, "content-length": true, "transfer-encoding": true, "connection": true,
}

// checkHeader validates one static service header (spec §7.2).
func checkHeader(name, val string) string {
	switch {
	case name == "":
		return "the header name must not be empty"
	case !validToken(name):
		return "not a valid header name"
	case forbiddenHeaders[strings.ToLower(name)]:
		return "this header is set by binvault"
	case strings.HasPrefix(strings.ToLower(name), "x-binvault-"):
		return "X-Binvault-* headers are set by binvault"
	case len(val) > maxHeaderValue:
		return fmt.Sprintf("the value is longer than %d bytes", maxHeaderValue)
	}
	for i := 0; i < len(val); i++ {
		if c := val[i]; (c < 0x20 && c != '\t') || c == 0x7f {
			return "the value must not contain control characters"
		}
	}
	return ""
}

func validToken(s string) bool {
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'a' && c <= 'z', c >= 'A' && c <= 'Z', c >= '0' && c <= '9':
		case strings.IndexByte("!#$%&'*+-.^_`|~", c) >= 0:
		default:
			return false
		}
	}
	return s != ""
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

func dedupe(in []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, v := range in {
		if !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
	}
	return out
}

// Public returns the definition as responses show it: every header value
// redacted and the signing secret replaced by has_signing_secret.
func (d Definition) Public(hasSigningSecret bool) Definition {
	hs := make(map[string]string, len(d.Service.Headers))
	for k := range d.Service.Headers {
		hs[k] = Redacted
	}
	d.Service.Headers = hs
	d.Service.SigningSecret = nullableString{}
	d.Service.HasSigningSecret = hasSigningSecret
	return d
}

// MergePatch applies an RFC 7396 JSON merge patch to target in place.
func MergePatch(target, patch map[string]any) {
	for k, v := range patch {
		if v == nil {
			delete(target, k)
			continue
		}
		if pm, ok := v.(map[string]any); ok {
			tm, _ := target[k].(map[string]any)
			if tm == nil {
				tm = map[string]any{}
			}
			MergePatch(tm, pm)
			target[k] = tm
			continue
		}
		target[k] = v
	}
}
