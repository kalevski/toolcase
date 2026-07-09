//go:build ort

package model

// Accuracy smoke test for the real ONNX model, spec §11. It is guarded by the
// `ort` build tag because it needs cgo + a real libonnxruntime.so; an untagged
// `go test ./...` never compiles this file, so the normal suite stays CGO-free.
//
// Running it (this is the CI job that runs inside the build image, spec §11):
//
//	go test -tags ort ./internal/model
//
// with ORT_DYLIB_PATH pointing at the shared library, e.g.
//
//	ORT_DYLIB_PATH=/usr/lib/libonnxruntime.so go test -tags ort ./internal/model
//
// The model artifacts (model/model.onnx) are stored in Git LFS (spec §9.1), so
// CI must `actions/checkout` with `lfs: true`; otherwise ../../model/model.onnx
// is a text LFS pointer, not the real graph, and Load fails the sha256 verify.
//
// This is a smoke test, not an accuracy gate: it catches "model won't load /
// ORT-binding version mismatch (spec §3.4) / labels scrambled", not a fine
// accuracy regression, so every threshold below is deliberately loose. The
// argmax/policy assertions run against a committed neutral fixture and are
// skipped when that fixture is absent (the placeholder graph checked in per
// task 029 has meaningless scores — see model/MODEL.md), mirroring how
// internal/imaging's tests skip on not-yet-generated binary fixtures.

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"io"
	"log/slog"
	"math"
	"os"
	"path/filepath"
	"testing"

	"github.com/kalevski/toolcase/imagewarden/internal/config"
	"github.com/kalevski/toolcase/imagewarden/internal/imaging"
	"github.com/kalevski/toolcase/imagewarden/internal/policy"
)

// modelDir is the checked-in artifact directory (Git LFS, task 029), resolved
// relative to this package.
const modelDir = "../../model"

// maxPixels is the decompression-bomb cap handed to imaging.Prepare. It matches
// config.Defaults().Limits.MaxPixels so the test exercises the same guard the
// running service uses.
const maxPixels = 40_000_000

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// findFixture locates a testdata image, checking both the package-local
// testdata/ and the module-root ../../testdata/ (the two locations
// internal/imaging's tests also support). Reports whether one was found so the
// caller can skip rather than fail when a fixture has not been committed yet.
func findFixture(name string) (string, bool) {
	for _, d := range []string{"testdata", filepath.Join("..", "..", "testdata")} {
		p := filepath.Join(d, name)
		if _, err := os.Stat(p); err == nil {
			return p, true
		}
	}
	return "", false
}

// classify runs the untrusted bytes through the whole stack — imaging.Prepare
// (task 007) → model.Classify (spec §11) — using the TensorSpec the model
// resolved from its manifest at Load, so nothing here re-reads manifest.yml.
func classify(t *testing.T, m *Model, data []byte) Scores {
	t.Helper()
	tensor, err := imaging.Prepare(data, m.Spec(), maxPixels)
	if err != nil {
		t.Fatalf("Prepare: %v", err)
	}
	scores, err := m.Classify(tensor)
	if err != nil {
		t.Fatalf("Classify: %v", err)
	}
	return scores
}

func TestModel_Classify_Golden(t *testing.T) {
	m, err := Load(modelDir, 0, testLogger()) // threads 0 → NumCPU
	if err != nil {
		t.Fatalf("Load(%q): %v", modelDir, err)
	}
	t.Cleanup(func() { _ = m.Close() })
	labels := m.Info().Labels

	cases := []struct {
		name      string
		wantLabel string // argmax label expected; "" → structural checks only
		wantAllow bool   // assert policy.Decide → DecisionAllow (only when wantLabel != "")
		// Source of the image bytes: exactly one of file/gen is set. file is
		// read from testdata (subtest skipped if absent); gen synthesizes the
		// bytes in-process so no sample is committed to git.
		file string
		gen  func(t *testing.T) []byte
	}{
		{
			// A committed, benign image is expected to classify as neutral on
			// the real model. Kept as a testdata file (skipped if absent)
			// rather than synthesized, because a synthetic pattern is
			// out-of-distribution for a real NSFW classifier and its argmax
			// can't be relied on.
			name:      "neutral",
			file:      "ok.jpg",
			wantLabel: "neutral",
			wantAllow: true,
		},
		{
			// A synthetic pattern exercises the full stack a second time
			// without committing any sensitive sample to git (spec §11). Its
			// class is not asserted — only the structural softmax/label
			// invariants — because we make no accuracy claim about synthetic
			// input.
			name: "synthetic-pattern",
			gen:  syntheticPatternJPEG,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			var data []byte
			if c.gen != nil {
				data = c.gen(t)
			} else {
				path, ok := findFixture(c.file)
				if !ok {
					t.Skipf("fixture %q not present; commit a benign sample to testdata/ (see testdata/README.md)", c.file)
				}
				b, err := os.ReadFile(path)
				if err != nil {
					t.Fatal(err)
				}
				data = b
			}

			scores := classify(t, m, data)
			assertScores(t, labels, scores, c.wantLabel)

			if c.wantLabel != "" {
				// Tie the accuracy smoke test to the decision path: route the
				// same scores through policy.Decide with the shipped default
				// PolicyConfig (converted from config.Defaults, the documented
				// config→policy conversion) and assert the expected decision.
				v := policy.Decide(scores, policy.PolicyConfig(config.Defaults().Policy))
				wantDecision := policy.DecisionBlock
				if c.wantAllow {
					wantDecision = policy.DecisionAllow
				}
				if v.Decision != wantDecision {
					t.Errorf("policy.Decide = %q (unsafe=%v), want %q (scores=%v)",
						v.Decision, v.UnsafeScore, wantDecision, scores)
				}
			}
		})
	}
}

// assertScores applies the smoke-test invariants with loose thresholds.
func assertScores(t *testing.T, labels []string, s Scores, want string) {
	t.Helper()

	// 1. softmax sums to ~1.0
	var sum float64
	for _, v := range s {
		sum += float64(v)
	}
	if math.Abs(sum-1) > 1e-3 {
		t.Errorf("scores sum = %v, want ~1.0", sum)
	}

	// 2. every manifest label present
	for _, l := range labels {
		if _, ok := s[l]; !ok {
			t.Errorf("missing label %q in scores", l)
		}
	}

	// 3. argmax matches the expected class (skipped for structural-only cases)
	if want == "" {
		return
	}
	arg := ""
	var best float32 = -1
	for l, v := range s {
		if v > best {
			best, arg = v, l
		}
	}
	if arg != want {
		t.Errorf("argmax = %q, want %q (scores=%v)", arg, want, s)
	}
}

// syntheticPatternJPEG builds a small, benign, non-uniform image and encodes it
// as JPEG so the bytes travel the real decode path in imaging.Prepare. It
// commits no sensitive sample to git (spec §11) while still driving the whole
// stack a second time.
func syntheticPatternJPEG(t *testing.T) []byte {
	t.Helper()
	const size = 64
	img := image.NewRGBA(image.Rect(0, 0, size, size))
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			img.Set(x, y, color.RGBA{
				R: uint8((x * 255) / (size - 1)),
				G: uint8((y * 255) / (size - 1)),
				B: uint8(((x ^ y) * 255) / (size - 1)),
				A: 255,
			})
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatalf("encode synthetic fixture: %v", err)
	}
	return buf.Bytes()
}
