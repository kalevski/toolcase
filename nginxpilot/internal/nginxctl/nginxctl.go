// Package nginxctl is the managed-mode apply engine: it renders every resource
// to its own file, validates the set with `nginx -t`, quarantines any resource
// that fails (disabling just it, keeping the rest serving), atomically swaps the
// good config into the directories nginxpilot owns, and reloads nginx.
//
// The central guarantee: nginx is only ever handed config that already passed
// `nginx -t`. A single bad resource is disabled, never fatal; the rest of the
// site keeps serving. A reload that somehow fails after a passing test rolls the
// live directories back to the previous snapshot.
package nginxctl

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/nginxconf"
)

// RunFunc runs an external command and returns its combined output. Injected so
// the engine is testable without a real nginx binary.
type RunFunc func(ctx context.Context, name string, args ...string) (output string, err error)

// Engine owns the render→test→swap→reload lifecycle for managed mode.
type Engine struct {
	confDir    string // http-context files nginxpilot owns
	streamDir  string // stream-context files
	includeDir string // shared snippets (block-exploits)
	nginxBin   string // binary for the isolated `-t -c` staging test
	testCmd    []string
	reloadCmd  []string
	run        RunFunc
	log        *slog.Logger
}

// ResourceResult is the per-resource outcome of an apply, surfaced in /status.
type ResourceResult struct {
	Kind   string `json:"kind"`
	Key    string `json:"key"`
	File   string `json:"file"`
	State  string `json:"state"`            // active | disabled
	Reason string `json:"reason,omitempty"` // nginx -t stderr when disabled
}

// ApplyResult is the outcome of an Apply call.
type ApplyResult struct {
	Resources []ResourceResult `json:"resources"`
	Reloaded  bool             `json:"reloaded"`
}

// Disabled returns just the disabled resources (convenience for callers/logs).
func (r ApplyResult) Disabled() []ResourceResult {
	var out []ResourceResult
	for _, res := range r.Resources {
		if res.State == StateDisabled {
			out = append(out, res)
		}
	}
	return out
}

// New builds an Engine from a managed-mode config. The isolated staging test
// uses the nginx binary derived from test_cmd (or "nginx").
func New(cfg *config.Config, log *slog.Logger) *Engine {
	return newEngine(cfg, log, defaultRun)
}

func newEngine(cfg *config.Config, log *slog.Logger, run RunFunc) *Engine {
	return &Engine{
		confDir:    cfg.Nginx.ConfDir,
		streamDir:  cfg.Nginx.StreamConfDir,
		includeDir: cfg.Nginx.ManagedIncludeDir,
		nginxBin:   nginxBinary(cfg.Nginx.TestCmd),
		testCmd:    cfg.Nginx.TestCmd,
		reloadCmd:  cfg.Nginx.ReloadCmd,
		run:        run,
		log:        log,
	}
}

// nginxBinary picks the binary for the isolated `-t -c` test: test_cmd[0] when
// it is the nginx binary, else "nginx" (test_cmd may be a systemctl/docker
// wrapper that can't take `-c`).
func nginxBinary(testCmd []string) string {
	if len(testCmd) > 0 && filepath.Base(testCmd[0]) == "nginx" {
		return testCmd[0]
	}
	return "nginx"
}

func defaultRun(ctx context.Context, name string, args ...string) (string, error) {
	out, err := exec.CommandContext(ctx, name, args...).CombinedOutput()
	return string(out), err
}

// Apply renders, validates, quarantines, swaps and reloads. nginx is never
// handed config that fails `nginx -t`. The returned ApplyResult records every
// resource's state even when the (non-nil) error reports a reload/swap failure.
func (e *Engine) Apply(ctx context.Context, cfg *config.Config, certs nginxconf.CertResolver) (ApplyResult, error) {
	results, httpStaging, streamStaging, err := e.plan(ctx, cfg, certs)
	if err != nil {
		return ApplyResult{}, err
	}
	if err := e.swapAndReload(ctx, httpStaging, streamStaging); err != nil {
		return ApplyResult{Resources: results}, err
	}
	return ApplyResult{Resources: results, Reloaded: true}, nil
}

// DryRun renders + validates + quarantines but never swaps or reloads, so a
// control plane can preview the per-resource pass/fail set before committing
// (POST /nginx/test). The staged files are discarded.
func (e *Engine) DryRun(ctx context.Context, cfg *config.Config, certs nginxconf.CertResolver) (ApplyResult, error) {
	results, httpStaging, streamStaging, err := e.plan(ctx, cfg, certs)
	_ = os.RemoveAll(httpStaging)
	_ = os.RemoveAll(streamStaging)
	if err != nil {
		return ApplyResult{}, err
	}
	return ApplyResult{Resources: results}, nil
}

// plan renders every resource, validates the whole set, and (on failure) runs
// the per-resource quarantine pass. It leaves the maximal valid subset staged
// in httpStaging/streamStaging for the caller to swap (Apply) or discard
// (DryRun), and returns the per-resource results.
func (e *Engine) plan(ctx context.Context, cfg *config.Config, certs nginxconf.CertResolver) (results []ResourceResult, httpStaging, streamStaging string, err error) {
	// The static block-exploits snippet must exist at the live include path for
	// both the isolated test (resources reference it by absolute path) and the
	// live reload. It is constant and valid, so writing it eagerly is safe.
	if err := e.writeBlockExploits(); err != nil {
		return nil, "", "", fmt.Errorf("write block-exploits include: %w", err)
	}

	resources, baseHTTP, disabled := renderResources(cfg, certs, e.includeDir)
	httpStaging = e.confDir + ".staging"
	streamStaging = e.streamDir + ".staging"

	// Global test: stage the whole set and validate it in one shot.
	if err := e.stage(httpStaging, streamStaging, baseHTTP, resources); err != nil {
		return nil, "", "", err
	}
	if out, terr := e.test(ctx, httpStaging, streamStaging); terr == nil {
		return append(disabled, activeResults(resources)...), httpStaging, streamStaging, nil
	} else {
		e.log.Warn("global nginx -t failed; entering per-resource quarantine", "output", oneLine(out))
	}

	// Quarantine: rebuild from the base, adding resources one at a time and
	// dropping any that breaks the test. Yields the maximal valid subset.
	results = append([]ResourceResult{}, disabled...)
	if err := e.stage(httpStaging, streamStaging, baseHTTP, nil); err != nil {
		return nil, "", "", err
	}
	for _, r := range resources {
		dir := httpStaging
		if r.context == ctxStream {
			dir = streamStaging
		}
		if err := writeStagedFile(dir, r.filename, r.content); err != nil {
			return nil, "", "", err
		}
		out, terr := e.test(ctx, httpStaging, streamStaging)
		if terr != nil {
			_ = removeStagedFile(dir, r.filename)
			reason := oneLine(out)
			if reason == "" {
				reason = terr.Error()
			}
			results = append(results, ResourceResult{Kind: r.kind, Key: r.key, File: r.filename, State: StateDisabled, Reason: reason})
			e.log.Warn("resource disabled by nginx -t", "kind", r.kind, "key", r.key, "reason", reason)
			continue
		}
		results = append(results, ResourceResult{Kind: r.kind, Key: r.key, File: r.filename, State: StateActive})
	}
	return results, httpStaging, streamStaging, nil
}

// writeBlockExploits writes the static managed exploit-blocking snippet into the
// include dir (idempotent).
func (e *Engine) writeBlockExploits() error {
	if err := ensureDir(e.includeDir); err != nil {
		return err
	}
	return writeStagedFile(e.includeDir, nginxconf.BlockExploitsFilename, nginxconf.BlockExploitsSnippet())
}

func activeResults(resources []rendered) []ResourceResult {
	out := make([]ResourceResult, 0, len(resources))
	for _, r := range resources {
		out = append(out, ResourceResult{Kind: r.kind, Key: r.key, File: r.filename, State: StateActive})
	}
	return out
}

// oneLine collapses nginx -t output to a single trimmed line for logging/status.
func oneLine(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	// Prefer the first line that mentions an error/emerg if present.
	for _, line := range strings.Split(s, "\n") {
		l := strings.TrimSpace(line)
		if strings.Contains(l, "[emerg]") || strings.Contains(l, "[error]") {
			return truncate(l, 300)
		}
	}
	return truncate(strings.ReplaceAll(s, "\n", " "), 300)
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n-1]) + "…"
}
