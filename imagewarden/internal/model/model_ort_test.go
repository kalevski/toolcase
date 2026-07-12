//go:build ort

package model

// Accuracy smoke test for the real ONNX model, spec §11. It is guarded by the
// `ort` build tag because it needs a real libonnxruntime.so; an untagged
// `go test ./...` never compiles this file, so the normal suite runs without
// the shared library present.
//
// Running it (this is the CI job that runs inside the build image, spec §11):
//
//	go test -tags ort ./internal/model
//
// with ORT_DYLIB_PATH pointing at the shared library, e.g.
//
//	ORT_DYLIB_PATH=/usr/lib/libonnxruntime.so go test -tags ort ./internal/model
//
// The model artifacts (model/model.onnx) are committed as plain git blobs
// (spec §9.1), so a normal `actions/checkout` suffices; Load still verifies
// the graph against the manifest sha256.
//
// This is a smoke test, not an accuracy gate: it catches "model won't load /
// ORT-binding version mismatch (spec §3.4) / labels scrambled", not a fine
// accuracy regression, so every threshold below is deliberately loose. The
// input is synthesized in-process — no image sample is committed to git
// (spec §11) — so only the structural softmax/label invariants are asserted,
// never a specific class.

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"io"
	"log/slog"
	"math"
	"testing"

	"github.com/kalevski/toolcase/imagewarden/internal/imaging"
)

// modelDir is the checked-in artifact directory (task 029), resolved
// relative to this package.
const modelDir = "../../model"

// maxPixels is the decompression-bomb cap handed to imaging.Prepare. It matches
// config.Defaults().Limits.MaxPixels so the test exercises the same guard the
// running service uses.
const maxPixels = 40_000_000

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
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

	// A synthetic pattern exercises the full stack — decode, tensorize,
	// inference — without committing any image sample to git (spec §11). Its
	// class is not asserted, only the structural softmax/label invariants,
	// because we make no accuracy claim about synthetic input.
	scores := classify(t, m, syntheticPatternJPEG(t))
	assertScores(t, labels, scores)
}

// assertScores applies the smoke-test invariants with loose thresholds.
func assertScores(t *testing.T, labels []string, s Scores) {
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
