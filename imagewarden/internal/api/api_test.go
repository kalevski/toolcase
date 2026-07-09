package api

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kalevski/toolcase/imagewarden/internal/classify"
	"github.com/kalevski/toolcase/imagewarden/internal/imaging"
	"github.com/kalevski/toolcase/imagewarden/internal/model"
	"github.com/kalevski/toolcase/imagewarden/internal/policy"
	"github.com/kalevski/toolcase/imagewarden/internal/state"
)

// This file is the httptest end-to-end suite (spec §11): it drives the whole
// stack — routes() + auth + handlers — through a Server built by New, backed by
// a REAL classify.Service so the semaphore/queue-timeout path (429) is
// genuinely exercised. Only the model inference is faked, via stubClassifier
// (below), so no ONNX Runtime .so is linked. The two decode/imaging error
// cases (415/422) fall out of the real imaging pipeline, not the stub.

const e2eToken = "s3cr3t-token"

// e2eSpec/e2ePolicy/e2eMaxPixels back the real classify.Service. The spec is a
// tiny 2x2 tensor so tensorize is cheap; the policy makes an unsafe_score >=
// blockThreshold resolve to "block" deterministically.
var (
	e2eSpec = imaging.TensorSpec{
		Width: 2, Height: 2, Layout: "NHWC", Scale: 255,
		Mean: [3]float64{0, 0, 0}, Std: [3]float64{1, 1, 1}, Name: "input",
	}
	e2ePolicy = policy.PolicyConfig{
		UnsafeClasses:   []string{"porn"},
		BlockThreshold:  0.80,
		ReviewThreshold: 0.50,
	}
	e2eModelInfo = model.ModelInfo{
		Name: "stub-nsfw", Version: "1.2.3", Quantization: "int8",
		Labels: []string{"safe", "porn"},
	}
)

const e2eMaxPixels = 1 << 20

// stubClassifier satisfies classify.Classifier so a real classify.Service can
// be constructed without linking ONNX Runtime. Classify returns canned scores
// or an error; if block is non-nil it waits on the channel first, so a caller
// can hold the inference semaphore open and saturate the queue (the 429 case).
type stubClassifier struct {
	scores model.Scores
	err    error
	block  chan struct{}
}

func (c *stubClassifier) Classify(imaging.Tensor) (model.Scores, error) {
	if c.block != nil {
		<-c.block // hold the semaphore slot until released
	}
	if c.err != nil {
		return nil, c.err
	}
	return c.scores, nil
}

func (c *stubClassifier) Info() model.ModelInfo { return e2eModelInfo }

// newE2EServer builds a ready Server over a real classify.Service backed by
// stub. concurrency/queueTimeout size the inference semaphore (429 case);
// maxBodyMB and requestTimeout are the API-layer request caps.
func newE2EServer(stub *stubClassifier, maxBodyMB, concurrency int, queueTimeout, requestTimeout time.Duration) (*Server, *state.State) {
	svc := classify.New(stub, e2eSpec, e2ePolicy, concurrency, e2eMaxPixels, queueTimeout)
	st := state.New()
	s := New(svc, st, e2eToken, "v9.9.9", maxBodyMB, requestTimeout,
		slog.New(slog.NewTextHandler(io.Discard, nil)))
	s.SetReady(true)
	return s, st
}

// testPNG returns a valid, decodable 2x2 PNG.
func testPNG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	for x := 0; x < 2; x++ {
		for y := 0; y < 2; y++ {
			img.Set(x, y, color.RGBA{R: 10, G: 20, B: 30, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode test png: %v", err)
	}
	return buf.Bytes()
}

// corruptPNG returns bytes whose header decodes (DecodeConfig reads the IHDR)
// but whose body is truncated, so a full image.Decode fails — imaging maps that
// to ErrCorrupt (422), distinct from an unrecognized format (415).
func corruptPNG(t *testing.T) []byte {
	t.Helper()
	full := testPNG(t)
	// PNG signature (8) + IHDR chunk (4 len + 4 tag + 13 data + 4 crc = 25) = 33
	// bytes: enough for DecodeConfig, nothing for the pixel data (IDAT).
	if len(full) < 33 {
		t.Fatalf("test png unexpectedly short: %d bytes", len(full))
	}
	return full[:33]
}

// serve runs one request through the full mux (routes() + auth middleware).
func serve(s *Server, req *http.Request) *httptest.ResponseRecorder {
	rr := httptest.NewRecorder()
	s.routes().ServeHTTP(rr, req)
	return rr
}

// classifyReq builds a POST /v1/classify raw-body request with the given token
// (empty token => no Authorization header).
func classifyReq(body []byte, token string) *http.Request {
	req := httptest.NewRequest("POST", "/v1/classify", bytes.NewReader(body))
	req.Header.Set("Content-Type", "image/png")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	return req
}

// assertErrBody decodes the uniform {"error","detail"} envelope (task 015) and
// asserts the machine code; every error path must carry it, not just a status.
func assertErrBody(t *testing.T, body []byte, wantCode string) {
	t.Helper()
	e := decodeErr(t, body)
	if e.Error != wantCode {
		t.Errorf("error code = %q, want %q (body=%s)", e.Error, wantCode, body)
	}
	if e.Detail == "" {
		t.Errorf("error detail is empty, want a human-readable message (body=%s)", body)
	}
}

// TestE2EClassifyHappyPath drives a real image end-to-end through decode ->
// gated inference (stub) -> policy, asserting the exact §5 success shape.
func TestE2EClassifyHappyPath(t *testing.T) {
	stub := &stubClassifier{scores: model.Scores{"safe": 0.1, "porn": 0.9}}
	s, st := newE2EServer(stub, 10, 2, 100*time.Millisecond, time.Second)

	rr := serve(s, classifyReq(testPNG(t), e2eToken))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%s)", rr.Code, rr.Body)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}

	var resp classifyResp
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("body not valid JSON: %v", err)
	}
	if resp.Decision != "block" { // unsafe(porn)=0.9 >= 0.80 blockThreshold
		t.Errorf("Decision = %q, want block", resp.Decision)
	}
	if resp.UnsafeScore != float32(0.9) {
		t.Errorf("UnsafeScore = %v, want 0.9", resp.UnsafeScore)
	}
	if resp.Scores["porn"] != 0.9 || resp.Scores["safe"] != 0.1 {
		t.Errorf("Scores = %v, want the stub breakdown", resp.Scores)
	}
	if resp.Model.Name != e2eModelInfo.Name || resp.Model.Version != e2eModelInfo.Version ||
		resp.Model.Quantization != e2eModelInfo.Quantization {
		t.Errorf("Model = %+v, want %+v (via classify.Service.Info)", resp.Model, e2eModelInfo)
	}
	if resp.LatencyMs < 0 {
		t.Errorf("LatencyMs = %d, want >= 0", resp.LatencyMs)
	}

	// Exact §5 field names, independent of the struct tags.
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(rr.Body.Bytes(), &raw); err != nil {
		t.Fatalf("re-unmarshal into map: %v", err)
	}
	for _, key := range []string{"decision", "unsafe_score", "scores", "model", "latency_ms"} {
		if _, ok := raw[key]; !ok {
			t.Errorf("response missing key %q", key)
		}
	}
	var m struct {
		Name, Version, Quantization string
	}
	if err := json.Unmarshal(raw["model"], &m); err != nil {
		t.Fatalf("model block not an object: %v", err)
	}

	// The classify-specific decision counter is bumped (the generic counters
	// are the observe middleware's job, task 039).
	if snap := st.Snapshot(); snap.Block != 1 {
		t.Errorf("snapshot.Block = %d, want 1", snap.Block)
	}
}

// TestE2EClassifyEmptyBody: a zero-length POST is a 400 empty_body.
func TestE2EClassifyEmptyBody(t *testing.T) {
	s, _ := newE2EServer(&stubClassifier{}, 10, 2, 100*time.Millisecond, time.Second)

	req := httptest.NewRequest("POST", "/v1/classify", http.NoBody)
	req.Header.Set("Content-Type", "image/png")
	req.Header.Set("Authorization", "Bearer "+e2eToken)
	rr := serve(s, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (body=%s)", rr.Code, rr.Body)
	}
	assertErrBody(t, rr.Body.Bytes(), codeEmptyBody)
}

// TestE2EClassifyAuth exercises the auth middleware's constant-time compare on
// both the missing-token and wrong-token paths — each must be 401 before the
// classify pipeline runs.
func TestE2EClassifyAuth(t *testing.T) {
	cases := []struct {
		name  string
		token string
	}{
		{"missing token", ""},
		{"wrong token", "not-the-token"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s, _ := newE2EServer(&stubClassifier{}, 10, 2, 100*time.Millisecond, time.Second)
			rr := serve(s, classifyReq(testPNG(t), tc.token))
			if rr.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d, want 401 (body=%s)", rr.Code, rr.Body)
			}
			assertErrBody(t, rr.Body.Bytes(), codeUnauthorized)
		})
	}
}

// TestE2EClassifyBodyTooLarge trips the MaxBytesReader cap (1 MiB) with a body
// one byte over — 413 before the pipeline is reached.
func TestE2EClassifyBodyTooLarge(t *testing.T) {
	s, _ := newE2EServer(&stubClassifier{}, 1, 2, 100*time.Millisecond, time.Second)
	body := bytes.Repeat([]byte{0xff}, (1<<20)+1)

	rr := serve(s, classifyReq(body, e2eToken))
	if rr.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413 (body=%s)", rr.Code, rr.Body)
	}
	assertErrBody(t, rr.Body.Bytes(), codeTooLarge)
}

// TestE2EClassifyUnsupportedFormat: bytes image.Decode can't sniff -> 415.
func TestE2EClassifyUnsupportedFormat(t *testing.T) {
	s, _ := newE2EServer(&stubClassifier{}, 10, 2, 100*time.Millisecond, time.Second)

	rr := serve(s, classifyReq([]byte("this is definitely not an image"), e2eToken))
	if rr.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("status = %d, want 415 (body=%s)", rr.Code, rr.Body)
	}
	assertErrBody(t, rr.Body.Bytes(), codeUnsupportedFormat)
}

// TestE2EClassifyCorruptImage: a recognized-but-truncated PNG -> 422.
func TestE2EClassifyCorruptImage(t *testing.T) {
	s, _ := newE2EServer(&stubClassifier{}, 10, 2, 100*time.Millisecond, time.Second)

	rr := serve(s, classifyReq(corruptPNG(t), e2eToken))
	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422 (body=%s)", rr.Code, rr.Body)
	}
	assertErrBody(t, rr.Body.Bytes(), codeUnprocessable)
}

// TestE2EClassifyModelUnavailable: the model backend errors -> 503.
func TestE2EClassifyModelUnavailable(t *testing.T) {
	s, _ := newE2EServer(&stubClassifier{err: classify.ErrModelUnavailable}, 10, 2, 100*time.Millisecond, time.Second)

	rr := serve(s, classifyReq(testPNG(t), e2eToken))
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503 (body=%s)", rr.Code, rr.Body)
	}
	assertErrBody(t, rr.Body.Bytes(), codeModelUnavailable)
}

// TestE2EClassifyBusy saturates the real inference semaphore: concurrency 1,
// a blocking stub, and a tiny queue timeout. Firing 2 concurrent requests over
// a real socket forces the second to wait on the semaphore past QueueTimeout
// and come back 429 (classify.ErrQueueTimeout). The request timeout is kept
// generous so the holder isn't cut short as a 503 instead.
func TestE2EClassifyBusy(t *testing.T) {
	block := make(chan struct{})
	stub := &stubClassifier{scores: model.Scores{"safe": 1}, block: block}
	s, _ := newE2EServer(stub, 10, 1, 10*time.Millisecond, 2*time.Second)

	ts := httptest.NewServer(s.routes())
	defer ts.Close()

	imgBytes := testPNG(t)
	results := make(chan int, 2)
	fire := func() {
		req, err := http.NewRequest("POST", ts.URL+"/v1/classify", bytes.NewReader(imgBytes))
		if err != nil {
			results <- -1
			return
		}
		req.Header.Set("Content-Type", "image/png")
		req.Header.Set("Authorization", "Bearer "+e2eToken)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			results <- -1
			return
		}
		defer resp.Body.Close()
		var e errBody
		_ = json.NewDecoder(resp.Body).Decode(&e)
		if resp.StatusCode == http.StatusTooManyRequests && e.Error != codeBusy {
			t.Errorf("429 body code = %q, want %q", e.Error, codeBusy)
		}
		results <- resp.StatusCode
	}
	go fire()
	go fire()

	// The loser hits the 10ms queue timeout and returns first with 429; the
	// winner is still blocked in Classify until we release it.
	first := <-results
	close(block)
	second := <-results

	got := []int{first, second}
	saw429 := false
	for _, code := range got {
		if code == http.StatusTooManyRequests {
			saw429 = true
		}
	}
	if !saw429 {
		t.Fatalf("no 429 among concurrent responses %v; want the semaphore to reject one", got)
	}
}

// TestE2EHealthz: readiness gates /healthz — 503 until SetReady(true), then a
// plain-text 200 "ok".
func TestE2EHealthz(t *testing.T) {
	s, _ := newE2EServer(&stubClassifier{}, 10, 2, 100*time.Millisecond, time.Second)

	s.SetReady(false)
	rr := serve(s, httptest.NewRequest("GET", "/healthz", nil))
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("not-ready /healthz = %d, want 503 (body=%s)", rr.Code, rr.Body)
	}

	s.SetReady(true)
	rr = serve(s, httptest.NewRequest("GET", "/healthz", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("ready /healthz = %d, want 200 (body=%s)", rr.Code, rr.Body)
	}
	if body := rr.Body.String(); body != "ok\n" {
		t.Errorf("healthz body = %q, want %q", body, "ok\n")
	}
	if ct := rr.Header().Get("Content-Type"); ct != "text/plain; charset=utf-8" {
		t.Errorf("healthz Content-Type = %q, want text/plain; charset=utf-8", ct)
	}
}

// TestE2EVersion: GET /version is unauthenticated and returns {name,version}.
func TestE2EVersion(t *testing.T) {
	s, _ := newE2EServer(&stubClassifier{}, 10, 2, 100*time.Millisecond, time.Second)

	rr := serve(s, httptest.NewRequest("GET", "/version", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%s)", rr.Code, rr.Body)
	}
	var v map[string]string
	if err := json.Unmarshal(rr.Body.Bytes(), &v); err != nil {
		t.Fatalf("body not valid JSON: %v", err)
	}
	if v["name"] != "imagewarden" || v["version"] != "v9.9.9" {
		t.Errorf("version body = %v, want name=imagewarden version=v9.9.9", v)
	}
}

// TestE2EStatusRequiresAuth: /status is 401 without a token and 200 JSON with.
func TestE2EStatusRequiresAuth(t *testing.T) {
	s, _ := newE2EServer(&stubClassifier{}, 10, 2, 100*time.Millisecond, time.Second)

	rr := serve(s, httptest.NewRequest("GET", "/status", nil))
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated /status = %d, want 401", rr.Code)
	}
	assertErrBody(t, rr.Body.Bytes(), codeUnauthorized)

	req := httptest.NewRequest("GET", "/status", nil)
	req.Header.Set("Authorization", "Bearer "+e2eToken)
	rr = serve(s, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("authenticated /status = %d, want 200 (body=%s)", rr.Code, rr.Body)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("status Content-Type = %q, want application/json", ct)
	}
}

// TestE2EMetricsRequiresAuth: /metrics is 401 without a token and returns the
// exact Prometheus content type with one.
func TestE2EMetricsRequiresAuth(t *testing.T) {
	s, _ := newE2EServer(&stubClassifier{}, 10, 2, 100*time.Millisecond, time.Second)

	rr := serve(s, httptest.NewRequest("GET", "/metrics", nil))
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated /metrics = %d, want 401", rr.Code)
	}
	assertErrBody(t, rr.Body.Bytes(), codeUnauthorized)

	req := httptest.NewRequest("GET", "/metrics", nil)
	req.Header.Set("Authorization", "Bearer "+e2eToken)
	rr = serve(s, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("authenticated /metrics = %d, want 200 (body=%s)", rr.Code, rr.Body)
	}
	want := "text/plain; version=0.0.4; charset=utf-8"
	if ct := rr.Header().Get("Content-Type"); ct != want {
		t.Errorf("metrics Content-Type = %q, want %q", ct, want)
	}
}

// TestE2ESchemaUnauthenticated: GET /schema needs no token and returns 200 JSON.
func TestE2ESchemaUnauthenticated(t *testing.T) {
	s, _ := newE2EServer(&stubClassifier{}, 10, 2, 100*time.Millisecond, time.Second)

	rr := serve(s, httptest.NewRequest("GET", "/schema", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%s)", rr.Code, rr.Body)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("schema Content-Type = %q, want application/json", ct)
	}
	if !json.Valid(rr.Body.Bytes()) {
		t.Errorf("schema body is not valid JSON")
	}
}

// compile-time guard: the concrete pipeline must satisfy both Server seams, so
// New's single *classify.Service argument really does wire status + classify.
var (
	_ classifyService   = (*classify.Service)(nil)
	_ modelInfoProvider = (*classify.Service)(nil)
)
