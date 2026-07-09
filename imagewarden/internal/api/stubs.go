package api

import "net/http"

// Temporary stubs so the package compiles once endpoints() (task 016)
// references these handlers. Each is replaced by its dedicated task and this
// file shrinks accordingly, disappearing once 019 and 021 land:
//   - handleSchema:   task 018 (self-describing endpoint list) — done, see schema.go
//   - handleClassify: task 019 (POST /v1/classify)
//   - handleStatus:   task 020 (GET /status) — done, see status.go
//   - handleMetrics:  task 021 (GET /metrics)

func (s *Server) handleClassify(w http.ResponseWriter, _ *http.Request) {
	writeErr(w, http.StatusNotImplemented, codeInternal, "not implemented (task 019)")
}

func (s *Server) handleMetrics(w http.ResponseWriter, _ *http.Request) {
	writeErr(w, http.StatusNotImplemented, codeInternal, "not implemented (task 021)")
}
