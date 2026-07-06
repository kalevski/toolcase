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
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

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

	// annotator (optional) pre-checks backend targets before staging so a
	// quarantined resource gets a self-explanatory reason ("host does not
	// resolve") instead of raw nginx -t stderr. Nil-safe.
	annotator TargetAnnotator
}

// TargetAnnotator pre-checks resource backends (DNS) ahead of nginx -t.
// Annotate returns kind+"\x00"+key → human reason for every resource whose
// backend fails a pre-flight check. Best-effort and bounded; an empty map (or
// nil annotator) changes nothing.
type TargetAnnotator interface {
	Annotate(ctx context.Context, cfg *config.Config) map[string]string
}

// SetAnnotator wires an optional pre-flight target checker into the engine.
func (e *Engine) SetAnnotator(a TargetAnnotator) { e.annotator = a }

// annotationKey builds the map key an annotator uses for one resource.
func annotationKey(kind, key string) string { return kind + "\x00" + key }

// AnnotationKey is the exported form for annotator implementations.
func AnnotationKey(kind, key string) string { return annotationKey(kind, key) }

// ResourceResult is the per-resource outcome of an apply, surfaced in /status.
type ResourceResult struct {
	Kind   string `json:"kind"`
	Key    string `json:"key"`
	File   string `json:"file"`
	State  string `json:"state"`            // active | disabled | at_risk
	Reason string `json:"reason,omitempty"` // nginx -t stderr / annotated reason when not active

	// Since / LastReconcile are filled by the manager's reconcile loop (the
	// engine itself is stateless): when the loop first saw this resource
	// failing, and when it last evaluated it.
	Since         *time.Time `json:"since,omitempty"`
	LastReconcile *time.Time `json:"last_reconcile,omitempty"`
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
	// A successful swap renames the staging dirs into place; RemoveAll on the
	// (now absent) temp paths is then a no-op. Any failure leaves them behind,
	// so always clean up.
	defer removeStaging(httpStaging, streamStaging)
	if err := e.swapAndReload(ctx, httpStaging, streamStaging); err != nil {
		return ApplyResult{Resources: results}, err
	}
	return ApplyResult{Resources: results, Reloaded: true}, nil
}

// DryRun renders + validates + quarantines but never swaps or reloads, so a
// control plane can preview the per-resource pass/fail set before committing
// (POST /nginx/test). The staged files are discarded. Staging is per-call
// (unique temp dirs next to the live dirs), so a DryRun is safe to run
// concurrently with an in-flight Apply — the reconcile loop relies on that.
func (e *Engine) DryRun(ctx context.Context, cfg *config.Config, certs nginxconf.CertResolver) (ApplyResult, error) {
	results, httpStaging, streamStaging, err := e.plan(ctx, cfg, certs)
	removeStaging(httpStaging, streamStaging)
	if err != nil {
		return ApplyResult{}, err
	}
	return ApplyResult{Resources: results}, nil
}

// newStagingDirs creates the per-call staging directories. They live NEXT TO
// the live dirs (same parent) so the Apply swap stays an atomic rename(2) —
// a fixed shared path would let a concurrent DryRun delete an in-flight
// Apply's staged files.
func (e *Engine) newStagingDirs() (httpStaging, streamStaging string, err error) {
	if err := ensureDir(filepath.Dir(e.confDir)); err != nil {
		return "", "", err
	}
	if err := ensureDir(filepath.Dir(e.streamDir)); err != nil {
		return "", "", err
	}
	httpStaging, err = os.MkdirTemp(filepath.Dir(e.confDir), ".nginxpilot-staging-http-")
	if err != nil {
		return "", "", err
	}
	streamStaging, err = os.MkdirTemp(filepath.Dir(e.streamDir), ".nginxpilot-staging-stream-")
	if err != nil {
		_ = os.RemoveAll(httpStaging)
		return "", "", err
	}
	return httpStaging, streamStaging, nil
}

// removeStaging best-effort deletes leftover staging dirs ("" entries skipped).
func removeStaging(dirs ...string) {
	for _, d := range dirs {
		if d != "" {
			_ = os.RemoveAll(d)
		}
	}
}

// plan renders every resource, validates the whole set, and (on failure) runs
// the per-resource quarantine pass. It leaves the maximal valid subset staged
// in httpStaging/streamStaging for the caller to swap (Apply) or discard
// (DryRun), and returns the per-resource results. On error the staging dirs
// are already cleaned up.
func (e *Engine) plan(ctx context.Context, cfg *config.Config, certs nginxconf.CertResolver) (results []ResourceResult, httpStaging, streamStaging string, err error) {
	// The static block-exploits snippet must exist at the live include path for
	// both the isolated test (resources reference it by absolute path) and the
	// live reload. It is constant and valid, so writing it eagerly is safe.
	if err := e.writeBlockExploits(); err != nil {
		return nil, "", "", fmt.Errorf("write block-exploits include: %w", err)
	}

	// The generated htpasswd files live under data_dir (not the swapped conf
	// dirs), referenced by absolute auth_basic_user_file paths — regenerate them
	// from config before staging so a password (re)set lands with this apply.
	if err := writeAccessFiles(cfg); err != nil {
		return nil, "", "", fmt.Errorf("write access-list htpasswd files: %w", err)
	}

	// Pre-flight target annotations (DNS), shared by the whole pass so a
	// quarantined resource reports "host does not resolve" instead of raw
	// nginx -t stderr. Best-effort: nil/empty changes nothing.
	var annotations map[string]string
	if e.annotator != nil {
		annotations = e.annotator.Annotate(ctx, cfg)
	}

	resources, baseHTTP, disabled := renderResources(cfg, certs, e.includeDir)
	httpStaging, streamStaging, err = e.newStagingDirs()
	if err != nil {
		return nil, "", "", err
	}
	fail := func(ferr error) ([]ResourceResult, string, string, error) {
		removeStaging(httpStaging, streamStaging)
		return nil, "", "", ferr
	}

	// Global test: stage the whole set and validate it in one shot.
	if err := e.stage(httpStaging, streamStaging, baseHTTP, resources); err != nil {
		return fail(err)
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
		return fail(err)
	}
	for _, r := range resources {
		dir := httpStaging
		if r.context == ctxStream {
			dir = streamStaging
		}
		if err := writeStagedFile(dir, r.filename, r.content); err != nil {
			return fail(err)
		}
		out, terr := e.test(ctx, httpStaging, streamStaging)
		if terr != nil {
			_ = removeStagedFile(dir, r.filename)
			reason := oneLine(out)
			if reason == "" {
				reason = terr.Error()
			}
			// Prefer the pre-flight annotation (e.g. DNS rot) over raw stderr —
			// nginx stays the arbiter of what is disabled, the annotation is
			// only ever a better error message.
			if a := annotations[annotationKey(r.kind, r.key)]; a != "" {
				e.log.Warn("resource disabled by nginx -t (pre-flight annotated)",
					"kind", r.kind, "key", r.key, "nginx_output", reason, "annotation", a)
				reason = a
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
// include dir (idempotent). The include dir is usually the LIVE conf dir, which
// a concurrent Apply's swap can rename away between the ensureDir and the
// write — retry a couple of times; the swap path rewrites the snippet itself
// right after swapping, so the file always converges to present.
func (e *Engine) writeBlockExploits() error {
	var err error
	for attempt := 0; attempt < 3; attempt++ {
		if err = ensureDir(e.includeDir); err != nil {
			continue
		}
		err = writeStagedFile(e.includeDir, nginxconf.BlockExploitsFilename, nginxconf.BlockExploitsSnippet())
		if err == nil || !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	return err
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
