package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/kalevski/toolcase/binvault/internal/app"
	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/obs"
)

// loadConfig reads the process environment: see loadConfigFrom.
func loadConfig() (*config.Config, *slog.Logger, int) {
	return loadConfigFrom(os.Environ(), os.Stderr)
}

// loadConfigFrom reads the configuration from environ and builds the process logger
// (writing to stderr) from it before anything is reported, so that the boot warnings
// (an unknown BINVAULT_* variable, a cluster variable on a single node) go through the
// same logger as everything else and BINVAULT_LOG_FORMAT=json is JSON on every line
// (spec §2.3, §9.1). Problems with the configuration are printed and reported as a
// non-zero exit; with json logging they are a log line too.
func loadConfigFrom(environ []string, stderr io.Writer) (*config.Config, *slog.Logger, int) {
	cfg, warnings, err := config.LoadFromEnviron(environ)
	// no usable configuration: ask the environment for the format and level
	format, level := envValue(environ, "BINVAULT_LOG_FORMAT"), envValue(environ, "BINVAULT_LOG_LEVEL")
	if cfg != nil {
		format, level = cfg.LogFormat, cfg.LogLevel
	}
	log := obs.NewLogger(stderr, format, level)
	for _, w := range warnings {
		log.Warn("config", "warning", w)
	}
	if err != nil {
		if strings.EqualFold(strings.TrimSpace(format), "json") {
			log.Error("configuration error", "error", err.Error())
		} else {
			fmt.Fprintln(stderr, "configuration error:")
			fmt.Fprintln(stderr, err)
		}
		return nil, log, 2
	}
	return cfg, log, 0
}

// envValue is the value of the first entry for key in an os.Environ-style list.
func envValue(environ []string, key string) string {
	for _, kv := range environ {
		if k, v, ok := strings.Cut(kv, "="); ok && k == key {
			return v
		}
	}
	return ""
}

func cmdRun(args []string) int {
	if len(args) > 0 {
		fmt.Fprintln(os.Stderr, "run takes no arguments; configuration is environment-only")
		return 2
	}
	cfg, log, code := loadConfig()
	if cfg == nil {
		return code
	}
	for _, a := range cfg.Applied() {
		log.Info("config", "setting", a)
	}

	// SIGHUP ends the node like SIGTERM, with the same drain, instead of killing it at once
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM, syscall.SIGHUP)
	defer stop()
	a, err := app.New(ctx, cfg, log, app.Build{Version: version, Commit: commit})
	if err != nil {
		log.Error("startup failed", "error", err)
		return 1
	}
	if err := a.Run(ctx); err != nil {
		log.Error("server stopped", "error", err)
		return 1
	}
	return 0
}
