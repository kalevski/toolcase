package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/kalevski/toolcase/nginx-static-server/internal/config"
	"github.com/kalevski/toolcase/nginx-static-server/internal/deploy"
	"github.com/kalevski/toolcase/nginx-static-server/internal/manager"
	"github.com/kalevski/toolcase/nginx-static-server/internal/state"
)

// cmdSync runs a one-shot in-process sync for one domain — no daemon
// needed. Non-zero exit on failure. This is the documented onboarding flow:
// run it before enabling the vhost (spec §4.5, §6).
func cmdSync(args []string) int {
	fs := flag.NewFlagSet("sync", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	logFormat := fs.String("log-format", "logfmt", "logfmt | json")
	timeout := fs.Duration("timeout", 15*time.Minute, "abort the sync after this duration")
	domain, ok := parseWithPositional(fs, args, "usage: nginx-static-server sync <domain> [flags]")
	if !ok {
		return 2
	}

	res, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		return 1
	}
	cfg := res.Config
	log := newLogger(*logFormat, cfg.LogLevel)

	var site *config.Site
	for i := range cfg.Sites {
		if cfg.Sites[i].Domain == domain {
			site = &cfg.Sites[i]
			break
		}
	}
	if site == nil {
		fmt.Fprintf(os.Stderr, "domain %q is not configured\n", domain)
		return 1
	}

	syscall.Umask(0o027)
	store, err := state.NewStore(cfg.DataDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "state store init failed: %v\n", err)
		return 1
	}
	dep := deploy.New(cfg.DataDir, cfg.Defaults.KeepReleases, log)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()
	ctx, cancel := context.WithTimeout(ctx, *timeout)
	defer cancel()

	if _, err := manager.SyncSite(ctx, *site, cfg.DataDir, store, dep, log); err != nil {
		fmt.Fprintf(os.Stderr, "sync failed: %v\n", err)
		return 1
	}
	return 0
}
