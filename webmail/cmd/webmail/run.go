package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/kalevski/toolcase/webmail/internal/config"
	"github.com/kalevski/toolcase/webmail/internal/obs"
	"github.com/kalevski/toolcase/webmail/internal/server"
)

// loadConfig reads the environment; problems are printed and reported as a
// non-zero exit.
func loadConfig() (*config.Config, int) {
	cfg, warnings, err := config.LoadFromEnviron(os.Environ())
	for _, w := range warnings {
		fmt.Fprintln(os.Stderr, "warning:", w)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "configuration error:")
		fmt.Fprintln(os.Stderr, err)
		return nil, 2
	}
	return cfg, 0
}

func cmdRun(args []string) int {
	if len(args) > 0 {
		fmt.Fprintln(os.Stderr, "run takes no arguments; configuration is environment-only")
		return 2
	}
	cfg, code := loadConfig()
	if cfg == nil {
		return code
	}
	log := obs.NewLogger(os.Stderr, cfg.LogFormat, cfg.LogLevel)
	for _, a := range cfg.Applied() {
		log.Info("config", "setting", a)
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	s, err := server.New(ctx, cfg, log, server.Build{Version: version, Commit: commit})
	if err != nil {
		log.Error("startup failed", "error", err)
		return 1
	}
	if err := s.Run(ctx); err != nil {
		log.Error("server stopped", "error", err)
		return 1
	}
	return 0
}
