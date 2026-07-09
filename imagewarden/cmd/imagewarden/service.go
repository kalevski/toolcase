package main

import (
	"log/slog"

	"github.com/kalevski/toolcase/imagewarden/internal/classify"
	"github.com/kalevski/toolcase/imagewarden/internal/config"
	"github.com/kalevski/toolcase/imagewarden/internal/model"
	"github.com/kalevski/toolcase/imagewarden/internal/policy"
)

// buildService is the shared classify bootstrap used by both `run` (the served
// path) and `classify` (the offline path): load + sha256-verify + warm up the
// model, then wire a classify.Service with the limits/policy/concurrency from
// cfg. Centralizing the model.Load -> TensorSpec -> classify.New sequence here
// is what guarantees the two entry points can never drift — tuning thresholds
// or limits in the config shapes the verdict identically for `classify` and
// `run` (spec §7, §11).
//
// The caller owns the returned model's lifecycle. Both callers defer
// m.Close(); the long-lived `run` process additionally defers the process-
// global model.Shutdown() at exit (spec §4.1), which the one-shot `classify`
// does not need because process teardown reclaims it.
func buildService(cfg config.Config, log *slog.Logger) (*model.Model, *classify.Service, error) {
	m, err := model.Load(cfg.Model.Dir, cfg.Inference.Threads, log)
	if err != nil {
		return nil, nil, err
	}
	svc := classify.New(m, m.Spec(), policy.PolicyConfig(cfg.Policy),
		cfg.Inference.Concurrency, cfg.Limits.MaxPixels, cfg.Limits.QueueTimeout.Std())
	return m, svc, nil
}
