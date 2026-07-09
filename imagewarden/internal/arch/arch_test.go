// Package arch holds a single architecture test that pins imagewarden's package
// layering discipline (spec §4) so it can't erode silently as the code grows.
//
// Spec §4 states the layering explicitly:
//
//	api → classify → (imaging, model, policy) → nothing app-internal
//
// with `policy` and `imaging`'s math pure, `model` the only CGO-touching
// package, and `api` owning HTTP concerns only. This is a correctness-relevant
// invariant, not a style rule: e.g. `policy` importing `model` would couple
// decisions to inference and break the "thresholds are the only place policy
// lives" design of §4.2.
//
// The test reads each package's *direct* imports from `go list -json`
// (metadata only — it never compiles anything, so it stays CGO-free per §4 and
// never links libonnxruntime.so, even though internal/model imports the CGO
// ONNX Runtime binding). It lives in its own package so it does not itself
// widen any package's import set.
package arch

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

const (
	module = "github.com/kalevski/toolcase/imagewarden"
	// ortPkg is the sole CGO dependency (spec §3.1/§4): the ONNX Runtime Go
	// binding. Only internal/model may import it.
	ortPkg = "github.com/yalue/onnxruntime_go"
)

// listedPackage is the subset of `go list -json` output this test reads.
// Imports holds direct (non-test) imports only, so a violation names the real
// offending edge and test files stay free to import whatever they need.
type listedPackage struct {
	ImportPath string
	Imports    []string
}

// TestInternalImportBoundaries asserts every internal/* package imports only
// the internal packages spec §4 permits it to, failing with the exact offending
// edge so a violation is immediately actionable.
func TestInternalImportBoundaries(t *testing.T) {
	// allowed[pkg] is the set of internal packages pkg may import. Anything not
	// listed is a layering violation. The sets are confirmed against the final
	// code, not just the spec prose — where the two differ the comment says why.
	allowed := map[string]map[string]bool{
		// policy is pure: "thresholds are the only place policy lives" (§4.2).
		// It must stay stdlib-only — importing model here would couple decisions
		// to inference, exactly the coupling §4.2 forbids.
		"policy": {},

		// imaging is pure image math plus the Tensor/TensorSpec value types
		// (tasks 006/009 put the shared tensor spec here rather than in a
		// separate package). It imports no app-internal package; model depends
		// on imaging for those types, so the edge points inward (model→imaging),
		// never back out.
		"imaging": {},

		// model may import imaging for Tensor/TensorSpec (§4). It must NOT import
		// classify/api/policy/state — inference knows nothing about
		// orchestration, HTTP, decisions, or metrics.
		"model": {"imaging": true},

		// classify orchestrates decode → infer → decide, so it imports imaging,
		// model, and policy — but never api (the HTTP layer sits above it).
		"classify": {"imaging": true, "model": true, "policy": true},

		// api owns HTTP concerns and drives the pipeline through the classify
		// seam. Confirmed against the final code, its app-internal imports are:
		//   classify — the pipeline entry point (server.go, classify_handler.go)
		//   state    — the request counters/latency handlers record (server.go)
		//   policy   — the policy.Verdict type returned to the client (classify_handler.go)
		//   imaging  — the ErrUnsupportedFormat/ErrTooLarge/ErrCorrupt sentinels
		//              the handler maps to HTTP status codes (classify_handler.go)
		//   model    — the model.ModelInfo value type behind the modelInfoProvider
		//              seam that GET /status renders (status.go)
		// These are all *type and sentinel* imports: api never constructs a
		// *model.Model or an imaging tensor itself — it goes through the classify
		// seam (the classifyService / modelInfoProvider interfaces), so no ONNX
		// Runtime is linked into api or its tests. That behavioural "through
		// classify" rule can't be checked from imports alone; it is enforced by
		// those interface seams. api deliberately does NOT import config: task
		// 022's constructor converts config values to plain stdlib types before
		// handing them to api (see handlerLimits in classify_handler.go), so a
		// config edge appearing here would be a regression.
		"api": {"classify": true, "state": true, "policy": true, "imaging": true, "model": true},

		// state and config are leaves: metrics/counters and typed config, with no
		// app-internal imports.
		"state":  {},
		"config": {},

		// arch is this test's own package. It reads import metadata and imports
		// nothing app-internal, so it never widens any package's import set.
		"arch": {},
	}

	for _, p := range listPackages(t) {
		name, ok := internalName(p.ImportPath)
		if !ok {
			continue // not one of this module's internal packages
		}
		set, known := allowed[name]
		if !known {
			t.Errorf("internal/%s is not in the architecture allowlist; add it to `allowed` in arch_test.go with its permitted imports (spec §4)", name)
			continue
		}
		for _, imp := range p.Imports {
			dep, ok := internalName(imp)
			if !ok {
				continue // external or stdlib import — not governed by the layering map
			}
			if !set[dep] {
				t.Errorf("illegal import edge: internal/%s imports internal/%s (not in the allowed set for internal/%s; see spec §4). If this is intended, update `allowed` and its comment rather than loosening silently.", name, dep, name)
			}
		}
	}
}

// TestOnlyModelImportsONNXRuntime asserts the sole CGO dependency, the ONNX
// Runtime binding, is imported by internal/model and nothing else (spec
// §3.1/§4). Reading metadata rather than building means this holds even though
// onnxruntime_go is a CGO package and libonnxruntime.so is absent in the
// default CI lane — the test stays green in the CGO-free build job.
func TestOnlyModelImportsONNXRuntime(t *testing.T) {
	const modelPkg = module + "/internal/model"
	for _, p := range listPackages(t) {
		if !strings.HasPrefix(p.ImportPath, module) {
			continue // only govern this module's own packages (internal/* and cmd/*)
		}
		for _, imp := range p.Imports {
			if imp == ortPkg && p.ImportPath != modelPkg {
				t.Errorf("%s imports %s; only internal/model may link the ONNX Runtime (sole CGO dependency, spec §3.1/§4)", p.ImportPath, ortPkg)
			}
		}
	}
}

// listPackages returns every package under the module, with its direct imports.
//
// It shells out to `go list`, which reads import metadata without compiling, so
// it never pulls in the CGO ONNX Runtime package (kept CGO-free per §4). The -e
// flag makes go list report each package's parsed imports even when a
// dependency can't be fully resolved (e.g. go.sum not yet generated — see the
// go.mod TODO), so the boundary checks don't depend on a buildable tree. Using
// .Imports (not .Deps) keeps the assertions about direct edges, so a failure
// names the real offending import.
func listPackages(t *testing.T) []listedPackage {
	t.Helper()
	cmd := exec.Command("go", "list", "-e", "-deps=false", "-json", "./...")
	cmd.Dir = moduleRoot(t)
	cmd.Env = append(os.Environ(), "CGO_ENABLED=0") // metadata only; never build the ORT binding
	out, err := cmd.Output()
	if err != nil {
		stderr := ""
		if ee, ok := err.(*exec.ExitError); ok {
			stderr = string(ee.Stderr)
		}
		t.Fatalf("go list failed: %v\n%s", err, stderr)
	}
	// go list emits one JSON object per package, concatenated — decode in a
	// loop, not a single Unmarshal.
	var pkgs []listedPackage
	dec := json.NewDecoder(bytes.NewReader(out))
	for dec.More() {
		var p listedPackage
		if err := dec.Decode(&p); err != nil {
			t.Fatalf("decoding go list output: %v", err)
		}
		pkgs = append(pkgs, p)
	}
	return pkgs
}

// internalName maps a full import path to its short internal package name
// (e.g. ".../internal/policy" -> "policy", true). Paths outside this module's
// internal tree return ("", false).
func internalName(importPath string) (string, bool) {
	const prefix = module + "/internal/"
	if !strings.HasPrefix(importPath, prefix) {
		return "", false
	}
	// internal packages are one level deep; guard anyway so a hypothetical
	// nested package keys by its first segment rather than a path with slashes.
	rest := importPath[len(prefix):]
	if i := strings.IndexByte(rest, '/'); i >= 0 {
		rest = rest[:i]
	}
	return rest, true
}

// moduleRoot walks up from the test's working directory (the arch package dir)
// to the directory holding go.mod — the module root that `go list ./...` must
// run from to see every package.
func moduleRoot(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatalf("could not find go.mod above working directory")
		}
		dir = parent
	}
}
