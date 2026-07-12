package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
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

// fakeClassify satisfies classifyService without decoding an image or linking
// ONNX Runtime: it records the bytes it was handed and returns a canned
// verdict/error, so handleClassify's HTTP concerns can be tested in isolation.
type fakeClassify struct {
	verdict policy.Verdict
	err     error
	gotData []byte
}

func (f *fakeClassify) Do(_ context.Context, data []byte) (policy.Verdict, error) {
	f.gotData = data
	return f.verdict, f.err
}

func newClassifyServer(cs classifyService, maxBodyMB int) *Server {
	return &Server{
		state:    state.New(),
		model:    fakeModel{info: model.ModelInfo{Name: "nsfw-mobilenet", Version: "1.0.0", Quantization: "int8", Labels: []string{"safe", "porn"}}},
		classify: cs,
		limits:   handlerLimits{MaxBodyMB: maxBodyMB, RequestTimeout: 5 * time.Second},
		log:      slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
}

func decodeErr(t *testing.T, body []byte) errBody {
	t.Helper()
	var e errBody
	if err := json.Unmarshal(body, &e); err != nil {
		t.Fatalf("error body not valid JSON: %v (body=%s)", err, body)
	}
	return e
}

// TestHandleClassifyRawSuccess covers the raw-bytes happy path: the service's
// verdict is rendered as the spec §5 body, the decision counter is bumped, the
// decision is stashed on the request context for the observe middleware, and
// the exact bytes are forwarded to the service.
func TestHandleClassifyRawSuccess(t *testing.T) {
	raw := []byte("\xff\xd8not-a-real-jpeg-but-bytes")
	cs := &fakeClassify{verdict: policy.Verdict{
		Decision:    policy.DecisionBlock,
		UnsafeScore: 0.9,
		Scores:      map[string]float32{"safe": 0.1, "porn": 0.9},
	}}
	s := newClassifyServer(cs, 10)

	req := httptest.NewRequest("POST", "/v1/classify", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "image/jpeg")
	rr := httptest.NewRecorder()
	s.handleClassify(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%s)", rr.Code, rr.Body)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
	if !bytes.Equal(cs.gotData, raw) {
		t.Errorf("service received %q, want the raw request body %q", cs.gotData, raw)
	}

	var resp classifyResp
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("body not valid JSON: %v", err)
	}
	if resp.Decision != "block" {
		t.Errorf("Decision = %q, want block", resp.Decision)
	}
	if resp.UnsafeScore != float32(0.9) {
		t.Errorf("UnsafeScore = %v, want 0.9", resp.UnsafeScore)
	}
	if resp.Scores["porn"] != 0.9 || resp.Scores["safe"] != 0.1 {
		t.Errorf("Scores = %v, want the verdict breakdown", resp.Scores)
	}
	if resp.Model.Name != "nsfw-mobilenet" || resp.Model.Version != "1.0.0" || resp.Model.Quantization != "int8" {
		t.Errorf("Model = %+v, want the fake model.Info()", resp.Model)
	}
	if resp.LatencyMs < 0 {
		t.Errorf("LatencyMs = %d, want >= 0", resp.LatencyMs)
	}

	// The classify-specific counter is bumped here; the generic counters are
	// the observe middleware's job (task 039), so they stay at zero.
	if snap := s.state.Snapshot(); snap.Block != 1 || snap.Requests != 0 {
		t.Errorf("snapshot = {Block:%d Requests:%d}, want {Block:1 Requests:0}", snap.Block, snap.Requests)
	}

	// The decision must be retrievable from the request context for the
	// middleware's access-log line.
	if d, ok := decisionFromContext(req.Context()); !ok || d != "block" {
		t.Errorf("decisionFromContext = (%q,%v), want (block,true)", d, ok)
	}

	// Raw field-name check, independent of the struct tags.
	var kv map[string]json.RawMessage
	if err := json.Unmarshal(rr.Body.Bytes(), &kv); err != nil {
		t.Fatalf("re-unmarshal into map: %v", err)
	}
	for _, key := range []string{"decision", "unsafe_score", "scores", "model", "latency_ms"} {
		if _, ok := kv[key]; !ok {
			t.Errorf("response missing key %q", key)
		}
	}
}

// TestHandleClassifyMultipartSuccess covers the multipart/form-data path: the
// "image" file field's bytes reach the service and a verdict comes back.
func TestHandleClassifyMultipartSuccess(t *testing.T) {
	fileBytes := []byte("\x89PNG\r\n\x1a\nfake")
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, err := mw.CreateFormFile("image", "photo.png")
	if err != nil {
		t.Fatalf("CreateFormFile: %v", err)
	}
	if _, err := fw.Write(fileBytes); err != nil {
		t.Fatalf("write file part: %v", err)
	}
	if err := mw.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	cs := &fakeClassify{verdict: policy.Verdict{Decision: policy.DecisionAllow, Scores: map[string]float32{}}}
	s := newClassifyServer(cs, 10)

	req := httptest.NewRequest("POST", "/v1/classify", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rr := httptest.NewRecorder()
	s.handleClassify(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%s)", rr.Code, rr.Body)
	}
	if !bytes.Equal(cs.gotData, fileBytes) {
		t.Errorf("service received %q, want the file part bytes %q", cs.gotData, fileBytes)
	}
}

// TestHandleClassifyMultipartMissingField maps a form without the "image" file
// field to 400 (a client mistake), not 500.
func TestHandleClassifyMultipartMissingField(t *testing.T) {
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	if err := mw.WriteField("caption", "hello"); err != nil {
		t.Fatalf("WriteField: %v", err)
	}
	if err := mw.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}

	s := newClassifyServer(&fakeClassify{}, 10)
	req := httptest.NewRequest("POST", "/v1/classify", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rr := httptest.NewRecorder()
	s.handleClassify(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rr.Code)
	}
	if code := decodeErr(t, rr.Body.Bytes()).Error; code != codeBadRequest {
		t.Errorf("error code = %q, want %q", code, codeBadRequest)
	}
}

// TestHandleClassifyEmptyBody maps a zero-length body to 400 empty_body.
func TestHandleClassifyEmptyBody(t *testing.T) {
	s := newClassifyServer(&fakeClassify{}, 10)
	req := httptest.NewRequest("POST", "/v1/classify", http.NoBody)
	req.Header.Set("Content-Type", "image/jpeg")
	rr := httptest.NewRecorder()
	s.handleClassify(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rr.Code)
	}
	if code := decodeErr(t, rr.Body.Bytes()).Error; code != codeEmptyBody {
		t.Errorf("error code = %q, want %q", code, codeEmptyBody)
	}
}

// TestHandleClassifyBodyTooLarge trips the MaxBytesReader cap (1 MiB here) with
// a body one byte over, expecting 413 before the service is ever called.
func TestHandleClassifyBodyTooLarge(t *testing.T) {
	cs := &fakeClassify{}
	s := newClassifyServer(cs, 1) // 1 MiB cap
	body := bytes.Repeat([]byte{0xff}, (1<<20)+1)

	req := httptest.NewRequest("POST", "/v1/classify", bytes.NewReader(body))
	req.Header.Set("Content-Type", "image/jpeg")
	rr := httptest.NewRecorder()
	s.handleClassify(rr, req)

	if rr.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413", rr.Code)
	}
	if code := decodeErr(t, rr.Body.Bytes()).Error; code != codeTooLarge {
		t.Errorf("error code = %q, want %q", code, codeTooLarge)
	}
	if cs.gotData != nil {
		t.Errorf("service was called with %q, want no call on overflow", cs.gotData)
	}
}

// TestHandleClassifyErrorMapping pins the typed-error -> status/code table
// (spec §5). The read succeeds; the fake service returns each sentinel.
func TestHandleClassifyErrorMapping(t *testing.T) {
	cases := []struct {
		name       string
		err        error
		wantStatus int
		wantCode   string
	}{
		{"unsupported", imaging.ErrUnsupportedFormat, http.StatusUnsupportedMediaType, codeUnsupportedFormat},
		{"too_large", imaging.ErrTooLarge, http.StatusRequestEntityTooLarge, codeTooLarge},
		{"corrupt", imaging.ErrCorrupt, http.StatusUnprocessableEntity, codeUnprocessable},
		{"busy", classify.ErrQueueTimeout, http.StatusTooManyRequests, codeBusy},
		{"model_unavailable", classify.ErrModelUnavailable, http.StatusServiceUnavailable, codeModelUnavailable},
		{"timeout", context.DeadlineExceeded, http.StatusServiceUnavailable, codeModelUnavailable},
		{"internal", errors.New("boom"), http.StatusInternalServerError, codeInternal},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := newClassifyServer(&fakeClassify{err: tc.err}, 10)
			req := httptest.NewRequest("POST", "/v1/classify", bytes.NewReader([]byte("imgbytes")))
			req.Header.Set("Content-Type", "image/jpeg")
			rr := httptest.NewRecorder()
			s.handleClassify(rr, req)

			if rr.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d", rr.Code, tc.wantStatus)
			}
			if code := decodeErr(t, rr.Body.Bytes()).Error; code != tc.wantCode {
				t.Errorf("error code = %q, want %q", code, tc.wantCode)
			}
		})
	}
}

// TestHandleClassifyWrappedSentinel confirms the mapping uses errors.Is, so a
// wrapped sentinel still resolves to the right status.
func TestHandleClassifyWrappedSentinel(t *testing.T) {
	wrapped := fmt.Errorf("decode step: %w", imaging.ErrCorrupt)
	s := newClassifyServer(&fakeClassify{err: wrapped}, 10)
	req := httptest.NewRequest("POST", "/v1/classify", bytes.NewReader([]byte("imgbytes")))
	req.Header.Set("Content-Type", "image/jpeg")
	rr := httptest.NewRecorder()
	s.handleClassify(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422 for a wrapped ErrCorrupt", rr.Code)
	}
}
