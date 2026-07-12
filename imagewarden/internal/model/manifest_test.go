package model

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// writeManifest writes body as manifest.yml into dir.
func writeManifest(t *testing.T, dir, body string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, "manifest.yml"), []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
}

// writeModel writes data as model.onnx into dir and returns its real hex
// sha256 digest, so callers can embed a correct (or deliberately wrong)
// checksum in the manifest they write alongside it.
func writeModel(t *testing.T, dir string, data []byte) string {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, "model.onnx"), data, 0o600); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// goldenManifest renders spec §6.1's example manifest with the given sha256.
func goldenManifest(sha string) string {
	return fmt.Sprintf(`
name: mobilenetv2-nsfw
version: 1.2.0
sha256: %s
input: { name: input_1, layout: NHWC, width: 224, height: 224 }
normalize: { scale: 255.0, mean: [0,0,0], std: [1,1,1] }
labels: [drawings, hentai, neutral, porn, sexy]
quantization: int8
`, sha)
}

func TestLoadManifestGolden(t *testing.T) {
	dir := t.TempDir()
	sha := writeModel(t, dir, []byte("fake onnx bytes for the golden manifest test"))
	writeManifest(t, dir, goldenManifest(sha))

	m, err := LoadManifest(dir)
	if err != nil {
		t.Fatalf("LoadManifest() error = %v, want nil", err)
	}

	if m.Name != "mobilenetv2-nsfw" {
		t.Errorf("Name = %q, want mobilenetv2-nsfw", m.Name)
	}
	if len(m.Labels) != 5 {
		t.Errorf("len(Labels) = %d, want 5", len(m.Labels))
	}
	if m.Input.Layout != LayoutNHWC {
		t.Errorf("Input.Layout = %q, want %q", m.Input.Layout, LayoutNHWC)
	}
	if m.Normalize.Scale != 255.0 {
		t.Errorf("Normalize.Scale = %v, want 255.0", m.Normalize.Scale)
	}

	spec := m.ToTensorSpec()
	if spec.Width != 224 || spec.Height != 224 {
		t.Errorf("ToTensorSpec() width/height = %dx%d, want 224x224", spec.Width, spec.Height)
	}
	if len(spec.Mean) != 3 || len(spec.Std) != 3 {
		t.Errorf("ToTensorSpec() mean/std lengths = %d/%d, want 3/3", len(spec.Mean), len(spec.Std))
	}
}

func TestLoadManifestSHA256Mismatch(t *testing.T) {
	dir := t.TempDir()
	writeModel(t, dir, []byte("not a real onnx"))

	// A well-formed but deliberately wrong 64-char hex digest.
	wrongSHA := strings.Repeat("a", 64)
	writeManifest(t, dir, goldenManifest(wrongSHA))

	_, err := LoadManifest(dir)
	if err == nil {
		t.Fatal("LoadManifest() = nil, want error for sha256 mismatch")
	}
	if !strings.Contains(err.Error(), "sha256") {
		t.Fatalf("LoadManifest() error = %v, want mention of sha256", err)
	}
}

func TestLoadManifestSHA256CaseInsensitive(t *testing.T) {
	dir := t.TempDir()
	sha := writeModel(t, dir, []byte("fake onnx bytes for the case-insensitivity test"))
	writeManifest(t, dir, goldenManifest(strings.ToUpper(sha)))

	if _, err := LoadManifest(dir); err != nil {
		t.Fatalf("LoadManifest() error = %v, want nil for upper-case sha256", err)
	}
}

func TestLoadManifestInvalid(t *testing.T) {
	cases := []struct {
		name string
		body string
	}{
		{
			"empty name",
			`
name: ""
version: 1.2.0
sha256: deadbeef
input: { name: input_1, layout: NHWC, width: 224, height: 224 }
normalize: { scale: 255.0, mean: [0,0,0], std: [1,1,1] }
labels: [drawings, hentai, neutral, porn, sexy]
`,
		},
		{
			"empty version",
			`
name: mobilenetv2-nsfw
version: ""
sha256: deadbeef
input: { name: input_1, layout: NHWC, width: 224, height: 224 }
normalize: { scale: 255.0, mean: [0,0,0], std: [1,1,1] }
labels: [drawings, hentai, neutral, porn, sexy]
`,
		},
		{
			"empty sha256",
			`
name: mobilenetv2-nsfw
version: 1.2.0
sha256: ""
input: { name: input_1, layout: NHWC, width: 224, height: 224 }
normalize: { scale: 255.0, mean: [0,0,0], std: [1,1,1] }
labels: [drawings, hentai, neutral, porn, sexy]
`,
		},
		{
			"empty labels",
			`
name: mobilenetv2-nsfw
version: 1.2.0
sha256: deadbeef
input: { name: input_1, layout: NHWC, width: 224, height: 224 }
normalize: { scale: 255.0, mean: [0,0,0], std: [1,1,1] }
labels: []
`,
		},
		{
			"width 0",
			`
name: mobilenetv2-nsfw
version: 1.2.0
sha256: deadbeef
input: { name: input_1, layout: NHWC, width: 0, height: 224 }
normalize: { scale: 255.0, mean: [0,0,0], std: [1,1,1] }
labels: [drawings, hentai, neutral, porn, sexy]
`,
		},
		{
			"bad layout",
			`
name: mobilenetv2-nsfw
version: 1.2.0
sha256: deadbeef
input: { name: input_1, layout: NHCW, width: 224, height: 224 }
normalize: { scale: 255.0, mean: [0,0,0], std: [1,1,1] }
labels: [drawings, hentai, neutral, porn, sexy]
`,
		},
		{
			"mean length 2",
			`
name: mobilenetv2-nsfw
version: 1.2.0
sha256: deadbeef
input: { name: input_1, layout: NHWC, width: 224, height: 224 }
normalize: { scale: 255.0, mean: [0,0], std: [1,1,1] }
labels: [drawings, hentai, neutral, porn, sexy]
`,
		},
		{
			"std length 4",
			`
name: mobilenetv2-nsfw
version: 1.2.0
sha256: deadbeef
input: { name: input_1, layout: NHWC, width: 224, height: 224 }
normalize: { scale: 255.0, mean: [0,0,0], std: [1,1,1,1] }
labels: [drawings, hentai, neutral, porn, sexy]
`,
		},
		{
			"scale 0",
			`
name: mobilenetv2-nsfw
version: 1.2.0
sha256: deadbeef
input: { name: input_1, layout: NHWC, width: 224, height: 224 }
normalize: { scale: 0, mean: [0,0,0], std: [1,1,1] }
labels: [drawings, hentai, neutral, porn, sexy]
`,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := t.TempDir()
			writeManifest(t, dir, c.body)
			if _, err := LoadManifest(dir); err == nil {
				t.Fatalf("LoadManifest() = nil, want error")
			}
		})
	}
}

func TestLoadManifestMissingModel(t *testing.T) {
	dir := t.TempDir()
	writeManifest(t, dir, goldenManifest(strings.Repeat("a", 64)))

	_, err := LoadManifest(dir)
	if err == nil {
		t.Fatal("LoadManifest() = nil, want error for missing model.onnx")
	}
}

func TestLoadManifestUnknownKeyRejected(t *testing.T) {
	dir := t.TempDir()
	body := `
name: mobilenetv2-nsfw
version: 1.2.0
sha256: deadbeef
input: { name: input_1, layout: NHWC, width: 224, height: 224 }
normalize: { scale: 255.0, mean: [0,0,0], std: [1,1,1] }
labels: [drawings, hentai, neutral, porn, sexy]
extra: 1
`
	writeManifest(t, dir, body)

	_, err := LoadManifest(dir)
	if err == nil {
		t.Fatal("LoadManifest() = nil, want error for unknown key")
	}
	if !strings.Contains(err.Error(), "extra") {
		t.Fatalf("LoadManifest() error = %v, want mention of extra", err)
	}
}
