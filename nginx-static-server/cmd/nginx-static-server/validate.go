package main

import (
	"flag"
	"fmt"
	"os"
	"os/exec"

	"github.com/kalevski/toolcase/nginx-static-server/internal/config"
)

// cmdValidate parses + validates the merged config, checks the git binary
// is present when git sources exist, and verifies secret references resolve
// (existence only). CI-friendly exit codes (spec §6).
func cmdValidate(args []string) int {
	fs := flag.NewFlagSet("validate", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
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

	if failed {
		return 1
	}
	fmt.Printf("OK: %d site(s), data_dir %s\n", len(cfg.Sites), cfg.DataDir)
	for _, site := range cfg.Sites {
		fmt.Printf("  %-30s %-9s %s\n", site.Domain, site.Source.Type, site.Source.URL)
	}
	return 0
}
