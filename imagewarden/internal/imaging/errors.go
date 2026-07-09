package imaging

import "errors"

// ErrUnsupportedFormat means image.Decode/DecodeConfig could not identify the
// bytes as any registered format (image.ErrFormat). API maps this to 415.
var ErrUnsupportedFormat = errors.New("imaging: unsupported image format")

// ErrTooLarge is reserved for size-cap semantics that should surface as 413.
// The body-byte cap itself is enforced upstream by http.MaxBytesReader; this
// sentinel exists so the imaging contract can express a 413 without the API
// re-deriving it. API maps this to 413.
var ErrTooLarge = errors.New("imaging: image exceeds size limit")

// ErrCorrupt means the bytes are a recognized format but truncated/undecodable,
// or the header-declared pixel count exceeds max_pixels (the decompression-bomb
// guard). API maps this to 422.
var ErrCorrupt = errors.New("imaging: corrupt or over-limit image")
