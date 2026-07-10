package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/kalevski/toolcase/imagewarden/internal/model"
)

// modelInfoProvider is the narrow seam handleStatus needs to describe the
// loaded model: decoupled from the concrete *model.Model so tests can inject
// a fake without an ONNX Runtime session. *model.Model satisfies it today;
// classify.Service (task 014) will forward to it once Server holds a
// classify.Service instead of a bare model reference (task 022).
type modelInfoProvider interface {
	Info() model.ModelInfo
}

// statusResp is the GET /status body (spec §5, §8), built from typed structs
// (not map[string]any) so field names/order are stable for the drift/shape
// test. errors_by_code keys are the string status codes ("413", "500", …).
type statusResp struct {
	UptimeSeconds int64 `json:"uptime_seconds"`
	Model         struct {
		Name         string   `json:"name"`
		Version      string   `json:"version"`
		Quantization string   `json:"quantization"`
		Labels       []string `json:"labels"`
	} `json:"model"`
	Counters struct {
		Requests uint64 `json:"requests"`
		Allow    uint64 `json:"allow"`
		Review   uint64 `json:"review"`
		Block    uint64 `json:"block"`
	} `json:"counters"`
	ErrorsByCode map[string]uint64 `json:"errors_by_code"`
	LatencyMs    struct {
		P50 int `json:"p50"`
		P95 int `json:"p95"`
		P99 int `json:"p99"`
	} `json:"latency_ms"`
}

// handleStatus reports operational state (spec §5, §8): model info, uptime,
// request counters, latency p50/p95/p99, and decisions by type. It is
// read-only and allocation-light so it can be scraped frequently — Snapshot
// is a lock-free/atomic read (task 013) and this handler never mutates state.
func (s *Server) handleStatus(w http.ResponseWriter, _ *http.Request) {
	snap := s.state.Snapshot()
	info := s.model.Info()

	var resp statusResp
	resp.UptimeSeconds = int64(time.Since(s.startedAt).Seconds())
	resp.Model.Name = info.Name
	resp.Model.Version = info.Version
	resp.Model.Quantization = info.Quantization
	resp.Model.Labels = info.Labels
	resp.Counters.Requests = uint64(snap.Requests)
	resp.Counters.Allow = uint64(snap.Allow)
	resp.Counters.Review = uint64(snap.Review)
	resp.Counters.Block = uint64(snap.Block)
	// Snapshot pre-populates every known code at zero (the hot path never
	// grows the map); /status shows only codes that actually fired, so a
	// clean process reports {} instead of a wall of zeros. /metrics keeps
	// the full zero-valued series — Prometheus wants stable label sets.
	resp.ErrorsByCode = make(map[string]uint64, len(snap.ErrorsByCode))
	for code, count := range snap.ErrorsByCode {
		if count > 0 {
			resp.ErrorsByCode[strconv.Itoa(code)] = uint64(count)
		}
	}
	// p50/p95/p99 are reused verbatim from snap so /metrics and /status agree
	// exactly — percentiles are computed once, in internal/state.
	resp.LatencyMs.P50 = int(snap.P50)
	resp.LatencyMs.P95 = int(snap.P95)
	resp.LatencyMs.P99 = int(snap.P99)

	// Mirror nginxpilot's handleStatus verbatim: pretty-print for operator
	// readability and log (don't fail) an encode error — the status line is
	// already committed, so there's nothing left to do but note it happened.
	w.Header().Set("Content-Type", "application/json")
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	if err := enc.Encode(resp); err != nil {
		s.log.Warn("status encode failed", "error", err)
	}
}
