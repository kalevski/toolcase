package model

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/kalevski/toolcase/imagewarden/internal/imaging"
)

// Layout values for Input.Layout (spec §6.1).
const (
	LayoutNHWC = "NHWC"
	LayoutNCHW = "NCHW"
)

// Manifest is the typed shape of manifest.yml (spec §6.1): labels, input
// name/shape/layout, and normalization constants that keep the binary
// model-agnostic. LoadManifest is the only constructor — it decodes and
// validates in one step so every Manifest in the program is known-good.
type Manifest struct {
	Name         string    `yaml:"name"`
	Version      string    `yaml:"version"`
	SHA256       string    `yaml:"sha256"`
	Input        Input     `yaml:"input"`
	Output       Output    `yaml:"output"`
	Normalize    Normalize `yaml:"normalize"`
	Labels       []string  `yaml:"labels"`
	Quantization string    `yaml:"quantization"`
}

// Input describes the ONNX graph's input tensor (spec §6.1).
type Input struct {
	Name   string `yaml:"name"`
	Layout string `yaml:"layout"` // NHWC | NCHW
	Width  int    `yaml:"width"`
	Height int    `yaml:"height"`
}

// Output describes the ONNX graph's output tensor. Optional in the YAML:
// when omitted, the name defaults to "output" in LoadManifest, so manifests
// written before this field existed keep loading unchanged. The real
// GantMan-lineage graph names its head "prediction"; the binary stays
// model-agnostic by reading the name here rather than hardcoding either.
type Output struct {
	Name string `yaml:"name"`
}

// Normalize describes the per-channel preprocessing applied after decode
// (spec §3.3, §6.1): v = (channel/Scale - Mean[c]) / Std[c].
type Normalize struct {
	Scale float64   `yaml:"scale"`
	Mean  []float64 `yaml:"mean"`
	Std   []float64 `yaml:"std"`
}

// LoadManifest reads manifest.yml from dir, strict-decodes it, validates its
// semantics, and verifies model.onnx (also in dir) against the manifest's
// sha256. The sha256 is streamed rather than slurped since model.onnx can be
// tens of MB.
func LoadManifest(dir string) (Manifest, error) {
	f, err := os.Open(filepath.Join(dir, "manifest.yml"))
	if err != nil {
		return Manifest{}, fmt.Errorf("open manifest: %w", err)
	}
	defer f.Close()

	dec := yaml.NewDecoder(f)
	dec.KnownFields(true) // strict: unknown key -> error
	var m Manifest
	if err := dec.Decode(&m); err != nil {
		return Manifest{}, fmt.Errorf("decode manifest: %w", err)
	}
	if m.Output.Name == "" {
		m.Output.Name = "output" // pre-output-field manifests (and the placeholder graph) use this name
	}

	if err := m.validate(); err != nil {
		return Manifest{}, err
	}

	if err := m.verifySHA256(dir); err != nil {
		return Manifest{}, err
	}

	return m, nil
}

// validate checks the semantic constraints LoadManifest's YAML decode alone
// can't enforce (spec §6.1). It returns the first failure found.
func (m Manifest) validate() error {
	if m.Name == "" {
		return fmt.Errorf("manifest: name must not be empty")
	}
	if m.Version == "" {
		return fmt.Errorf("manifest %s: version must not be empty", m.Name)
	}
	if m.SHA256 == "" {
		return fmt.Errorf("manifest %s: sha256 must not be empty", m.Name)
	}
	if len(m.Labels) == 0 {
		return fmt.Errorf("manifest %s: labels must not be empty", m.Name)
	}
	if m.Input.Name == "" {
		return fmt.Errorf("manifest %s: input.name must not be empty", m.Name)
	}
	if m.Input.Width <= 0 || m.Input.Height <= 0 {
		return fmt.Errorf("manifest %s: input.width/height must be > 0, got %dx%d", m.Name, m.Input.Width, m.Input.Height)
	}
	if m.Input.Layout != LayoutNHWC && m.Input.Layout != LayoutNCHW {
		return fmt.Errorf("manifest %s: input.layout %q not in {%s,%s}", m.Name, m.Input.Layout, LayoutNHWC, LayoutNCHW)
	}
	if len(m.Normalize.Mean) != 3 {
		return fmt.Errorf("manifest %s: normalize.mean must have 3 elements, got %d", m.Name, len(m.Normalize.Mean))
	}
	if len(m.Normalize.Std) != 3 {
		return fmt.Errorf("manifest %s: normalize.std must have 3 elements, got %d", m.Name, len(m.Normalize.Std))
	}
	for i, s := range m.Normalize.Std {
		if s == 0 {
			return fmt.Errorf("manifest %s: normalize.std[%d] must not be 0 (used as a divisor)", m.Name, i)
		}
	}
	if m.Normalize.Scale <= 0 {
		return fmt.Errorf("manifest %s: normalize.scale must be > 0 (used as a divisor), got %v", m.Name, m.Normalize.Scale)
	}
	return nil
}

// verifySHA256 streams dir/model.onnx through sha256 and compares it
// (case-insensitively) against m.SHA256.
func (m Manifest) verifySHA256(dir string) error {
	onnxPath := filepath.Join(dir, "model.onnx")
	f, err := os.Open(onnxPath)
	if err != nil {
		return fmt.Errorf("open model.onnx: %w", err)
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return fmt.Errorf("hash model.onnx: %w", err)
	}
	sum := hex.EncodeToString(h.Sum(nil))
	if !strings.EqualFold(sum, m.SHA256) {
		return fmt.Errorf("model.onnx sha256 mismatch: manifest %s, file %s", m.SHA256, sum)
	}
	return nil
}

// ToTensorSpec projects the manifest's input/normalize block into the
// imaging package's TensorSpec, the shape internal/imaging.Prepare consumes.
// Callers resolve this once at Load, rather than re-reading YAML on every
// classify request.
//
// Layering note: internal/imaging stays dependency-free (it owns TensorSpec
// and does pure image math); internal/model imports internal/imaging to
// perform this projection. imaging must never import model — that would pull
// YAML decoding into the pure preprocessing package.
func (m Manifest) ToTensorSpec() imaging.TensorSpec {
	var mean, std [3]float64
	copy(mean[:], m.Normalize.Mean)
	copy(std[:], m.Normalize.Std)

	return imaging.TensorSpec{
		Width:  m.Input.Width,
		Height: m.Input.Height,
		Layout: m.Input.Layout,
		Scale:  m.Normalize.Scale,
		Mean:   mean,
		Std:    std,
		Name:   m.Input.Name,
	}
}
