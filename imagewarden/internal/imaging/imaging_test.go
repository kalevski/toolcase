package imaging

import (
	"bytes"
	"encoding/binary"
	"errors"
	"flag"
	"math"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// update regenerates the pixel-perfect tensor golden from the live
// Prepare/tensorize code path. Regenerate after any intentional change to the
// decode/resize/normalize algorithm or to the ok.jpg fixture:
//
//	go test ./internal/imaging -run TestTensorGolden -update
//
// (see testdata/README.md — the golden is never hand-written).
var update = flag.Bool("update", false, "regenerate golden files")

// spec is the shared target tensor description mirroring the default model
// manifest (spec §6.1): 224×224 NHWC, /255 with identity mean/std, so every
// normalized value lands in the closed range [0,1].
func spec() TensorSpec {
	return TensorSpec{
		Width:  224,
		Height: 224,
		Layout: "NHWC",
		Scale:  255.0,
		Mean:   [3]float64{0, 0, 0},
		Std:    [3]float64{1, 1, 1},
		Name:   "input_1",
	}
}

// maxPixels is the decompression-bomb cap the tests pass to Prepare. It is far
// above every ok.* fixture (16×16 = 256 px, and 1×1 for onepixel.png) yet far
// below bomb.png's declared 30000×30000 = 9e8 px, so the guard rejects the
// bomb while every real fixture decodes.
const maxPixels = 40_000_000

// fixtureDir locates the task-008 testdata directory. The generator
// (testdata/gen/main.go) writes the fixtures at the module root, while task
// 007's spec refers to them as "testdata/"; support both so the tests run
// whether the fixtures were generated into the package directory or the module
// root. Skips the calling test when neither location has them yet — they are
// binary artifacts committed separately (see testdata/README.md).
func fixtureDir(t *testing.T) string {
	t.Helper()
	for _, d := range []string{"testdata", filepath.Join("..", "..", "testdata")} {
		// ok.png is always generator-produced (unlike the encoder-optional
		// ok.webp), so it is the reliable sentinel that a dir is populated.
		if _, err := os.Stat(filepath.Join(d, "ok.png")); err == nil {
			return d
		}
	}
	t.Skip("imaging fixtures not present; generate them with `go run testdata/gen/main.go` (see testdata/README.md)")
	return ""
}

// readFixture loads a required fixture, failing the test if it is missing from
// an otherwise-populated fixture dir.
func readFixture(t *testing.T, dir, name string) []byte {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(dir, name))
	if err != nil {
		t.Fatalf("read fixture %s: %v", name, err)
	}
	return data
}

// checkTensor asserts the shape/length/name contract and that every value is
// finite and within the [0,1] range the default spec produces.
func checkTensor(t *testing.T, got Tensor) {
	t.Helper()
	if want := 224 * 224 * 3; len(got.Data) != want {
		t.Fatalf("len(Data) = %d, want %d", len(got.Data), want)
	}
	if want := []int64{1, 224, 224, 3}; !reflect.DeepEqual(got.Shape, want) {
		t.Fatalf("Shape = %v, want %v", got.Shape, want)
	}
	if got.Name != "input_1" {
		t.Errorf("Name = %q, want input_1", got.Name)
	}
	for i, v := range got.Data {
		f := float64(v)
		if math.IsNaN(f) || math.IsInf(f, 0) {
			t.Fatalf("Data[%d] = %v, want finite", i, v)
		}
		if f < 0 || f > 1 {
			t.Fatalf("Data[%d] = %v, outside normalized range [0,1]", i, v)
		}
	}
}

// TestPrepareDecodesAllFormats runs every supported format through the full
// decode+tensorize path and checks the tensor contract. ok.webp is skipped
// when absent because the module has no Go WebP encoder — the fixture is
// produced out-of-band by cwebp (see testdata/README.md).
func TestPrepareDecodesAllFormats(t *testing.T) {
	dir := fixtureDir(t)
	s := spec()

	for _, name := range []string{"ok.jpg", "ok.png", "ok.webp", "ok.gif"} {
		t.Run(name, func(t *testing.T) {
			data, err := os.ReadFile(filepath.Join(dir, name))
			if err != nil {
				if os.IsNotExist(err) && name == "ok.webp" {
					t.Skip("ok.webp not present; generate it with cwebp (see testdata/README.md)")
				}
				t.Fatalf("read fixture %s: %v", name, err)
			}

			got, err := Prepare(data, s, maxPixels)
			if err != nil {
				t.Fatalf("Prepare(%s) error = %v, want nil", name, err)
			}
			checkTensor(t, got)
		})
	}
}

// TestPrepareTruncated confirms a recognized-but-undecodable image surfaces as
// ErrCorrupt (DecodeConfig succeeds on the intact header; Decode fails in the
// truncated scan data).
func TestPrepareTruncated(t *testing.T) {
	dir := fixtureDir(t)
	data := readFixture(t, dir, "truncated.jpg")

	_, err := Prepare(data, spec(), maxPixels)
	if !errors.Is(err, ErrCorrupt) {
		t.Fatalf("Prepare(truncated.jpg) error = %v, want ErrCorrupt", err)
	}
}

// TestPrepareBomb confirms the decompression-bomb guard rejects a tiny file
// that declares gigapixel dimensions — before image.Decode ever allocates the
// bitmap. The fixture is only a few hundred bytes yet its IHDR reports
// 30000×30000 (9e8 px); a full decode would exhaust memory, so a returned
// ErrCorrupt proves the pre-decode header check fired.
func TestPrepareBomb(t *testing.T) {
	dir := fixtureDir(t)
	data := readFixture(t, dir, "bomb.png")

	// Sanity-check the fixture really is a small file declaring a huge image;
	// otherwise this test would not be exercising the pre-decode guard.
	if len(data) > 4096 {
		t.Fatalf("bomb.png is %d bytes; expected a few hundred (a tiny file declaring gigapixel dims)", len(data))
	}

	_, err := Prepare(data, spec(), maxPixels)
	if !errors.Is(err, ErrCorrupt) {
		t.Fatalf("Prepare(bomb.png) error = %v, want ErrCorrupt", err)
	}
}

// TestPrepareOnePixel exercises the 1×1 edge case: the shortest-side resize
// upscales 1→224 and the center-crop is a no-op.
func TestPrepareOnePixel(t *testing.T) {
	dir := fixtureDir(t)
	data := readFixture(t, dir, "onepixel.png")

	got, err := Prepare(data, spec(), maxPixels)
	if err != nil {
		t.Fatalf("Prepare(onepixel.png) error = %v, want nil", err)
	}
	checkTensor(t, got)
}

// TestPrepareUnsupported confirms bytes that no registered decoder recognizes
// surface as ErrUnsupportedFormat (mapped to 415 by the API).
func TestPrepareUnsupported(t *testing.T) {
	s := spec()
	for _, tc := range []struct {
		name string
		data []byte
	}{
		{"plain text", []byte("not an image")},
		{"empty", []byte{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := Prepare(tc.data, s, maxPixels)
			if !errors.Is(err, ErrUnsupportedFormat) {
				t.Fatalf("Prepare(%s) error = %v, want ErrUnsupportedFormat", tc.name, err)
			}
		})
	}
}

// TestTensorGolden is the pixel-perfect snapshot: it tensorizes ok.jpg and
// compares the float32 output against testdata/tensor_ok_jpg.golden (a
// little-endian float32 dump). Regenerate with:
//
//	go test ./internal/imaging -run TestTensorGolden -update
func TestTensorGolden(t *testing.T) {
	dir := fixtureDir(t)
	data := readFixture(t, dir, "ok.jpg")

	got, err := Prepare(data, spec(), maxPixels)
	if err != nil {
		t.Fatalf("Prepare(ok.jpg) error = %v, want nil", err)
	}

	goldenPath := filepath.Join(dir, "tensor_ok_jpg.golden")

	if *update {
		var buf bytes.Buffer
		if err := binary.Write(&buf, binary.LittleEndian, got.Data); err != nil {
			t.Fatalf("encode golden: %v", err)
		}
		if err := os.WriteFile(goldenPath, buf.Bytes(), 0o644); err != nil {
			t.Fatalf("write golden: %v", err)
		}
		t.Logf("wrote %s (%d floats)", goldenPath, len(got.Data))
		return
	}

	raw, err := os.ReadFile(goldenPath)
	if err != nil {
		if os.IsNotExist(err) {
			t.Skip("tensor_ok_jpg.golden not present; regenerate with `go test ./internal/imaging -run TestTensorGolden -update`")
		}
		t.Fatalf("read golden: %v", err)
	}
	if len(raw)%4 != 0 {
		t.Fatalf("golden size %d is not a multiple of 4 (float32)", len(raw))
	}
	want := make([]float32, len(raw)/4)
	if err := binary.Read(bytes.NewReader(raw), binary.LittleEndian, want); err != nil {
		t.Fatalf("decode golden: %v", err)
	}

	if len(got.Data) != len(want) {
		t.Fatalf("tensor length = %d, golden length = %d", len(got.Data), len(want))
	}
	for i := range got.Data {
		if math.Abs(float64(got.Data[i]-want[i])) >= 1e-6 {
			t.Fatalf("tensor drift at index %d: got %v, golden %v", i, got.Data[i], want[i])
		}
	}
}
