package api

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kalevski/toolcase/imagewarden/internal/model"
	"github.com/kalevski/toolcase/imagewarden/internal/state"
)

// fakeModel satisfies modelInfoProvider without an ONNX Runtime session, so
// handleStatus is testable with no CGO.
type fakeModel struct{ info model.ModelInfo }

func (f fakeModel) Info() model.ModelInfo { return f.info }

func newTestServer(st *state.State) *Server {
	return &Server{
		state:     st,
		model:     fakeModel{info: model.ModelInfo{Name: "nsfw-mobilenet", Version: "1.0.0", Quantization: "int8", Labels: []string{"safe", "porn"}}},
		startedAt: time.Now().Add(-5 * time.Second),
		log:       slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
}

// TestHandleStatusShape asserts the exact §5/§8 JSON field names and nesting,
// so the shape can't silently drift.
func TestHandleStatusShape(t *testing.T) {
	st := state.New()
	st.RecordRequest()
	st.RecordDecision("allow")
	st.RecordDecision("allow")
	st.RecordDecision("block")
	st.RecordError(429)
	st.ObserveLatency(10)
	st.ObserveLatency(20)
	st.ObserveLatency(30)

	s := newTestServer(st)

	rr := httptest.NewRecorder()
	s.handleStatus(rr, httptest.NewRequest("GET", "/status", nil))

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}

	var resp statusResp
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("body not valid JSON: %v", err)
	}

	if resp.UptimeSeconds < 5 {
		t.Errorf("UptimeSeconds = %d, want >= 5", resp.UptimeSeconds)
	}
	if resp.Model.Name != "nsfw-mobilenet" || resp.Model.Version != "1.0.0" || resp.Model.Quantization != "int8" {
		t.Errorf("Model = %+v, want name/version/quantization from fake model.Info()", resp.Model)
	}
	if len(resp.Model.Labels) != 2 {
		t.Errorf("Model.Labels = %v, want 2 labels", resp.Model.Labels)
	}
	if resp.Counters.Requests != 1 || resp.Counters.Allow != 2 || resp.Counters.Block != 1 || resp.Counters.Review != 0 {
		t.Errorf("Counters = %+v, want {Requests:1 Allow:2 Review:0 Block:1}", resp.Counters)
	}
	if resp.ErrorsByCode["429"] != 1 {
		t.Errorf(`ErrorsByCode["429"] = %d, want 1`, resp.ErrorsByCode["429"])
	}
	if resp.LatencyMs.P50 != 20 {
		t.Errorf("LatencyMs.P50 = %d, want 20 (matches state.Snapshot's own percentile calc)", resp.LatencyMs.P50)
	}

	// Raw field-name/order check, independent of the Go struct tags, so a
	// typo'd json tag can't hide behind the same struct decoding both ways.
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(rr.Body.Bytes(), &raw); err != nil {
		t.Fatalf("re-unmarshal into map: %v", err)
	}
	for _, key := range []string{"uptime_seconds", "model", "counters", "errors_by_code", "latency_ms"} {
		if _, ok := raw[key]; !ok {
			t.Errorf("response missing top-level key %q", key)
		}
	}
}

// TestHandleStatusEmptyErrorsByCodeNotNull asserts errors_by_code serializes
// as {} rather than null when nothing has errored yet.
func TestHandleStatusEmptyErrorsByCodeNotNull(t *testing.T) {
	s := newTestServer(state.New())

	rr := httptest.NewRecorder()
	s.handleStatus(rr, httptest.NewRequest("GET", "/status", nil))

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(rr.Body.Bytes(), &raw); err != nil {
		t.Fatalf("body not valid JSON: %v", err)
	}
	if got := string(raw["errors_by_code"]); got != "{}" {
		t.Errorf("errors_by_code = %s, want {} (not null)", got)
	}
}

// TestHandleStatusMatchesSnapshotPercentiles pins that /status never
// recomputes percentiles itself — it must echo state.Snapshot's p50/p95/p99
// verbatim, the single source of truth shared with /metrics.
func TestHandleStatusMatchesSnapshotPercentiles(t *testing.T) {
	st := state.New()
	for ms := 1; ms <= 100; ms++ {
		st.ObserveLatency(float64(ms))
	}
	snap := st.Snapshot()

	s := newTestServer(st)
	rr := httptest.NewRecorder()
	s.handleStatus(rr, httptest.NewRequest("GET", "/status", nil))

	var resp statusResp
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("body not valid JSON: %v", err)
	}
	if resp.LatencyMs.P50 != int(snap.P50) || resp.LatencyMs.P95 != int(snap.P95) || resp.LatencyMs.P99 != int(snap.P99) {
		t.Errorf("LatencyMs = %+v, want {%d %d %d} (from state.Snapshot)", resp.LatencyMs, int(snap.P50), int(snap.P95), int(snap.P99))
	}
}
