package pipeline_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"hash/crc32"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/app"
	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/sigv4"
)

// ---- a node ---------------------------------------------------------------------

type node struct {
	t        *testing.T
	cfg      *config.Config
	app      *app.App
	s3URL    string
	adminURL string
	adminTok string
	dir      string
	cancel   context.CancelFunc
	done     chan struct{}
	stopOnce sync.Once
}

type cred struct{ ak, sk string }

type resp struct {
	status int
	header http.Header
	body   []byte
}

func (r *resp) code() string {
	var e struct {
		Code string `xml:"Code"`
	}
	_ = xml.Unmarshal(r.body, &e)
	return e.Code
}

func (r *resp) message() string {
	var e struct {
		Message string `xml:"Message"`
	}
	_ = xml.Unmarshal(r.body, &e)
	return e.Message
}

// startNode starts a whole node in-process on random ports. The data dir is
// reused when dir is not empty (restart tests).
func startNode(t *testing.T, dir string, mod func(*config.Config)) *node {
	t.Helper()
	if dir == "" {
		dir = t.TempDir()
	}
	cfg := config.ForTest(func(c *config.Config) {
		c.DataDir = dir
		c.Listen, c.AdminListen = "127.0.0.1:0", "127.0.0.1:0"
		c.Fsync = false
		c.MinFreeMB = 1
		c.ShutdownTimeout = 3 * time.Second
		if mod != nil {
			mod(c)
		}
	})
	return startNodeCfg(t, cfg)
}

// logSink, when set, receives the node's log (tests that read it).
var logSink io.Writer

func startNodeCfg(t *testing.T, cfg *config.Config, hooks ...func(*app.App)) *node {
	t.Helper()
	var w io.Writer = io.Discard
	if logSink != nil {
		w = logSink
	}
	log := slog.New(slog.NewTextHandler(w, nil))
	ctx, cancel := context.WithCancel(context.Background())
	a, err := app.New(ctx, cfg, log, app.Build{Version: "test"})
	if err != nil {
		cancel()
		t.Fatal(err)
	}
	for _, h := range hooks {
		h(a)
	}
	n := &node{t: t, cfg: cfg, app: a, s3URL: "http://" + a.PublicAddr(), adminURL: "http://" + a.AdminAddr(), adminTok: cfg.AdminToken[0],
		dir: cfg.DataDir, cancel: cancel, done: make(chan struct{})}
	go func() { _ = a.Run(ctx); close(n.done) }()
	t.Cleanup(n.stop)
	return n
}

// stop shuts the node down gracefully and waits for it.
func (n *node) stop() {
	n.stopOnce.Do(func() {
		n.cancel()
		<-n.done
	})
}

func (n *node) admin(method, path string, body any, hdr ...string) (int, map[string]any) {
	n.t.Helper()
	code, out, _ := n.adminH(method, path, body, hdr...)
	return code, out
}

func (n *node) adminH(method, path string, body any, hdr ...string) (int, map[string]any, http.Header) {
	n.t.Helper()
	var rd io.Reader
	switch b := body.(type) {
	case nil:
	case string:
		rd = strings.NewReader(b)
	default:
		raw, _ := json.Marshal(b)
		rd = bytes.NewReader(raw)
	}
	req, _ := http.NewRequest(method, n.adminURL+"/_admin/v1"+path, rd)
	req.Header.Set("Authorization", "Bearer "+n.adminTok)
	for i := 0; i+1 < len(hdr); i += 2 {
		req.Header.Set(hdr[i], hdr[i+1])
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		n.t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	var out map[string]any
	_ = json.Unmarshal(raw, &out)
	return res.StatusCode, out, res.Header
}

func (n *node) mustAdmin(want int, method, path string, body any, hdr ...string) map[string]any {
	n.t.Helper()
	code, out := n.admin(method, path, body, hdr...)
	if code != want {
		n.t.Fatalf("%s %s: status %d, want %d: %v", method, path, code, want, out)
	}
	return out
}

func (n *node) metrics() string {
	n.t.Helper()
	req, _ := http.NewRequest("GET", n.adminURL+"/_metrics", nil)
	req.Header.Set("Authorization", "Bearer "+n.adminTok)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		n.t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	return string(raw)
}

func (n *node) bucket(name string, settings map[string]any) {
	n.t.Helper()
	body := map[string]any{"name": name}
	for k, v := range settings {
		body[k] = v
	}
	n.mustAdmin(201, "POST", "/buckets", body)
}

func (n *node) token(bucket string, grants any) cred {
	n.t.Helper()
	out := n.mustAdmin(201, "POST", "/buckets/"+bucket+"/tokens", map[string]any{"name": "t", "grants": grants})
	return cred{out["access_key_id"].(string), out["secret_access_key"].(string)}
}

var allGrants = []map[string]any{{"actions": []string{"read", "write", "list", "delete", "purge", "tag"}}}

// s3 sends a SigV4-signed request.
func (n *node) s3(c cred, method, path string, body []byte, hdr ...string) *resp {
	n.t.Helper()
	req, _ := http.NewRequest(method, n.s3URL+path, bytes.NewReader(body))
	for i := 0; i+1 < len(hdr); i += 2 {
		req.Header.Set(hdr[i], hdr[i+1])
	}
	if c.ak != "" {
		sum := sha256.Sum256(body)
		var extra []string
		for k := range req.Header {
			if lk := strings.ToLower(k); strings.HasPrefix(lk, "x-amz-") || lk == "content-md5" {
				extra = append(extra, lk)
			}
		}
		if _, err := sigv4.Sign(req, c.ak, c.sk, "us-east-1", time.Now(), hex.EncodeToString(sum[:]), extra...); err != nil {
			n.t.Fatal(err)
		}
	}
	return n.do(req)
}

// s3b sends a request with a pipeline token as `Authorization: Bearer`.
func (n *node) s3b(bearer, method, path string, body []byte, hdr ...string) *resp {
	n.t.Helper()
	req, _ := http.NewRequest(method, n.s3URL+path, bytes.NewReader(body))
	for i := 0; i+1 < len(hdr); i += 2 {
		req.Header.Set(hdr[i], hdr[i+1])
	}
	req.Header.Set("Authorization", "Bearer "+bearer)
	return n.do(req)
}

func (n *node) do(req *http.Request) *resp {
	n.t.Helper()
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		n.t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	return &resp{res.StatusCode, res.Header, raw}
}

func (n *node) must(c cred, want int, method, path string, body []byte, hdr ...string) *resp {
	n.t.Helper()
	r := n.s3(c, method, path, body, hdr...)
	if r.status != want {
		n.t.Fatalf("%s %s: status %d (%s: %s), want %d", method, path, r.status, r.code(), r.message(), want)
	}
	return r
}

// objPath is the request path of an object.
func objPath(bucket, key string) string {
	parts := strings.Split(key, "/")
	for i, p := range parts {
		parts[i] = url.PathEscape(p)
	}
	return "/" + bucket + "/" + strings.Join(parts, "/")
}

// ---- a fake pipeline service ------------------------------------------------------

// invocation is the parsed request body of a call (spec §7.6), kept as a map
// for the fields tests look at.
type invocation = map[string]any

// call is one request the fake service received.
type call struct {
	Pipeline string
	Inv      invocation
	Header   http.Header
	Raw      []byte
	At       time.Time
}

func (c *call) str(path ...string) string {
	var cur any = c.Inv
	for _, p := range path {
		m, ok := cur.(map[string]any)
		if !ok {
			return ""
		}
		cur = m[p]
	}
	s, _ := cur.(string)
	return s
}

// bearer is the pipeline token of the call as `<id>.<secret>`.
func (c *call) bearer() string { return c.str("s3", "bearer") }

// reply is what a service handler answers.
type reply struct {
	Status     int
	Body       string
	RetryAfter string
	Delay      time.Duration
}

type fakeSvc struct {
	t   *testing.T
	srv *httptest.Server

	mu       sync.Mutex
	calls    []*call
	handlers map[string]func(*call) reply
	byDef    func(*call) reply
}

func newService(t *testing.T) *fakeSvc {
	t.Helper()
	s := &fakeSvc{t: t, handlers: map[string]func(*call) reply{}}
	mux := http.NewServeMux()
	mux.HandleFunc("/hook/", func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		c := &call{Pipeline: strings.TrimPrefix(r.URL.Path, "/hook/"), Header: r.Header.Clone(), Raw: raw, At: time.Now()}
		_ = json.Unmarshal(raw, &c.Inv)
		s.mu.Lock()
		s.calls = append(s.calls, c)
		h := s.handlers[c.Pipeline]
		s.mu.Unlock()
		rep := reply{Status: 204}
		if h != nil {
			rep = h(c)
		}
		if rep.Delay > 0 {
			select {
			case <-time.After(rep.Delay):
			case <-r.Context().Done():
				return
			}
		}
		if rep.RetryAfter != "" {
			w.Header().Set("Retry-After", rep.RetryAfter)
		}
		if rep.Body != "" {
			w.Header().Set("Content-Type", "application/json")
		}
		if rep.Status == 0 {
			rep.Status = 204
		}
		w.WriteHeader(rep.Status)
		_, _ = io.WriteString(w, rep.Body)
	})
	s.srv = httptest.NewServer(mux)
	t.Cleanup(s.srv.Close)
	return s
}

// on sets the handler of a pipeline's hook.
func (s *fakeSvc) on(pipeline string, h func(*call) reply) {
	s.mu.Lock()
	s.handlers[pipeline] = h
	s.mu.Unlock()
}

func (s *fakeSvc) url(pipeline string) string { return s.srv.URL + "/hook/" + pipeline }

// callsOf returns the calls a pipeline received so far.
func (s *fakeSvc) callsOf(pipeline string) []*call {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []*call
	for _, c := range s.calls {
		if c.Pipeline == pipeline {
			out = append(out, c)
		}
	}
	return out
}

// allCalls returns every call in arrival order.
func (s *fakeSvc) allCalls() []*call {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]*call(nil), s.calls...)
}

// ---- pipelines ------------------------------------------------------------------------

// pipe builds a pipeline definition pointing at the fake service and at the
// node's S3 listener, merging extra over it.
func (n *node) pipe(svc *fakeSvc, name, stage string, extra map[string]any) map[string]any {
	def := map[string]any{
		"name": name, "stage": stage,
		"service": map[string]any{"url": svc.url(name), "s3_endpoint": n.s3URL},
	}
	for k, v := range extra {
		if k == "service" {
			s := def["service"].(map[string]any)
			for sk, sv := range v.(map[string]any) {
				s[sk] = sv
			}
			continue
		}
		def[k] = v
	}
	return def
}

// createPipe creates a pipeline (201).
func (n *node) createPipe(svc *fakeSvc, name, stage string, extra map[string]any) map[string]any {
	n.t.Helper()
	return n.mustAdmin(201, "POST", "/pipelines", n.pipe(svc, name, stage, extra))
}

// attach replaces a bucket's attachments with the named pipelines, enabled.
func (n *node) attach(bucket string, names ...string) map[string]any {
	n.t.Helper()
	items := make([]map[string]any, len(names))
	for i, nm := range names {
		items[i] = map[string]any{"pipeline": nm, "enabled": true}
	}
	return n.mustAdmin(200, "PUT", "/buckets/"+bucket+"/pipelines", map[string]any{"items": items})
}

// ---- waiting ----------------------------------------------------------------------------

// eventually polls cond until it holds or the timeout passes.
func eventually(t *testing.T, timeout time.Duration, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for {
		if cond() {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// runs lists runs through the admin API with the given query.
func (n *node) runs(query string) []map[string]any {
	n.t.Helper()
	out := n.mustAdmin(200, "GET", "/runs?"+query, nil)
	items, _ := out["items"].([]any)
	var runs []map[string]any
	for _, it := range items {
		runs = append(runs, it.(map[string]any))
	}
	return runs
}

// waitRun waits until exactly one run matches the query and has the state.
func (n *node) waitRunState(query, state string) map[string]any {
	n.t.Helper()
	var got map[string]any
	eventually(n.t, 10*time.Second, "a run in state "+state+" for "+query, func() bool {
		for _, r := range n.runs(query) {
			if r["state"] == state {
				got = r
				return true
			}
		}
		return false
	})
	return got
}

func str(m map[string]any, k string) string {
	s, _ := m[k].(string)
	return s
}

func num(m map[string]any, k string) float64 {
	f, _ := m[k].(float64)
	return f
}

// restart stops the node and starts another on the same data directory and keys.
func (n *node) restart(mod func(*config.Config)) *node {
	n.t.Helper()
	n.stop()
	cfg := *n.cfg
	cfg.Listen, cfg.AdminListen = "127.0.0.1:0", "127.0.0.1:0"
	if mod != nil {
		mod(&cfg)
	}
	return startNodeCfg(n.t, &cfg)
}

func crc32IEEE(b []byte) string {
	s := crc32.ChecksumIEEE(b)
	return base64.StdEncoding.EncodeToString([]byte{byte(s >> 24), byte(s >> 16), byte(s >> 8), byte(s)})
}

// signedReq builds a SigV4-signed request without sending it.
func (n *node) signedReq(c cred, method, path string, body []byte, hdr ...string) *http.Request {
	n.t.Helper()
	req, _ := http.NewRequest(method, n.s3URL+path, bytes.NewReader(body))
	for i := 0; i+1 < len(hdr); i += 2 {
		req.Header.Set(hdr[i], hdr[i+1])
	}
	sum := sha256.Sum256(body)
	var extra []string
	for k := range req.Header {
		if lk := strings.ToLower(k); strings.HasPrefix(lk, "x-amz-") || lk == "content-md5" {
			extra = append(extra, lk)
		}
	}
	if _, err := sigv4.Sign(req, c.ak, c.sk, "us-east-1", time.Now(), hex.EncodeToString(sum[:]), extra...); err != nil {
		n.t.Fatal(err)
	}
	return req
}

// slowBody emits its bytes one at a time, pausing between them.
type slowBody struct {
	data  []byte
	pause time.Duration
	pos   int
}

func newSlowBody(s string, pause time.Duration) *slowBody {
	return &slowBody{data: []byte(s), pause: pause}
}

func (b *slowBody) Read(p []byte) (int, error) {
	if b.pos >= len(b.data) {
		return 0, io.EOF
	}
	time.Sleep(b.pause)
	p[0] = b.data[b.pos]
	b.pos++
	return 1, nil
}

// s3bStream sends a pipeline-token request whose body arrives slowly and
// returns its status, 0 when the connection failed.
func (n *node) s3bStream(bearer, method, path string, body *slowBody, hdr ...string) int {
	req, _ := http.NewRequest(method, n.s3URL+path, body)
	req.ContentLength = int64(len(body.data))
	for i := 0; i+1 < len(hdr); i += 2 {
		req.Header.Set(hdr[i], hdr[i+1])
	}
	req.Header.Set("Authorization", "Bearer "+bearer)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, res.Body)
	return res.StatusCode
}

// assertNoStaged waits for tmp/ to be empty: every staged file was either
// committed or discarded.
func (n *node) assertNoStaged() {
	n.t.Helper()
	eventually(n.t, 5*time.Second, "tmp/ to be empty", func() bool {
		ents, err := os.ReadDir(filepath.Join(n.dir, "tmp"))
		return err == nil && len(ents) == 0
	})
}
