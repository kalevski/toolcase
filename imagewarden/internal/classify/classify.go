package classify

import (
	"context"
	"errors"
	"time"

	"github.com/kalevski/toolcase/imagewarden/internal/imaging"
	"github.com/kalevski/toolcase/imagewarden/internal/model"
	"github.com/kalevski/toolcase/imagewarden/internal/policy"
)

// Classifier is the narrow seam the service (and its tests) depend on for
// inference. The real *model.Model satisfies it, and a fake satisfies it
// without CGO.
//
// Layering: classify imports model purely for the model.Scores / model.ModelInfo
// types — never the concrete *model.Model. Those types are plain data, so
// importing the package links no ONNX Runtime; only constructing a real
// *model.Model touches the runtime binding. The import-boundary test (task 041)
// permits classify -> model, so this is the intended layering and it lets
// classify_test.go stand in a fake Classifier and never link ORT.
type Classifier interface {
	Classify(imaging.Tensor) (model.Scores, error)
	Info() model.ModelInfo
}

var (
	// ErrQueueTimeout is returned when the inference concurrency semaphore
	// could not be acquired within queueTimeout. The API maps it to HTTP 429.
	ErrQueueTimeout = errors.New("classify: inference queue timeout")

	// ErrModelUnavailable signals that inference could not run because the
	// model backend is unavailable. The API maps it to HTTP 503. The service
	// does not itself raise this today — model errors bubble up unchanged — but
	// the sentinel lives here so an adapter (or a future backend) can wrap it
	// and the API's error mapping has a single source of truth.
	ErrModelUnavailable = errors.New("classify: model unavailable")
)

// Service is the orchestration seam between the API and the pure packages
// (imaging, model, policy): it preprocesses, runs inference under a concurrency
// semaphore with a queue timeout, and applies policy (spec §4, §4.1, §10).
type Service struct {
	spec         imaging.TensorSpec
	model        Classifier
	policy       policy.PolicyConfig
	sem          chan struct{}
	maxPixels    int
	queueTimeout time.Duration
}

// New builds a Service. concurrency sizes the inference semaphore: at most
// concurrency Classify calls run at once, and further callers block up to
// queueTimeout before being rejected with ErrQueueTimeout.
func New(m Classifier, spec imaging.TensorSpec, p policy.PolicyConfig,
	concurrency, maxPixels int, queueTimeout time.Duration) *Service {
	return &Service{
		spec:         spec,
		model:        m,
		policy:       p,
		sem:          make(chan struct{}, concurrency),
		maxPixels:    maxPixels,
		queueTimeout: queueTimeout,
	}
}

// Do runs the full classify pipeline for one image: prepare -> gated inference
// -> policy decision.
//
//  1. imaging.Prepare decodes, guards, and tensorizes the bytes. Its typed
//     sentinels (imaging.ErrUnsupportedFormat / ErrCorrupt / ErrTooLarge) flow
//     out unchanged so the API can map them to the right status code.
//  2. The inference semaphore is acquired with a timeout. If the queue timeout
//     fires, ErrQueueTimeout is returned (API -> 429); if ctx is cancelled,
//     ctx.Err() is returned. The slot is released via defer once acquired.
//  3. The model runs and policy.Decide turns the scores into a Verdict.
//
// Latency measurement lives in the API handler (task 019), not here: the
// handler owns the response's latency_ms field and the state.ObserveLatency
// call, which keeps classify free of the metrics dependency. This is the
// contract tasks 019 and 013 rely on.
func (s *Service) Do(ctx context.Context, data []byte) (policy.Verdict, error) {
	tensor, err := imaging.Prepare(data, s.spec, s.maxPixels)
	if err != nil {
		return policy.Verdict{}, err // typed imaging errors flow out unchanged
	}

	// A real timer (stopped via defer) rather than time.After avoids leaking a
	// timer per rejected request while it drains.
	t := time.NewTimer(s.queueTimeout)
	defer t.Stop()
	select {
	case s.sem <- struct{}{}:
		defer func() { <-s.sem }()
	case <-ctx.Done():
		return policy.Verdict{}, ctx.Err()
	case <-t.C:
		return policy.Verdict{}, ErrQueueTimeout
	}

	scores, err := s.model.Classify(tensor)
	if err != nil {
		return policy.Verdict{}, err // model errors bubble; adapter may wrap ErrModelUnavailable
	}
	return policy.Decide(scores, s.policy), nil
}
