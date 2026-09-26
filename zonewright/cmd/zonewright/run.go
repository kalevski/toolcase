package main

import (
	"context"
	"flag"
	"fmt"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/kalevski/toolcase/zonewright/internal/admin"
	"github.com/kalevski/toolcase/zonewright/internal/bindctl"
	"github.com/kalevski/toolcase/zonewright/internal/cluster"
	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/manager"
	"github.com/kalevski/toolcase/zonewright/internal/state"
	"github.com/kalevski/toolcase/zonewright/internal/store"
)

func cmdRun(args []string) int {
	fs := flag.NewFlagSet("run", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	logFormat := fs.String("log-format", "json", "logfmt | json")
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

	// Group-readable for named, nothing for others.
	syscall.Umask(0o027)
	if err := os.MkdirAll(cfg.DataDir, 0o750); err != nil {
		log.Error("cannot create data_dir", "dir", cfg.DataDir, "error", err)
		return 1
	}
	_, statErr := os.Stat(filepath.Join(cfg.DataDir, "state.json"))
	legacy := statErr == nil // a pre-SQLite deployment ran here before
	serials, err := state.NewStore(cfg.DataDir)
	if err != nil {
		log.Error("state store init failed", "error", err)
		return 1
	}
	repl, err := store.Open(filepath.Join(cfg.DataDir, "zonewright.db"), nil)
	if err != nil {
		log.Error("replicated store init failed", "error", err)
		return 1
	}
	defer repl.Close()

	token, err := resolveAdminToken(cfg.Admin.TokenEnv, cfg.Admin.TokenFile)
	if err != nil {
		log.Error("admin token misconfiguration; refusing to start", "error", err)
		return 1
	}
	scoped, err := resolveScopedTokens(cfg.Admin.ScopedTokens, token)
	if err != nil {
		log.Error("scoped token misconfiguration; refusing to start", "error", err)
		return 1
	}

	mgr := manager.New(cfg, serials, repl, bindctl.New(log), log)

	// One-time import of zones the pre-SQLite API wrote to zones.d/.
	if migrated, err := mgr.MigrateFragments(legacy, serials); err != nil {
		log.Error("fragment migration failed", "error", err)
		return 1
	} else if len(migrated) > 0 {
		log.Info("migrated API-managed zones into the replicated store", "zones", migrated)
		res, err := config.Load(*configPath)
		if err != nil {
			log.Error("config reload after migration failed", "error", err)
			return 1
		}
		mgr.SetConfig(res.Config)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()

	var node *cluster.Node // set below in cluster mode; read by reload

	// reload re-reads the on-disk config; a config that fails validation is
	// rejected wholesale and the running config stays active. Shared by
	// SIGHUP and POST /reload.
	reload := func(ctx context.Context) (bindctl.ApplyResult, error) {
		newRes, err := config.Load(*configPath)
		if err != nil {
			log.Error("reload rejected, keeping running config", "error", err)
			return bindctl.ApplyResult{}, err
		}
		for _, w := range newRes.Warnings {
			log.Warn(w)
		}
		if node != nil && newRes.Config.Cluster != nil {
			node.SetURLs(newRes.Config.Cluster.URLs)
		}
		out := mgr.Reload(ctx, newRes.Config)
		log.Info("config reloaded", "zones", len(newRes.Config.Zones))
		return out, nil
	}

	adminSrv := admin.New(mgr, token, log, reload)
	adminSrv.SetScopedTokens(scoped)
	if cfg.Admin.TLS.Enabled() {
		adminSrv.SetTLS(cfg.Admin.TLS.CertFile, cfg.Admin.TLS.KeyFile)
	}

	if cfg.Cluster != nil {
		node, err = cluster.New(cfg.Cluster, mgr, log)
		if err != nil {
			log.Error("cluster init failed", "error", err)
			return 1
		}
		adminSrv.SetCluster(node)
		go func() {
			if err := node.Serve(ctx); err != nil {
				log.Error("cluster peer listener failed", "error", err)
				stop()
			}
		}()
		go node.Run(ctx)
	}
	go func() {
		if err := adminSrv.Run(ctx, cfg.Admin.ListenAddr()); err != nil {
			log.Error("admin endpoint failed", "error", err)
		}
	}()

	hup := make(chan os.Signal, 1)
	signal.Notify(hup, syscall.SIGHUP)
	go func() {
		for range hup {
			_, _ = reload(ctx)
		}
	}()

	sdNotify("READY=1")
	log.Info("zonewright started",
		"version", version, "config", cfg.Path, "node_id", repl.NodeID(), "cluster", cfg.Cluster != nil,
		"local_zones", len(mgr.Config().Zones), "replicated_zones", repl.Stats().Zones, "zone_dir", cfg.Bind.ZoneDir)

	mgr.Run(ctx)

	sdNotify("STOPPING=1")
	log.Info("shutdown complete")
	return 0
}

// resolveAdminToken resolves the bearer token from an env var or a secret
// file. No refs → ("", nil) (no auth). A configured ref that resolves empty is
// an error, so the daemon never silently exposes an unauthenticated endpoint.
func resolveAdminToken(tokenEnv, tokenFile string) (string, error) {
	if tokenEnv == "" && tokenFile == "" {
		return "", nil
	}
	token, err := config.ResolveSecret(tokenEnv, tokenFile)
	if err != nil {
		return "", err
	}
	if token == "" {
		return "", fmt.Errorf("admin token is empty")
	}
	return token, nil
}

// resolveScopedTokens resolves every admin.scoped_tokens entry. An empty token,
// or one equal to the admin token or to another scoped token, is an error: a
// shared value would make the scope meaningless.
func resolveScopedTokens(refs []config.ScopedToken, adminToken string) ([]admin.ScopedToken, error) {
	out := make([]admin.ScopedToken, 0, len(refs))
	seen := map[string]string{}
	for _, ref := range refs {
		token, err := config.ResolveSecret(ref.TokenEnv, ref.TokenFile)
		if err != nil {
			return nil, fmt.Errorf("scoped token %s: %w", ref.Name, err)
		}
		if token == "" {
			return nil, fmt.Errorf("scoped token %s is empty", ref.Name)
		}
		if token == adminToken {
			return nil, fmt.Errorf("scoped token %s has the same value as the admin token", ref.Name)
		}
		if other, dup := seen[token]; dup {
			return nil, fmt.Errorf("scoped tokens %s and %s have the same value", other, ref.Name)
		}
		seen[token] = ref.Name
		out = append(out, admin.ScopedToken{Name: ref.Name, Token: token, Scope: ref.Scope, Zones: ref.Zones, AllZones: ref.AllZones, Source: "config"})
	}
	return out, nil
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
