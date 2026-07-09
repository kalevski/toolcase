package imaging

import (
	"bytes"
	"errors"
	"fmt"
	"image"

	_ "image/gif"  // first frame only
	_ "image/jpeg"
	_ "image/png"

	_ "golang.org/x/image/webp"
)

// decode turns fully-buffered, untrusted image bytes into an image.Image.
//
// It never trusts the client-supplied Content-Type: image.Decode sniffs the
// real format from magic bytes via the decoders registered by this file's
// blank imports. Before allocating the decoded bitmap, it reads only the
// header via image.DecodeConfig and rejects zero/negative dimensions or a
// pixel count above maxPixels — the decompression-bomb guard mandated by
// spec §4.3. A small file can otherwise declare gigapixel dimensions and
// exhaust memory the moment the real decode runs.
//
// EXIF orientation is deliberately never parsed (spec §4.3): the stdlib
// decoders don't apply it, and imagewarden does not read the tag.
func decode(data []byte, maxPixels int) (image.Image, error) {
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		if errors.Is(err, image.ErrFormat) {
			return nil, fmt.Errorf("decode config: %w", ErrUnsupportedFormat)
		}
		return nil, fmt.Errorf("decode config: %w", ErrCorrupt)
	}
	if cfg.Width <= 0 || cfg.Height <= 0 {
		return nil, fmt.Errorf("bad dims %dx%d: %w", cfg.Width, cfg.Height, ErrCorrupt)
	}
	if int64(cfg.Width)*int64(cfg.Height) > int64(maxPixels) {
		return nil, fmt.Errorf("pixel bomb %dx%d (%s) > %d: %w",
			cfg.Width, cfg.Height, format, maxPixels, ErrCorrupt)
	}

	img, _, err := image.Decode(bytes.NewReader(data)) // fresh reader; DecodeConfig consumed the first one
	if err != nil {
		if errors.Is(err, image.ErrFormat) {
			return nil, fmt.Errorf("decode: %w", ErrUnsupportedFormat)
		}
		return nil, fmt.Errorf("decode %s: %w", format, ErrCorrupt)
	}
	return img, nil
}
