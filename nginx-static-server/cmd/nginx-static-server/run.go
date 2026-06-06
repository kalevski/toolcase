package main

import (
	"context"
	"flag"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/kalevski/toolcase/nginx-static-server/internal/admin"
	"github.com/kalevski/toolcase/nginx-static-server/internal/config"
	"github.com/kalevski/toolcase/nginx-static-server/internal/manager"
	"github.com/kalevski/toolcase/nginx-static-server/internal/state"
)

func cmdRun(args []string) int {
	fs := flag.NewFlagSet("run", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	logFormat := fs.String("log-format", "logfmt", "logfmt | json")
	pruneOrphans := fs.Bool("prune-orphans", false, "delete on-disk content for sites no longer in config")
	_ = fs.Parse(args)

	res, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		return 1
	}
	cfg := res.Config
	log := newLogger(*logFormat, cfg.LogLevel)
	for _, w := range res.Warnings {
		log.Warn(w)
	}

	// Group-readable for nginx, nothing for others (spec §6).
	syscall.Umask(0o027)
	if err := os.MkdirAll(cfg.DataDir, 0o750); err != nil {
		log.Error("cannot create data_dir", "dir", cfg.DataDir, "error", err)
		return 1
	}

	store, err := state.NewStore(cfg.DataDir)
	if err != nil {
		log.Error("state store init failed", "error", err)
		return 1
	}

	mgr := manager.New(cfg, store, log)
	if *pruneOrphans {
		if err := mgr.PruneOrphans(); err != nil {
			log.Error("prune orphans failed", "error", err)
			return 1
		}
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()

	// Admin endpoint (loopback by default; empty listen disables).
	token := ""
	if cfg.Admin.TokenEnv != "" {
		token = os.Getenv(cfg.Admin.TokenEnv)
	}
	adminSrv := admin.New(mgr, token, log)
	go func() {
		if err := adminSrv.Run(ctx, cfg.Admin.ListenAddr()); err != nil {
			log.Error("admin endpoint failed", "error", err)
		}
	}()

	// SIGHUP → diff-based reload; a config that fails validation is
	// rejected wholesale and the running config stays active (spec §6).
	hup := make(chan os.Signal, 1)
	signal.Notify(hup, syscall.SIGHUP)
	go func() {
		for range hup {
			newRes, err := config.Load(*configPath)
			if err != nil {
				log.Error("reload rejected, keeping running config", "error", err)
				continue
			}
			for _, w := range newRes.Warnings {
				log.Warn(w)
			}
			mgr.Reload(newRes.Config)
			log.Info("config reloaded", "sites", len(newRes.Config.Sites))
		}
	}()

	sdNotify("READY=1")
	log.Info("nginx-static-server started",
		"version", version, "config", cfg.Path, "sites", len(cfg.Sites), "data_dir", cfg.DataDir)

	mgr.Run(ctx)

	sdNotify("STOPPING=1")
	log.Info("shutdown complete")
	return 0
}

// sdNotify implements the systemd Type=notify readiness protocol with no
// external dependency. No-op outside systemd.
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
