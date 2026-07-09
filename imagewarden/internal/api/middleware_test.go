package api

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/imagewarden/internal/classify"
	"github.com/kalevski/toolcase/imagewarden/internal/model"
	"github.com/kalevski/toolcase/imagewarden/internal/state"
)

// This file covers the observe middleware (task 039): the uniform access-log
// line and the generic request/latency/error metrics it records for EVERY
// route. The log is captured into a bytes.Buffer via a JSON slog handler so the
// emitted fields can be parsed and inspected, and so we can assert no image
// bytes ever reach the log (spec §8 privacy stance).

// imageMarker is a recognizable pattern fed as the request body; if any layer
// leaked body/image content into the access log, this string would appear in
// the captured buffer.
const imageMarker = "IMGWARDEN_SECRET_PIXELS"

// newObserveServer builds a ready Server whose logger writes JSON to the
// returned buffer, so tests can parse the access-log lines emitted by observe.
// It mirrors newE2EServer but swaps the discard logger for a capturing one.
func newObserveServer(t *testing.T, stub *stubClassifier) (*Server, *state.State, *bytes.Buffer) {
	t.Helper()
	var buf bytes.Buffer
	svc := classify.New(stub, e2eSpec, e2ePolicy, 2, e2eMaxPixels, 100*time.Millisecond)
	st := state.New()
	s := New(svc, st, e2eToken, "v9.9.9", 1 /*MiB*/, time.Second,
		slog.New(slog.NewJSONHandler(&buf, nil)))
	s.SetReady(true)
	return s, st, &buf
}

// logLines parses every JSON object emitted to the buffer into a slice of maps.
func logLines(t *testing.T, buf *bytes.Buffer) []map[string]any {
	t.Helper()
	var out []map[string]any
	for _, line := range strings.Split(strings.TrimSpace(buf.String()), "\n") {
		if line == "" {
			continue
		}
		var m map[string]any
		if err := json.Unmarshal([]byte(line), &m); err != nil {
			t.Fatalf("log line not valid JSON: %v (line=%s)", err, line)
		}
		out = append(out, m)
	}
	return out
}

// TestObserveLogsEveryRequest asserts exactly one access-log line per request,
// carrying the spec §8 fields (method, path, status, latency_ms, bytes), and
// that observe records the generic counters uniformly — even for a public route
// (/version) that never touched state before.
func TestObserveLogsEveryRequest(t *testing.T) {
	s, st, buf := newObserveServer(t, &stubClassifier{})

	rr := serve(s, httptest.NewRequest("GET", "/version", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%s)", rr.Code, rr.Body)
	}

	lines := logLines(t, buf)
	if len(lines) != 1 {
		t.Fatalf("got %d log lines, want exactly 1: %s", len(lines), buf.String())
	}
	line := lines[0]
	for _, field := range []string{"method", "path", "status", "latency_ms", "bytes"} {
		if _, ok := line[field]; !ok {
			t.Errorf("log line missing field %q: %v", field, line)
		}
	}
	if line["method"] != "GET" {
		t.Errorf("method = %v, want GET", line["method"])
	}
	// path is the route pattern (task 039), not the raw URL path.
	if line["path"] != "GET /version" {
		t.Errorf("path = %v, want the route pattern %q", line["path"], "GET /version")
	}
	if line["status"] != float64(http.StatusOK) { // JSON numbers decode as float64
		t.Errorf("status = %v, want 200", line["status"])
	}
	// /version carries no decision field.
	if _, ok := line["decision"]; ok {
		t.Errorf("log line unexpectedly carries a decision field: %v", line)
	}

	// Generic metrics are recorded by observe, not the handler.
	if snap := st.Snapshot(); snap.Requests != 1 {
		t.Errorf("snapshot.Requests = %d, want 1", snap.Requests)
	}
}

// TestObserveCapturesErrorStatus asserts the status recorder captures error
// codes (413 body-too-large, 401 unauthorized) — not the implicit 200 — and
// that observe tallies them as errors in state.
func TestObserveCapturesErrorStatus(t *testing.T) {
	t.Run("413 too large", func(t *testing.T) {
		s, st, buf := newObserveServer(t, &stubClassifier{})
		body := bytes.Repeat([]byte{0xff}, (1<<20)+1) // one byte over the 1 MiB cap

		rr := serve(s, classifyReq(body, e2eToken))
		if rr.Code != http.StatusRequestEntityTooLarge {
			t.Fatalf("status = %d, want 413 (body=%s)", rr.Code, rr.Body)
		}
		line := logLines(t, buf)[0]
		if line["status"] != float64(http.StatusRequestEntityTooLarge) {
			t.Errorf("logged status = %v, want 413 (not the implicit 200)", line["status"])
		}
		if snap := st.Snapshot(); snap.ErrorsByCode[413] != 1 {
			t.Errorf("snapshot.ErrorsByCode[413] = %d, want 1", snap.ErrorsByCode[413])
		}
	})

	t.Run("401 unauthorized", func(t *testing.T) {
		s, st, buf := newObserveServer(t, &stubClassifier{})

		// No Authorization header: auth rejects before the handler runs, but
		// observe (outermost) still logs and counts the 401.
		rr := serve(s, classifyReq(testPNG(t), ""))
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401 (body=%s)", rr.Code, rr.Body)
		}
		line := logLines(t, buf)[0]
		if line["status"] != float64(http.StatusUnauthorized) {
			t.Errorf("logged status = %v, want 401", line["status"])
		}
		if snap := st.Snapshot(); snap.Requests != 1 || snap.ErrorsByCode[401] != 1 {
			t.Errorf("snapshot = {Requests:%d Errors[401]:%d}, want {1 1}",
				snap.Requests, snap.ErrorsByCode[401])
		}
	})
}

// TestObserveAddsDecision asserts the classify happy path attaches the decision
// field to the access-log line (handed over via the request-context key).
func TestObserveAddsDecision(t *testing.T) {
	stub := &stubClassifier{scores: model.Scores{"safe": 0.1, "porn": 0.9}} // -> block
	s, _, buf := newObserveServer(t, stub)

	rr := serve(s, classifyReq(testPNG(t), e2eToken))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%s)", rr.Code, rr.Body)
	}
	line := logLines(t, buf)[0]
	if line["decision"] != "block" {
		t.Errorf("decision = %v, want block", line["decision"])
	}
}

// TestObserveNeverLogsImageBytes feeds a recognizable marker as the request
// body on both a success (200) and an error (413) path and asserts the marker
// never appears anywhere in the captured log — the middleware must never log
// request/response bodies or image content (spec §8).
func TestObserveNeverLogsImageBytes(t *testing.T) {
	t.Run("success path", func(t *testing.T) {
		stub := &stubClassifier{scores: model.Scores{"safe": 1}}
		s, _, buf := newObserveServer(t, stub)

		// A valid PNG with the marker appended as trailing bytes: image.Decode
		// stops at IEND and ignores the tail, so this still classifies 200 while
		// carrying the marker in the request body.
		body := append(testPNG(t), []byte(imageMarker)...)
		rr := serve(s, classifyReq(body, e2eToken))
		if rr.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200 (body=%s)", rr.Code, rr.Body)
		}
		if strings.Contains(buf.String(), imageMarker) {
			t.Errorf("marker %q leaked into the access log: %s", imageMarker, buf.String())
		}
	})

	t.Run("error path", func(t *testing.T) {
		s, _, buf := newObserveServer(t, &stubClassifier{})

		// Marker padded past the 1 MiB cap so it trips 413 before decode.
		body := append([]byte(imageMarker), bytes.Repeat([]byte{0xff}, 1<<20)...)
		rr := serve(s, classifyReq(body, e2eToken))
		if rr.Code != http.StatusRequestEntityTooLarge {
			t.Fatalf("status = %d, want 413 (body=%s)", rr.Code, rr.Body)
		}
		if strings.Contains(buf.String(), imageMarker) {
			t.Errorf("marker %q leaked into the access log: %s", imageMarker, buf.String())
		}
	})
}
