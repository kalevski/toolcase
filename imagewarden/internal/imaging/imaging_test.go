package imaging

import (
	"errors"
	"testing"
)

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

// maxPixels is the decompression-bomb cap the tests pass to Prepare.
const maxPixels = 40_000_000

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
