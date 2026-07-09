package api

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/kalevski/toolcase/imagewarden/internal/classify"
	"github.com/kalevski/toolcase/imagewarden/internal/state"
)

// shutdownTimeout bounds the graceful drain on ctx cancel (spec §10): once the
// listener stops accepting, in-flight requests get this long to finish before
// Shutdown forces the remaining connections closed. Mirrors nginxpilot's
// admin.Server drain window.
const shutdownTimeout = 10 * time.Second

// Server is the imagewarden API server: it owns the API's dependencies and
// HTTP lifecycle (spec §10). This is the single definition of the type — every
// handler (016-021) hangs off it, so it is coordinated through this one file,
// never redefined elsewhere.
//
// The classify pipeline and the model descriptor are held behind narrow seams
// (classifyService in classify_handler.go, modelInfoProvider in status.go)
// rather than as concrete types, so the package's tests can stand in a stub and
// never link ONNX Runtime. New wires a single concrete *classify.Service into
// both seams (it satisfies each), which is how production runs.
type Server struct {
	version   string
	ready     atomic.Bool // /healthz readiness; New leaves it false, SetReady flips it true after model load+warmup
	token     string      // api.token_env value; empty = loopback dev mode (task 017 auth)
	state     *state.State
	model     modelInfoProvider // narrow seam for GET /status and /v1/classify's model block (status.go)
	classify  classifyService   // POST /v1/classify pipeline seam (classify_handler.go)
	limits    handlerLimits     // request-size / timeout caps for POST /v1/classify (classify_handler.go)
	startedAt time.Time         // uptime base for GET /status; New sets it to time.Now()
	log       *slog.Logger      // structured logger threaded from cmd/run
}

// New builds a Server with its dependencies wired.
//
//   - svc is the concrete classify pipeline: it satisfies both seams the Server
//     holds — classifyService (Do) and modelInfoProvider (Info) — so a single
//     argument wires the whole classify/status surface.
//   - token is the bearer token (empty = loopback dev mode, task 017); version
//     is the build string threaded from main.version.
//   - maxBodyMB and requestTimeout are the two request caps handleClassify
//     enforces. They are passed as plain stdlib values rather than a
//     config.LimitsConfig on purpose: the api package keeps no dependency on
//     internal/config (see handlerLimits in classify_handler.go), so the caller
//     (cmd/run) passes cfg.Limits.MaxBodyMB and cfg.Limits.RequestTimeout.Std().
//
// Readiness starts false. The caller flips it true via SetReady only after the
// model is loaded and warmed (spec §10 boot order), so a 200 from /healthz is a
// real readiness signal rather than merely "process is up".
func New(svc *classify.Service, st *state.State, token, version string, maxBodyMB int, requestTimeout time.Duration, log *slog.Logger) *Server {
	return &Server{
		version:   version,
		token:     token,
		state:     st,
		model:     svc,
		classify:  svc,
		limits:    handlerLimits{MaxBodyMB: maxBodyMB, RequestTimeout: requestTimeout},
		startedAt: time.Now(),
		log:       log,
	}
}

// SetReady flips the /healthz readiness flag. cmd/run calls SetReady(true) once
// the model is loaded and a warmup inference has succeeded (spec §10); until
// then handleHealthz answers 503. atomic.Bool is used so /healthz reads it
// without taking a lock.
func (s *Server) SetReady(ready bool) { s.ready.Store(ready) }

// Run serves the API on listen until ctx is cancelled, then shuts down
// gracefully (spec §10). Mirrors nginxpilot's admin.Server.Run shape.
//
// Per-request timeout: the mux built by routes() does NOT wrap handlers in
// http.TimeoutHandler. The per-request deadline is enforced inside
// handleClassify via s.limits.RequestTimeout on the classify call (task 019),
// which is the single mechanism — so the two can't stack and race, and the
// timeout surfaces as the uniform {"error","detail"} JSON body (a
// TimeoutHandler would emit its own non-JSON 503 body instead).
func (s *Server) Run(ctx context.Context, listen string) error {
	srv := &http.Server{
		Addr:              listen,
		Handler:           s.routes(),
		ReadHeaderTimeout: 5 * time.Second, // slowloris guard on the request line + headers
	}

	errCh := make(chan error, 1)
	go func() { errCh <- srv.ListenAndServe() }()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx) // best effort; the ctx cancel is the operator's signal to stop
		return nil
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil // clean close (e.g. Shutdown elsewhere), not an error
		}
		return err
	}
}
