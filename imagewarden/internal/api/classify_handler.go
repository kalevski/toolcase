package api

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/kalevski/toolcase/imagewarden/internal/classify"
	"github.com/kalevski/toolcase/imagewarden/internal/imaging"
	"github.com/kalevski/toolcase/imagewarden/internal/policy"
)

// classifyService is the narrow seam handleClassify needs from the classify
// pipeline: run one image's bytes through decode -> gated inference -> policy
// decision. *classify.Service satisfies it; a fake satisfies it too, so the
// api package's tests never have to link ONNX Runtime (same discipline as
// modelInfoProvider in status.go). The concrete type is wired onto Server in
// task 022's constructor.
type classifyService interface {
	Do(ctx context.Context, data []byte) (policy.Verdict, error)
}

// handlerLimits carries the two request caps handleClassify enforces, as plain
// stdlib types. config's LimitsConfig stores RequestTimeout as a config.Duration;
// task 022's constructor converts it with .Std() when populating this, so the
// api package keeps no dependency on internal/config.
type handlerLimits struct {
	MaxBodyMB      int           // body cap in MiB; see the <<20 shift below
	RequestTimeout time.Duration // per-request deadline handed to classify.Service.Do
}

// ctxKey is the private type for this package's request-context values, so a
// key here can never collide with one from another package.
type ctxKey int

// decisionKey stores the classify decision string ("allow"/"review"/"block")
// on the request context. handleClassify stashes it on success; the observe
// middleware (task 039) — which wraps this handler — reads it back via
// decisionFromContext so it can attach the decision to the access-log line
// without re-running any business logic. The mechanism is an explicit
// *r = *r.WithContext(...) replace (below): because the middleware holds the
// same *http.Request pointer it passed to next(), overwriting *r makes the
// updated context visible to the middleware after the handler returns.
const decisionKey ctxKey = iota

// decisionFromContext returns the decision stashed by handleClassify, if any.
// Task 039's observe middleware is the intended reader.
func decisionFromContext(ctx context.Context) (string, bool) {
	d, ok := ctx.Value(decisionKey).(string)
	return d, ok
}

// modelBlock is the "model" object of the /v1/classify response (spec §5). It
// deliberately omits the "labels" list that /status's model block carries —
// see the schema note on ClassifyResult in schema.go.
type modelBlock struct {
	Name         string `json:"name"`
	Version      string `json:"version"`
	Quantization string `json:"quantization"`
}

// classifyResp is the POST /v1/classify success body (spec §5). Field order and
// json tags match the spec exactly and mirror the "ClassifyResult" component in
// schema.go — keep the three in sync.
type classifyResp struct {
	Decision    string             `json:"decision"`
	UnsafeScore float32            `json:"unsafe_score"`
	Scores      map[string]float32 `json:"scores"`
	Model       modelBlock         `json:"model"`
	LatencyMs   int                `json:"latency_ms"`
}

// handleClassify implements POST /v1/classify (spec §5), the product's core
// endpoint: read the image bytes (raw or multipart), enforce the body cap, run
// the classify service, and return the verdict — mapping every typed error to
// its status code. All business logic (decode/infer/decide) lives in
// classify/imaging/policy; this handler is HTTP concerns only.
//
// Error-code vocabulary: this handler emits only codes already defined in
// errors.go (the single source of truth, spec §5) rather than inventing new
// literal strings — so the body byte cap and the decoded-image size cap both
// surface as codeTooLarge at 413, and a corrupt/over-pixel image as
// codeUnprocessable at 422. The status codes themselves follow imaging's
// sentinel contract (imaging/errors.go): ErrTooLarge -> 413, ErrCorrupt -> 422,
// ErrUnsupportedFormat -> 415.
//
// Timeout precedence: s.limits.RequestTimeout is the inner, classify-specific
// deadline applied to Service.Do here. If task 022 also wraps handlers in an
// http.TimeoutHandler, that is an outer wall-clock guard on the whole handler
// (including the response write); whichever elapses first wins. A trip of the
// inner deadline surfaces as context.DeadlineExceeded and maps to 503 (below).
func (s *Server) handleClassify(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	// Cap the body once. MaxBytesReader replaces r.Body, so the multipart
	// parser is bounded too, and it writes a Connection: close on overflow —
	// that's expected.
	maxBytes := int64(s.limits.MaxBodyMB) << 20
	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)

	// Read the image bytes, supporting both raw and multipart modes (spec §5).
	// Content-Type is advisory only for format — imaging.Decode sniffs the real
	// format; here it only selects the transport parsing mode.
	var (
		data []byte
		err  error
	)
	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		// maxBytes bounds the in-memory portion; the rest spills to bounded temp
		// files, with the overall cap still enforced by MaxBytesReader.
		if err = r.ParseMultipartForm(maxBytes); err == nil {
			defer r.MultipartForm.RemoveAll() // drop any temp files
			f, _, ferr := r.FormFile("image")
			if ferr != nil {
				err = ferr
			} else {
				defer f.Close()
				data, err = io.ReadAll(f)
			}
		}
	} else {
		data, err = io.ReadAll(r.Body)
	}

	// Cap overflow from either read path, checked before the generic branch.
	var mbe *http.MaxBytesError
	if errors.As(err, &mbe) {
		writeErr(w, http.StatusRequestEntityTooLarge, codeTooLarge,
			"request body exceeds the configured size limit")
		return
	}
	// A missing multipart "image" field is a client mistake, not a server error.
	if errors.Is(err, http.ErrMissingFile) {
		writeErr(w, http.StatusBadRequest, codeBadRequest,
			`multipart form is missing the required "image" file field`)
		return
	}
	if err != nil {
		writeErr(w, http.StatusBadRequest, codeBadRequest, "could not read request body")
		return
	}
	if len(data) == 0 {
		writeErr(w, http.StatusBadRequest, codeEmptyBody, "request body is empty")
		return
	}

	// Apply the per-request deadline and run the pipeline.
	ctx, cancel := context.WithTimeout(r.Context(), s.limits.RequestTimeout)
	defer cancel()

	verdict, err := s.classify.Do(ctx, data)
	if err != nil {
		// Order matters — most specific sentinel first (spec §5 error table).
		switch {
		case errors.Is(err, imaging.ErrUnsupportedFormat):
			writeErr(w, http.StatusUnsupportedMediaType, codeUnsupportedFormat,
				"unsupported or unrecognized image format")
		case errors.Is(err, imaging.ErrTooLarge):
			writeErr(w, http.StatusRequestEntityTooLarge, codeTooLarge,
				"image exceeds the configured size limit")
		case errors.Is(err, imaging.ErrCorrupt):
			writeErr(w, http.StatusUnprocessableEntity, codeUnprocessable,
				"image is corrupt or exceeds the pixel limit")
		case errors.Is(err, classify.ErrQueueTimeout):
			writeErr(w, http.StatusTooManyRequests, codeBusy,
				"inference queue is full; retry shortly")
		case errors.Is(err, classify.ErrModelUnavailable):
			writeErr(w, http.StatusServiceUnavailable, codeModelUnavailable,
				"model is unavailable")
		case errors.Is(err, context.DeadlineExceeded):
			// 503, not 408: the deadline is a server-capacity signal, not a
			// malformed client request (spec §5).
			writeErr(w, http.StatusServiceUnavailable, codeModelUnavailable,
				"inference exceeded the request timeout")
		case errors.Is(err, context.Canceled):
			// The client went away (r.Context() cancelled mid-pipeline). The
			// response is written to a dead connection; what matters is that
			// this is attributed to the client (4xx) and never reaches the
			// default branch, which would log it error-level and count a 500
			// for something that is not a server fault.
			writeErr(w, http.StatusBadRequest, codeBadRequest,
				"client cancelled the request")
		default:
			// Never log the image bytes or decoded pixels (spec §8) — only err.
			s.log.Error("classify failed", "error", err)
			writeErr(w, http.StatusInternalServerError, codeInternal, "internal error")
		}
		return
	}

	// Record only the classify-specific counter here; the generic
	// RecordRequest/ObserveLatency/RecordError and the access-log line are
	// emitted by the observe middleware (task 039) that wraps this handler, so
	// duplicating them here would double-count.
	decision := string(verdict.Decision)
	s.state.RecordDecision(decision)

	// Stash the decision so the observe middleware can log it (see decisionKey).
	*r = *r.WithContext(context.WithValue(r.Context(), decisionKey, decision))

	info := s.model.Info()
	writeJSON(w, http.StatusOK, classifyResp{
		Decision:    decision,
		UnsafeScore: float32(verdict.UnsafeScore),
		Scores:      verdict.Scores,
		Model: modelBlock{
			Name:         info.Name,
			Version:      info.Version,
			Quantization: info.Quantization,
		},
		LatencyMs: int(time.Since(start).Milliseconds()),
	})
}
