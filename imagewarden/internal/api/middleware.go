package api

import (
	"net/http"
	"time"
)

// statusRecorder wraps an http.ResponseWriter to capture the final status code
// and the number of body bytes written, so the observe middleware can log and
// record them after the handler returns. It is allocation-light: exactly one
// per request, with no extra buffering — the writes pass straight through to
// the embedded ResponseWriter.
type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

// WriteHeader records the status before delegating, so a handler that sets an
// explicit code (every error path here, via writeErr) is captured verbatim.
func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// Write captures byte counts and treats a Write that arrives before any
// WriteHeader as the implicit 200 the net/http server would send — so a
// handler that only calls Write (never WriteHeader) still logs status=200.
func (r *statusRecorder) Write(b []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	n, err := r.ResponseWriter.Write(b)
	r.bytes += n
	return n, err
}

// observe is the outermost middleware wrapping every route (see routes()): it
// captures status/bytes/latency for one request, emits the single structured
// access-log line spec §8 requires (method, path, status, latency_ms, bytes —
// never any image content), and records the generic request/latency/error
// metrics in internal/state uniformly for the whole surface.
//
// It is the sole emitter of these signals: handlers must not call
// RecordRequest/ObserveLatency/RecordError or emit an access-log line
// themselves (see the coordination note on handleClassify), so nothing is
// double-counted. The one handler-specific field is "decision": handleClassify
// stashes its verdict on the request context (decisionKey, see
// classify_handler.go); because observe passes the same *http.Request pointer
// to next and the handler overwrites *r in place, decisionFromContext reads the
// decision back here after next returns, and it is added to the log line only
// when present.
//
// Kept allocation-light — one statusRecorder per request, no per-request
// closures beyond this wrap — because it runs on every request, including
// frequent /metrics scrapes.
func (s *Server) observe(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rec := &statusRecorder{ResponseWriter: w}

		start := time.Now()
		next(rec, r)
		ms := int(time.Since(start).Milliseconds())

		// A handler that wrote nothing (no WriteHeader, no Write) leaves status
		// 0; net/http would have sent an implicit 200, so log/record it as 200.
		status := rec.status
		if status == 0 {
			status = http.StatusOK
		}

		// Route pattern (e.g. "POST /v1/classify"), not r.URL.Path/RawQuery, to
		// bound label cardinality and keep any query string out of the log.
		attrs := []any{
			"method", r.Method,
			"path", r.Pattern,
			"status", status,
			"latency_ms", ms,
			"bytes", rec.bytes,
		}
		// decision is present only for a successful classify (handleClassify
		// stashes it); attach it only then so other routes stay clean.
		if d, ok := decisionFromContext(r.Context()); ok && d != "" {
			attrs = append(attrs, "decision", d)
		}
		// Never log the request/response body, form fields, or any image
		// content (spec §8 privacy stance) — only the fields above.
		s.log.Info("request", attrs...)

		s.state.RecordRequest()
		s.state.ObserveLatency(float64(ms))
		if status >= 400 {
			s.state.RecordError(status)
		}
	}
}
