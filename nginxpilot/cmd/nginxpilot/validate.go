package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/kalevski/toolcase/nginxpilot/internal/certs"
	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/nginxctl"
	"github.com/kalevski/toolcase/nginxpilot/internal/targetcheck"
)

// cmdValidate parses + validates the merged config, checks the git binary
// is present when git sources exist, and verifies secret references resolve
// (existence only). CI-friendly exit codes (spec §6).
func cmdValidate(args []string) int {
	fs := flag.NewFlagSet("validate", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	checkTargets := fs.Bool("check-targets", false, "also run network target checks (DNS + reachability) over every backend")
	_ = fs.Parse(args)

	res, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "INVALID: %v\n", err)
		return 1
	}
	cfg := res.Config
	for _, w := range res.Warnings {
		fmt.Printf("warning: %s\n", w)
	}

	failed := false
	fail := func(format string, a ...any) {
		fmt.Fprintf(os.Stderr, "INVALID: "+format+"\n", a...)
		failed = true
	}

	hasGit := false
	for _, site := range cfg.Sites {
		if site.Source.Type == config.SourceGit {
			hasGit = true
		}
		// Secret refs must resolve (existence only — values are not read).
		for _, ref := range site.Source.Auth.SecretRefs() {
			if err := config.CheckSecretRef(ref[0], ref[1]); err != nil {
				fail("site %s: %v", site.Domain, err)
			}
		}
		if site.Source.Auth.KeyFile != "" {
			if err := config.CheckSecretFile(site.Source.Auth.KeyFile); err != nil {
				fail("site %s: %v", site.Domain, err)
			}
		}
		if site.Source.Auth.KnownHosts != "" {
			if _, err := os.Stat(site.Source.Auth.KnownHosts); err != nil {
				fail("site %s: known_hosts: %v", site.Domain, err)
			}
		}
	}

	if hasGit {
		out, err := exec.Command("git", "--version").Output()
		if err != nil {
			fail("git sources configured but the git binary is missing: %v", err)
		} else {
			fmt.Printf("git: %s", out)
		}
	}

	if cfg.Admin.TokenEnv != "" || cfg.Admin.TokenFile != "" {
		if err := config.CheckSecretRef(cfg.Admin.TokenEnv, cfg.Admin.TokenFile); err != nil {
			fail("admin token: %v", err)
		}
	}

	// Managed mode: render to a temp dir and run the real `nginx -t` so CI
	// catches breakage before it reaches the host. Any disabled resource (one
	// that nginx -t rejects) is a validation failure.
	if cfg.Nginx.Manage {
		if err := validateManaged(cfg); err != nil {
			fail("%v", err)
		}
	}

	// Opt-in network tiers (default `validate` stays offline for CI): DNS per
	// backend host (failure = INVALID under dns: error, warning under warn) and
	// the reachability probe when enabled (always warning-only).
	if *checkTargets {
		if err := runTargetChecks(cfg); err != nil {
			fail("%v", err)
		}
	}

	if failed {
		return 1
	}
	fmt.Printf("OK: %d site(s), %d upstream(s), %d proxy(ies), data_dir %s\n",
		len(cfg.Sites), len(cfg.Upstreams), len(cfg.Proxies), cfg.DataDir)
	for _, site := range cfg.Sites {
		fmt.Printf("  %-30s %-9s %s\n", site.Domain, site.Source.Type, site.Source.URL)
	}
	for _, u := range cfg.Upstreams {
		fmt.Printf("  %-30s %-9s %d server(s)\n", u.Name, "upstream", len(u.Servers))
	}
	for _, p := range cfg.Proxies {
		target := p.Upstream
		if target == "" {
			target = p.Pass
		}
		fmt.Printf("  %-30s %-9s %s\n", p.Domain, "proxy", target)
	}
	return 0
}

// runTargetChecks runs the network target-check tiers over every backend in
// the config and prints a table. Returns an error (→ non-zero exit) only when
// nginx.target_checks.dns is "error" (the default) and a host fails to
// resolve; reachability results are always informational.
func runTargetChecks(cfg *config.Config) error {
	tc := cfg.Nginx.TargetChecks
	checker := &targetcheck.Checker{Timeout: tc.TimeoutOrDefault()}
	ctx := context.Background()

	type row struct {
		owner, target, dns, reach string
		dnsFailed                 bool
	}
	var rows []row
	check := func(owner string, t targetcheck.Target, raw string) {
		r := row{owner: owner, target: raw, dns: "ok", reach: "-"}
		if t.IsIP || t.IsUnix {
			r.dns = "skip"
		} else if tc.DNSSeverity() != config.TargetDNSOff {
			if err := checker.CheckDNS(ctx, t); err != nil {
				r.dns, r.dnsFailed = err.Error(), true
			}
		} else {
			r.dns = "off"
		}
		if tc.ReachabilityEnabled() && !r.dnsFailed {
			if err := checker.CheckReachable(ctx, t); err != nil {
				r.reach = err.Error()
			} else {
				r.reach = "ok"
			}
		}
		rows = append(rows, r)
	}
	addPass := func(owner, pass string) {
		if pass == "" {
			return
		}
		if t, err := targetcheck.ParsePass(pass); err == nil {
			check(owner, t, pass)
		}
	}
	addAddr := func(owner, addr string) {
		if addr == "" {
			return
		}
		if t, err := targetcheck.ParseAddr(addr); err == nil {
			check(owner, t, addr)
		}
	}
	for _, p := range cfg.Proxies {
		addPass("proxy "+p.Domain, p.Pass)
		for _, loc := range p.Locations {
			addPass("proxy "+p.Domain, loc.Pass)
		}
	}
	for _, u := range cfg.Upstreams {
		for _, s := range u.Servers {
			addAddr("upstream "+u.Name, s.Address)
		}
	}
	for _, s := range cfg.Streams {
		addAddr("stream "+s.Name, s.Pass)
	}
	for _, u := range cfg.StreamUpstreams {
		for _, s := range u.Servers {
			addAddr("stream_upstream "+u.Name, s.Address)
		}
	}

	failures := 0
	fmt.Printf("target checks (%d target(s), dns: %s, reachability: %v):\n",
		len(rows), tc.DNSSeverity(), tc.ReachabilityEnabled())
	for _, r := range rows {
		fmt.Printf("  %-40s %-30s dns=%s reach=%s\n", r.owner, r.target, r.dns, r.reach)
		if r.dnsFailed {
			failures++
		}
	}
	if failures > 0 && tc.DNSSeverity() == config.TargetDNSError {
		return fmt.Errorf("%d backend host(s) do not resolve (target_checks.dns: error)", failures)
	}
	return nil
}

// validateManaged renders the managed config into a temp dir and runs the real
// `nginx -t` on it (via the engine's dry run), so `validate` exercises the same
// gate the daemon applies. Returns an error if nginx -t can't run or rejects any
// resource.
func validateManaged(cfg *config.Config) error {
	tmp, err := os.MkdirTemp("", "nginxpilot-validate-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmp)

	// Point the engine at temp dirs so validate never writes to /etc/nginx.
	managed := *cfg
	managed.Nginx.ConfDir = filepath.Join(tmp, "conf.d")
	managed.Nginx.StreamConfDir = filepath.Join(tmp, "stream.d")
	managed.Nginx.ManagedIncludeDir = filepath.Join(tmp, "conf.d")

	log := newLogger("json", "error")
	eng := nginxctl.New(&managed, log)

	var idx *certs.Index
	if dir, derr := cfg.Tls.ResolveDir(); derr == nil && dir != "" {
		idx, _ = certs.Load(dir)
	}

	res, err := eng.DryRun(context.Background(), &managed, idx)
	if err != nil {
		return fmt.Errorf("managed-mode nginx -t failed (is the nginx binary installed?): %w", err)
	}
	disabled := res.Disabled()
	if len(disabled) == 0 {
		fmt.Printf("nginx -t: OK (%d resource(s) valid)\n", len(res.Resources))
		return nil
	}
	for _, r := range disabled {
		fmt.Fprintf(os.Stderr, "INVALID: nginx -t rejected %s %q: %s\n", r.Kind, r.Key, r.Reason)
	}
	return fmt.Errorf("%d resource(s) rejected by nginx -t", len(disabled))
}
