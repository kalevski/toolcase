package main

import (
	"context"
	_ "embed"
	"flag"
	"fmt"
	"net"
	"os"

	"github.com/kalevski/toolcase/imagewarden/internal/config"
	"github.com/kalevski/toolcase/imagewarden/internal/policy"
)

// onePixelPNG is byte-identical to testdata/onepixel.png (task 037) — go:embed
// cannot reach a parent directory, so a copy lives beside this file.
//
//go:embed onepixel.png
var onePixelPNG []byte

// cmdValidate is the CI/deploy gate (spec §6, §7): it parses config, runs
// semantic checks, loads the model (verifying its sha256), and runs one
// self-test inference on the embedded 1x1 image end-to-end offline, exiting
// non-zero with a precise message on any failure — nginxpilot's `validate`
// idiom (cmd/nginxpilot/validate.go).
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
	fail := func(format string, a ...any) { // nginxpilot idiom: record + continue
		fmt.Fprintf(os.Stderr, "INVALID: "+format+"\n", a...)
		failed = true
	}

	if err := cfg.Validate(); err != nil {
		fail("%v", err)
	}
	// cfg.Validate only checks that api.token_env is *configured* for a
	// non-loopback listen; it can't see whether the named variable actually
	// resolves in this process's environment. Catch that here so a deploy
	// that forgot to set the secret fails loudly instead of silently falling
	// back to tokenless auth (spec §5).
	if os.Getenv(cfg.API.TokenEnv) == "" && !isLoopback(cfg.Listen) {
		fail("api.token_env %q is empty but listen %q is non-loopback", cfg.API.TokenEnv, cfg.Listen)
	}

	log := newLogger("json", "error") // quiet during validate, like nginxpilot

	// Shared boot spine (config -> model.Load -> classify.New): buildService
	// verifies the sha256 and warms up the model, then wires the same
	// classify.Service `run` (task 024) and `classify` (task 026) use, so the CI
	// gate can never validate limits/policy/concurrency that differ from what a
	// served request actually runs.
	m, svc, err := buildService(cfg, log)
	if err != nil {
		fail("model load: %v", err)
	} else {
		defer m.Close()

		// Self-test: run the embedded PNG through svc.Do — the exact
		// prepare -> gated inference -> policy path a real request takes
		// (spec §4, §6, §11) — proving the whole stack end-to-end offline.
		if v, cerr := svc.Do(context.Background(), onePixelPNG); cerr != nil {
			fail("self-test: %v", cerr)
		} else {
			switch {
			case len(v.Scores) != len(m.Info().Labels):
				fail("self-test: got %d scores, manifest declares %d labels", len(v.Scores), len(m.Info().Labels))
			case v.Decision != policy.DecisionAllow && v.Decision != policy.DecisionReview && v.Decision != policy.DecisionBlock:
				fail("self-test: invalid decision %q", v.Decision)
			}
		}
	}

	if failed {
		return 1
	}
	info := m.Info()
	fmt.Printf("OK: model %s %s (%s), %d labels %v, listen %s, concurrency %d\n",
		info.Name, info.Version, info.Quantization, len(info.Labels), info.Labels,
		cfg.Listen, cfg.Inference.Concurrency)
	return 0
}

// isLoopback mirrors internal/config's isLoopbackListen (unexported there, so
// duplicated here rather than imported): "" or a wildcard host binds all
// interfaces and is treated as non-loopback.
func isLoopback(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return false
	}
	if host == "localhost" {
		return true
	}
	if ip := net.ParseIP(host); ip != nil {
		return ip.IsLoopback()
	}
	return false
}
