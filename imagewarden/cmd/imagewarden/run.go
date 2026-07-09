package main

import (
	"context"
	"flag"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/kalevski/toolcase/imagewarden/internal/api"
	"github.com/kalevski/toolcase/imagewarden/internal/classify"
	"github.com/kalevski/toolcase/imagewarden/internal/config"
	"github.com/kalevski/toolcase/imagewarden/internal/model"
	"github.com/kalevski/toolcase/imagewarden/internal/policy"
	"github.com/kalevski/toolcase/imagewarden/internal/state"
)

// cmdRun is the default subcommand: it boots the classify service and API
// server and serves until SIGTERM/SIGINT, then shuts down gracefully.
//
// Boot order is fail-fast (spec §10): config -> token -> model load + warmup
// -> listen. Every step before the listener opens returns non-zero on failure,
// so a bad config, a missing token, or a bad/mismatched model is caught at
// boot rather than on the first real request. Once the port is up, only a
// Server.Run error (not a clean ctx cancel) is non-zero. Mirrors nginxpilot's
// cmd/nginxpilot/run.go structure and error handling.
func cmdRun(args []string) int {
	fs := flag.NewFlagSet("run", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	logFormat := fs.String("log-format", "json", "logfmt | json")
	_ = fs.Parse(args)

	res, err := config.Load(*configPath) // strict YAML decode
	if err != nil {
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		return 1
	}
	cfg := res.Config
	if err := cfg.Validate(); err != nil { // semantic checks (task 002) — refuse invalid config
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		return 1
	}

	// --log-format is the CLI default source; a format set in the config file
	// takes precedence (task spec §4, point 3). Level is not a config knob, so
	// run logs at info.
	format := cfg.Log.Format
	if format == "" {
		format = *logFormat
	}
	log := newLogger(format, "info")
	for _, w := range res.Warnings {
		log.Warn(w)
	}

	// Token: read the env var at boot, NEVER from YAML (spec §5). Belt-and-
	// suspenders with config.Validate — a non-loopback listen with an empty
	// token must never fall back to unauthenticated serving.
	token := os.Getenv(cfg.API.TokenEnv)
	if token == "" && !isLoopback(cfg.Listen) {
		log.Error("api.token_env is empty and listen is non-loopback; refusing to start",
			"token_env", cfg.API.TokenEnv, "listen", cfg.Listen)
		return 1
	}

	// Boot fail-fast (spec §10): model.Load verifies the sha256 and runs a
	// warmup inference; any failure returns non-zero BEFORE the port opens.
	m, err := model.Load(cfg.Model.Dir, cfg.Inference.Threads, log)
	if err != nil {
		log.Error("model bootstrap failed; refusing to start", "error", err)
		return 1
	}
	// Destroy the session on shutdown, then tear down the process-global ONNX
	// Runtime environment. Defers run LIFO, so Close (registered last) runs
	// before Shutdown (registered first) — the ordering model.Shutdown's
	// contract requires (spec §4.1).
	defer func() { _ = model.Shutdown() }()
	defer func() { _ = m.Close() }()

	svc := classify.New(m, m.Spec(), policy.PolicyConfig(cfg.Policy),
		cfg.Inference.Concurrency, cfg.Limits.MaxPixels, cfg.Limits.QueueTimeout.Std())

	st := state.New()
	srv := api.New(svc, st, token, version, cfg.Limits.MaxBodyMB, cfg.Limits.RequestTimeout.Std(), log)
	srv.SetReady(true) // warmup already done in model.Load, so /healthz is truthful at listen

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()

	info := m.Info()
	sdNotify("READY=1")
	log.Info("imagewarden started",
		"version", version, "listen", cfg.Listen,
		"model", info.Name, "model_version", info.Version,
		"threads", cfg.Inference.Threads, "concurrency", cfg.Inference.Concurrency)

	err = srv.Run(ctx, cfg.Listen) // ctx-driven graceful shutdown

	sdNotify("STOPPING=1")
	if err != nil {
		log.Error("server exited with error", "error", err)
		return 1
	}
	log.Info("shutdown complete")
	return 0
}

// sdNotify implements the systemd Type=notify readiness protocol with no
// external dependency (copied from nginxpilot's run.go). No-op outside systemd.
// The packaging/imagewarden.service unit (task 031) is Type=notify: READY=1 is
// emitted after warmup (right before Run) and STOPPING=1 once Run returns.
func sdNotify(msg string) {
	socket := os.Getenv("NOTIFY_SOCKET")
	if socket == "" {
		return
	}
	conn, err := net.Dial("unixgram", socket)
	if err != nil {
		return
	}
	defer conn.Close()
	_, _ = conn.Write([]byte(msg))
}
