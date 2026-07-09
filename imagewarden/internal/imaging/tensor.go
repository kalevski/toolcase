package imaging

import (
	"fmt"
	"image"
	"math"

	"golang.org/x/image/draw"
)

// TensorSpec is the target description, filled from the model manifest (task 009).
// Nothing here is hardcoded in this package — 224/255/NHWC all come from the spec.
type TensorSpec struct {
	Width, Height int        // e.g. 224, 224
	Layout        string     // "NHWC" or "NCHW"
	Scale         float64    // e.g. 255.0
	Mean          [3]float64 // per-channel, RGB order
	Std           [3]float64 // per-channel, RGB order
	Name          string     // ONNX input tensor name, e.g. "input_1"
}

// Tensor is the flattened input ready to hand to ONNX Runtime.
type Tensor struct {
	Data  []float32 // len == 1*H*W*3
	Shape []int64   // [1,H,W,C] (NHWC) or [1,C,H,W] (NCHW)
	Name  string    // == spec.Name
}

// tensorize resizes img so its shortest side matches spec's target size,
// center-crops to spec.Width x spec.Height, and converts to a normalized
// float32 tensor in the requested layout.
func tensorize(img image.Image, spec TensorSpec) (Tensor, error) {
	b := img.Bounds()
	sw, sh := b.Dx(), b.Dy()

	scale := float64(spec.Width) / float64(min(sw, sh))
	rw := int(math.Round(float64(sw) * scale))
	rh := int(math.Round(float64(sh) * scale))

	resized := image.NewRGBA(image.Rect(0, 0, rw, rh))
	draw.CatmullRom.Scale(resized, resized.Bounds(), img, b, draw.Src, nil)

	ox := (rw - spec.Width) / 2
	oy := (rh - spec.Height) / 2
	crop := resized.SubImage(image.Rect(ox, oy, ox+spec.Width, oy+spec.Height)).(*image.RGBA)

	W, H := spec.Width, spec.Height
	buf := make([]float32, W*H*3)

	var shape []int64
	switch spec.Layout {
	case "NHWC":
		shape = []int64{1, int64(H), int64(W), 3}
	case "NCHW":
		shape = []int64{1, 3, int64(H), int64(W)}
	default:
		return Tensor{}, fmt.Errorf("unsupported layout %q", spec.Layout)
	}

	for y := 0; y < H; y++ {
		// SubImage reslices Pix so that index 0 already lands on the crop's
		// origin — offset is a plain y*Stride + x*4, no further Rect.Min math.
		row := y * crop.Stride
		for x := 0; x < W; x++ {
			i := row + x*4
			r, g, bl := crop.Pix[i], crop.Pix[i+1], crop.Pix[i+2] // drop alpha (Pix[i+3])

			// crop.Pix already holds the plain 0-255 channel byte, i.e. the
			// same value color.Color.RGBA()'s 0-65535 result would give after
			// >>8 — so no further shift (and definitely no /257) is applied.
			vals := [3]float64{
				(float64(r)/spec.Scale - spec.Mean[0]) / spec.Std[0],
				(float64(g)/spec.Scale - spec.Mean[1]) / spec.Std[1],
				(float64(bl)/spec.Scale - spec.Mean[2]) / spec.Std[2],
			}

			for c := 0; c < 3; c++ {
				var idx int
				if spec.Layout == "NHWC" {
					idx = ((y * W) + x) * 3 + c
				} else {
					idx = (c*H+y)*W + x
				}
				buf[idx] = float32(vals[c])
			}
		}
	}

	return Tensor{Data: buf, Shape: shape, Name: spec.Name}, nil
}
