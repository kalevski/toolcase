package imaging

import "fmt"

// Prepare decodes untrusted image bytes and produces the model input tensor.
// It is the one public entry the classify service (and cmd/imagewarden
// validate's self-test) calls, tying the decode+bomb-guard and tensorize
// steps together. Errors are always one of the imaging sentinels
// (errors.Is-able).
func Prepare(data []byte, spec TensorSpec, maxPixels int) (Tensor, error) {
	img, err := decode(data, maxPixels)
	if err != nil {
		return Tensor{}, err // already wraps a sentinel
	}
	t, err := tensorize(img, spec)
	if err != nil {
		return Tensor{}, fmt.Errorf("tensorize: %w", err)
	}
	return t, nil
}
