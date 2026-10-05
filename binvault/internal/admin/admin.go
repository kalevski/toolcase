// Package admin is the admin API (spec §6): buckets, tokens and their
// settings, plus status and config. It is served only on the admin listener.
package admin

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"reflect"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/obs"
	"github.com/kalevski/toolcase/binvault/internal/sigv4"
)

// MaxBody is the largest JSON request body (spec §3.8).
const MaxBody = 256 << 10

// Server is the admin listener's handler.
type Server struct {
	Eng      *engine.Engine
	Tokens   *auth.Store
	Cfg      *config.Config
	Log      *slog.Logger
	Metrics  *obs.Registry
	KeyCache *sigv4.KeyCache
	Throttle *auth.Throttle
	Version  string
	Commit   string
	Started  time.Time
	NodeID   string
	NodeName string

	// Extra routes registered by other packages (pipelines, cluster, ...):
	// called for paths the core does not know. handled=false falls through to
	// 404; an error is answered as usual.
	Extra func(rc *Ctx) (handled bool, err error)

	// StatusExtra lets other packages add fields to GET /status.
	StatusExtra func(rc *Ctx, out map[string]any)

	// PipelinesOf lists a bucket's attached pipelines for GET /buckets/{name}
	// (spec §6.3); nil leaves the field out.
	PipelinesOf func(ctx context.Context, bucket string) []any

	// OnBucketDeleteTx runs inside the transaction that deletes a bucket, before
	// the bucket row goes: queued pipeline runs and backfills end with it.
	OnBucketDeleteTx func(ctx context.Context, tx *meta.Tx, name string) error
	// OnBucketDeleted lets other packages drop per-bucket state (limiters,
	// pipeline attachments cache).
	OnBucketDeleted func(name string)
	// OnBucketChanged is called after a bucket's settings change.
	OnBucketChanged func(b *meta.Bucket)

	// Cluster is this node's cluster agent; nil on a single node, where nothing
	// below applies (spec §8). When set, creating and deleting buckets and tokens
	// also writes the catalog (§8.2, §8.5), and a bucket's catalog entry must say
	// this node is its home before the node changes it.
	Cluster *cluster.Node
	// Router, when set, sees every admin call before the local handlers and
	// routes the ones that touch another node's state: to the bucket's home, to
	// every node, or to the catalog (spec §8.6). handled=false lets the local
	// handlers run. It is not consulted for a call that arrived from a peer (one
	// hop only).
	Router func(rc *Ctx) (handled bool, err error)
}

// Ctx is one admin request.
type Ctx struct {
	S    *Server
	W    http.ResponseWriter
	R    *http.Request
	Ctx  context.Context
	Segs []string // path after /_admin/v1, split on "/"

	// Peer is set for a call that another node authenticated and sent here
	// (POST /_peer/v1/admin, spec §8.6): the admin token was checked there, and
	// the call is run here whatever the catalog says about other nodes.
	Peer bool

	ops []cluster.Op
}

// APIError is an admin-API error (spec §6.1).
type APIError struct {
	Status int
	Code   string
	Detail string
	Fields map[string]string
}

func (e *APIError) Error() string { return e.Code + ": " + e.Detail }

// Error constructors, named after the codes of spec §6.1.
func invalid(detail string, fields map[string]string) *APIError {
	return &APIError{Status: 400, Code: "invalid_request", Detail: detail, Fields: fields}
}
func notFound(detail string) *APIError {
	return &APIError{Status: 404, Code: "not_found", Detail: detail}
}
func conflict(detail string) *APIError {
	return &APIError{Status: 409, Code: "conflict", Detail: detail}
}
func precondition(detail string) *APIError {
	return &APIError{Status: 412, Code: "precondition_failed", Detail: detail}
}
func unavailable(detail string) *APIError {
	return &APIError{Status: 503, Code: "unavailable", Detail: detail}
}
func internalErr(err error) *APIError {
	return &APIError{Status: 500, Code: "internal", Detail: "internal error: " + err.Error()}
}

// Invalid, NotFound, Conflict, Unavailable and Precondition are exported for
// packages that register Extra routes.
var (
	Invalid      = invalid
	NotFound     = notFound
	Conflict     = conflict
	Unavailable  = unavailable
	Precondition = precondition
	Internal     = internalErr
)

// ServeHTTP implements http.Handler for /_admin/v1/** and /_metrics.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	info := httpx.From(r.Context())
	path, _ := httpx.SplitRequestURI(r)
	info.Path = path

	isMetrics := path == "/_metrics"
	if !isMetrics && !strings.HasPrefix(path, "/_admin/v1") {
		http.NotFound(w, r)
		return
	}
	if blocked, wait := s.Throttle.Blocked(info.Client); blocked {
		s.throttledAuth()
		w.Header().Set("Retry-After", strconv.Itoa(int(wait.Seconds()+0.999)))
		s.fail(w, r, &APIError{Status: 429, Code: "rate_limited", Detail: "too many failed authentications from this address"})
		return
	}
	if !s.authorized(r) {
		s.authFailed()
		s.Throttle.Fail(info.Client)
		w.Header().Set("WWW-Authenticate", `Bearer realm="binvault-admin"`)
		s.fail(w, r, &APIError{Status: 401, Code: "unauthorized", Detail: "missing or invalid admin token"})
		return
	}
	info.Principal = "admin"
	if isMetrics {
		info.Op = "Metrics"
		s.serveMetrics(w, r)
		return
	}
	// a body that stops arriving ends after BINVAULT_BODY_IDLE_TIMEOUT like an S3 one
	// (spec §2.3), and what does arrive counts as bytes in (spec §9.2)
	if r.Body != nil && r.Body != http.NoBody {
		r.Body = idleBody{httpx.NewIdleReader(w, r.Body, s.Cfg.BodyIdleTimeout, info), r.Body}
	}
	rest := strings.TrimPrefix(path, "/_admin/v1")
	rest = strings.Trim(rest, "/")
	var segs []string
	if rest != "" {
		segs = strings.Split(rest, "/")
	}
	if err := checkBoolParams(r); err != nil {
		s.fail(w, r, err)
		return
	}
	rc := &Ctx{S: s, W: w, R: r, Ctx: r.Context(), Segs: segs}
	if err := s.route(rc); err != nil {
		s.fail(w, r, err)
	}
}

// boolParams are the query parameters of the admin API that switch something on:
// `?force=true` deletes everything, `?stats=true` adds the counters, `?catalog_only=true`
// and `?detach=true` are deliberate acts. Each is `true` or `false` (spec §6.1); a value
// the handlers would silently read as false (`?force=1`) is refused, so that nobody
// believes it did what it said.
var boolParams = []string{"force", "stats", "catalog_only", "detach"}

func checkBoolParams(r *http.Request) error {
	q := r.URL.Query()
	for _, name := range boolParams {
		for _, v := range q[name] {
			if v != "true" && v != "false" {
				return invalid(name+" must be true or false", map[string]string{name: "must be true or false, got " + strconv.Quote(v)})
			}
		}
	}
	return nil
}

// ServePeer runs an admin call that another node of the cluster already
// authenticated and routed here (POST /_peer/v1/admin, spec §8.6). The admin
// token was checked where the call was received and never crosses the peer link;
// the mux that calls this has checked the cluster key. path is the admin path
// after /_admin/v1, query the raw query string; r carries the method, headers
// and body of the original call.
func (s *Server) ServePeer(w http.ResponseWriter, r *http.Request, path, query string) {
	info := httpx.From(r.Context())
	info.Path = "/_admin/v1" + path
	info.Principal = "admin"
	rest := strings.Trim(path, "/")
	var segs []string
	if rest != "" {
		segs = strings.Split(rest, "/")
	}
	rc := &Ctx{S: s, W: w, R: r, Ctx: r.Context(), Segs: segs, Peer: true}
	if err := s.route(rc); err != nil {
		s.fail(w, r, err)
	}
}

// AddOps registers catalog ops written by this call: the response honours
// ?wait=replicated for them (WriteReplicated).
func (rc *Ctx) AddOps(ops ...cluster.Op) { rc.ops = append(rc.ops, ops...) }

// ReplicatedTimeout is how long ?wait=replicated waits for the peers before it
// answers 202 (spec §8.5).
var ReplicatedTimeout = 10 * time.Second

// Pending is the peers that had not applied a call's catalog ops when
// ?wait=replicated gave up.
type Pending struct {
	Pending []cluster.PendingPeer `json:"pending"`
}

// WriteReplicated sends the normal response of a call that wrote catalog ops
// (spec §6.1). Without ?wait=replicated, or when every active peer has applied
// the ops, that is status and body as they are; otherwise the status is 202
// and the body carries a `pending` list naming the peers that have not (a call
// with no body gets a body of just that list). A nil body means no body.
func (rc *Ctx) WriteReplicated(status int, body any) {
	var pending []cluster.PendingPeer
	if rc.S.Cluster != nil && len(rc.ops) > 0 && rc.R.URL.Query().Get("wait") == "replicated" {
		pending = rc.S.Cluster.WaitReplicated(rc.Ctx, rc.ops, ReplicatedTimeout)
	}
	if len(pending) == 0 {
		if body == nil {
			rc.W.WriteHeader(status)
			return
		}
		WriteJSON(rc.W, status, body)
		return
	}
	if body == nil {
		WriteJSON(rc.W, http.StatusAccepted, Pending{Pending: pending})
		return
	}
	raw, err := json.Marshal(body)
	var obj map[string]json.RawMessage
	if err != nil || json.Unmarshal(raw, &obj) != nil {
		WriteJSON(rc.W, http.StatusAccepted, Pending{Pending: pending})
		return
	}
	pb, _ := json.Marshal(pending)
	obj["pending"] = pb
	WriteJSON(rc.W, http.StatusAccepted, obj)
}

// authorized checks the bearer token in constant time against every accepted
// admin token (several are listed while the token is being rotated, spec §4.2).
func (s *Server) authorized(r *http.Request) bool {
	h := r.Header.Get("Authorization")
	scheme, tok, ok := strings.Cut(h, " ")
	if !ok || !strings.EqualFold(scheme, "Bearer") {
		return false
	}
	tok = strings.TrimSpace(tok)
	match := 0
	for _, t := range s.Cfg.AdminToken {
		match |= subtle.ConstantTimeCompare([]byte(tok), []byte(t))
	}
	return match == 1
}

func (s *Server) serveMetrics(w http.ResponseWriter, r *http.Request) {
	if s.Metrics == nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	_, _ = s.Metrics.WriteTo(w)
}

// ---- JSON helpers ----------------------------------------------------------------

type errBody struct {
	Error  string            `json:"error"`
	Detail string            `json:"detail,omitempty"`
	Fields map[string]string `json:"fields,omitempty"`
}

func (s *Server) fail(w http.ResponseWriter, r *http.Request, err error) {
	var ae *APIError
	if !errors.As(err, &ae) {
		s.Log.Error("admin request failed", "error", err)
		ae = internalErr(err)
	}
	info := httpx.From(r.Context())
	info.ErrCode = ae.Code
	WriteJSON(w, ae.Status, errBody{Error: ae.Code, Detail: ae.Detail, Fields: ae.Fields})
}

// WriteJSON sends v as JSON.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	b, err := json.Marshal(v)
	if err != nil {
		http.Error(w, "internal", 500)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Length", strconv.Itoa(len(b)+1))
	w.WriteHeader(status)
	_, _ = w.Write(append(b, '\n'))
}

// idleBody is a request body read through an httpx.IdleReader.
type idleBody struct {
	io.Reader
	io.Closer
}

// ReadBody reads the request body, at most MaxBody bytes: a larger one is 413
// payload_too_large (spec §3.8, §6.1).
func (rc *Ctx) ReadBody() ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(rc.R.Body, MaxBody+1))
	if err != nil {
		if errors.Is(err, httpx.ErrIdle) {
			return nil, invalid("the request body stopped arriving: no data for "+rc.S.Cfg.BodyIdleTimeout.String(), nil)
		}
		return nil, invalid("could not read the request body", nil)
	}
	if len(body) > MaxBody {
		return nil, &APIError{Status: 413, Code: "payload_too_large", Detail: "request body exceeds 256 KiB"}
	}
	return body, nil
}

// Decode reads a strict JSON body: unknown fields are 400 (spec §6.1).
func (rc *Ctx) Decode(dst any) error {
	body, err := rc.ReadBody()
	if err != nil {
		return err
	}
	return DecodeStrict(body, dst)
}

// DecodeStrict decodes JSON rejecting unknown fields and trailing data. What it
// says about a body it cannot decode is about the body, never about the Go types
// behind it.
func DecodeStrict(body []byte, dst any) error {
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return jsonProblem(err)
	}
	if dec.More() {
		return invalid("invalid JSON body: trailing data", nil)
	}
	return nil
}

// jsonProblem turns a decoding error into the 400 of spec §6.1: the field and what it
// should have been, without the names of Go structs and types encoding/json would put in.
func jsonProblem(err error) *APIError {
	var ute *json.UnmarshalTypeError
	var perr *time.ParseError
	msg := strings.TrimPrefix(err.Error(), "json: ")
	switch {
	case errors.As(err, &ute):
		// Field is the dotted path from the root, with the names of embedded Go
		// structs in it ("Settings.quota_bytes"): JSON keys are all lower case
		var path []string
		for _, c := range strings.Split(ute.Field, ".") {
			if c != "" && !unicode.IsUpper(rune(c[0])) {
				path = append(path, c)
			}
		}
		want := jsonKind(ute.Type)
		if len(path) == 0 {
			return invalid("invalid JSON body: the request body must be "+want, nil)
		}
		field := strings.Join(path, ".")
		return invalid("invalid JSON body: "+field+" must be "+want, map[string]string{field: "must be " + want})
	case errors.As(err, &perr):
		return invalid("invalid JSON body: a timestamp must be RFC 3339, for example 2026-10-02T12:00:00Z", nil)
	case strings.HasPrefix(msg, "unknown field "):
		name := strings.Trim(strings.TrimPrefix(msg, "unknown field "), `"`)
		return invalid("invalid JSON body: "+msg, map[string]string{name: "unknown field"})
	}
	return invalid("invalid JSON body: "+msg, nil)
}

// jsonKind says in JSON terms what a Go type expects.
func jsonKind(t reflect.Type) string {
	if t == nil {
		return "valid"
	}
	if t == reflect.TypeOf(time.Time{}) {
		return "an RFC 3339 timestamp"
	}
	for t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	switch t.Kind() {
	case reflect.String:
		return "a string"
	case reflect.Bool:
		return "true or false"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Float32, reflect.Float64:
		return "a number"
	case reflect.Slice, reflect.Array:
		return "an array"
	}
	return "an object"
}

// apiMessage is an error's text for a response: an S3 validator's message without its
// S3 error code in front.
func apiMessage(err error) string {
	if ae, ok := apierr.As(err); ok {
		return ae.Message
	}
	return err.Error()
}

// ifMatch parses an If-Match revision ("3" or "\"3\""); 0 = absent.
func ifMatch(r *http.Request) (int64, error) {
	v := strings.Trim(strings.TrimSpace(r.Header.Get("If-Match")), `"`)
	if v == "" {
		return 0, nil
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil || n <= 0 {
		return 0, invalid("If-Match must be a revision number", nil)
	}
	return n, nil
}

// PageParams reads limit (default 50, max 500) and cursor.
func PageParams(r *http.Request) (limit int, cursor string, err error) {
	limit = 50
	if v := r.URL.Query().Get("limit"); v != "" {
		n, perr := strconv.Atoi(v)
		if perr != nil || n < 1 || n > 500 {
			return 0, "", invalid("limit must be between 1 and 500", nil)
		}
		limit = n
	}
	return limit, r.URL.Query().Get("cursor"), nil
}

// route dispatches an admin request.
func (s *Server) route(rc *Ctx) error {
	segs, m := rc.Segs, rc.R.Method
	info := httpx.From(rc.Ctx)
	if s.Router != nil && !rc.Peer {
		if handled, err := s.Router(rc); handled || err != nil {
			return err
		}
	}
	switch {
	case len(segs) >= 1 && segs[0] == "cluster":
		return s.routeCluster(rc)
	case len(segs) >= 1 && segs[0] == "moves":
		return s.movesUnavailable(rc)
	case len(segs) == 1 && segs[0] == "status" && m == http.MethodGet:
		info.Op = "AdminStatus"
		return s.status(rc)
	case len(segs) == 1 && segs[0] == "config" && m == http.MethodGet:
		info.Op = "AdminConfig"
		return s.config(rc)
	case len(segs) >= 1 && segs[0] == "buckets":
		return s.routeBuckets(rc)
	}
	if s.Extra != nil {
		if handled, err := s.Extra(rc); handled || err != nil {
			return err
		}
	}
	return notFound("no such admin endpoint")
}

var _ = time.Now
