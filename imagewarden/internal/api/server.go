package api

import (
	"log/slog"
	"sync/atomic"
	"time"

	"github.com/kalevski/toolcase/imagewarden/internal/state"
)

// Server is the imagewarden API server. This is a minimal placeholder holding
// only what the handlers landing so far (016, 020) need — the canonical
// definition (classify service, limits, New, Run) lands in task 022, which
// owns server.go from that point on. Tasks 017-021 add fields as their
// handlers need them; there must be exactly one Server type in the package
// (coordinate through this file, not a redefinition).
type Server struct {
	version   string
	ready     atomic.Bool // /healthz readiness; flipped true after model load+warmup (task 022)
	token     string      // api.token_env value; empty = loopback dev mode (task 017 auth)
	state     *state.State
	model     modelInfoProvider // narrow seam for GET /status (task 020, see status.go)
	startedAt time.Time         // uptime base for GET /status (task 020); New (task 022) sets it to time.Now()
	log       *slog.Logger      // task 020's encode-error warning; task 022 wires the real logger
}
