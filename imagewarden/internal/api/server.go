package api

import "sync/atomic"

// Server is the imagewarden API server. This is a minimal placeholder holding
// only what the handlers landing in this task (016) need — the canonical
// definition (classify service, state, limits, logger, startedAt, New, Run)
// lands in task 022, which owns server.go from that point on. Tasks 017-021
// add fields as their handlers need them; there must be exactly one Server
// type in the package (coordinate through this file, not a redefinition).
type Server struct {
	version string
	ready   atomic.Bool // /healthz readiness; flipped true after model load+warmup (task 022)
}
