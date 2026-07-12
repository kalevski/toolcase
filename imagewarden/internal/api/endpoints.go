package api

import "net/http"

// endpoint is one API route. The table is the single source of truth
// (nginxpilot idiom, spec §5): routes() registers it, GET /schema documents
// it (task 018), and a drift test (task 018) asserts the two can never
// diverge.
type endpoint struct {
	method  string
	pattern string // net/http 1.22+ pattern; imagewarden's surface is flat (no {param})
	auth    bool
	handler func(s *Server) http.HandlerFunc
}

// endpoints returns the full API surface in registration order (spec §5).
func endpoints() []endpoint {
	return []endpoint{
		{"GET", "/healthz", false, func(s *Server) http.HandlerFunc { return s.handleHealthz }},
		{"GET", "/schema", false, func(s *Server) http.HandlerFunc { return s.handleSchema }},
		{"GET", "/version", false, func(s *Server) http.HandlerFunc { return s.handleVersion }},
		{"GET", "/status", true, func(s *Server) http.HandlerFunc { return s.handleStatus }},
		{"POST", "/v1/classify", true, func(s *Server) http.HandlerFunc { return s.handleClassify }},
		{"GET", "/metrics", true, func(s *Server) http.HandlerFunc { return s.handleMetrics }},
	}
}

// routes builds the mux from the endpoints table above.
//
// Wrap order is observe(auth(handler)) for authed routes and observe(handler)
// for public ones: observe (task 039) is the OUTERMOST layer, outside auth
// (task 017), on purpose. auth rejects an unauthenticated request before next
// ever runs, but because observe wraps auth its statusRecorder still sees the
// 401 auth writes — so a rejected request is logged and counted just like any
// other. Put auth outside instead and 401s would vanish from the access log
// and the request/error metrics, defeating spec §8's "the server is
// observable" requirement.
func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()
	for _, e := range endpoints() {
		h := e.handler(s)
		if e.auth {
			h = s.auth(h) // bearer-token middleware, task 017
		}
		// Outermost layer: log + metrics for every request, including the 401s
		// auth emits (task 039).
		h = s.observe(h)
		mux.HandleFunc(e.method+" "+e.pattern, h) // "GET /healthz", "POST /v1/classify", …
	}
	return mux
}

// handleHealthz reports liveness: model loaded AND warmed (spec §5). ready is
// flipped true only after model.Load + warmup succeed (task 022), so a 200
// here is a real readiness signal, not just "process is up". Plain text, not
// JSON — the imagewarden healthcheck subcommand (task 028) and the Docker
// HEALTHCHECK both depend on this exact contract.
func (s *Server) handleHealthz(w http.ResponseWriter, _ *http.Request) {
	if !s.ready.Load() {
		writeErr(w, http.StatusServiceUnavailable, codeModelUnavailable, "model not ready")
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("ok\n"))
}

// handleVersion reports build info. s.version is threaded from main.version
// (set via -ldflags -X main.version) through the Server constructor (task
// 022) — this package never imports package main.
func (s *Server) handleVersion(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"name":    "imagewarden",
		"version": s.version,
	})
}
