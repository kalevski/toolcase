//go:build ignore

// Command gen produces the deterministic image fixtures under testdata/.
// Every fixture except ok.webp and tensor_ok_jpg.golden is generated here so
// none of them are hand-edited bytes — see testdata/README.md for the two
// exceptions and the exact commands that produce them.
//
// Run from the imagewarden module root:
//
//	go run testdata/gen/main.go
package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"hash/crc32"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
)

// size is deliberately tiny: the fixtures only need to exercise the decode
// and tensorize code paths, not represent a real photo.
const size = 16

func main() {
	if err := run("testdata"); err != nil {
		fmt.Fprintln(os.Stderr, "gen:", err)
		os.Exit(1)
	}
}

func run(dir string) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}

	img := gradient()

	steps := []struct {
		name string
		fn   func() error
	}{
		{"ok.jpg", func() error { return writeJPEG(filepath.Join(dir, "ok.jpg"), img) }},
		{"ok.png", func() error { return writePNG(filepath.Join(dir, "ok.png"), img) }},
		{"ok.gif", func() error { return writeGIF(filepath.Join(dir, "ok.gif"), img) }},
		{"truncated.jpg", func() error { return writeTruncatedJPEG(filepath.Join(dir, "truncated.jpg"), img) }},
		{"bomb.png", func() error { return writeBombPNG(filepath.Join(dir, "bomb.png")) }},
		{"onepixel.png", func() error { return writeOnePixelPNG(filepath.Join(dir, "onepixel.png")) }},
	}
	for _, s := range steps {
		if err := s.fn(); err != nil {
			return fmt.Errorf("%s: %w", s.name, err)
		}
		fmt.Println("wrote", filepath.Join(dir, s.name))
	}

	fmt.Println()
	fmt.Println("NOT produced by this generator (see testdata/README.md):")
	fmt.Println("  ok.webp             — run cwebp on testdata/ok.png")
	fmt.Println("  tensor_ok_jpg.golden — run `go test ./internal/imaging -run TestTensorGolden -update`")
	return nil
}

// gradient builds the deterministic size x size source image every ok.*
// fixture is encoded from, so the pixel-perfect tensor golden has one stable
// source image regardless of which decoder produced the bytes.
func gradient() *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, size, size))
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			img.Set(x, y, color.RGBA{
				R: uint8(x * 255 / (size - 1)),
				G: uint8(y * 255 / (size - 1)),
				B: uint8((x + y) * 255 / (2 * (size - 1))),
				A: 255,
			})
		}
	}
	return img
}

func writeJPEG(path string, img image.Image) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return jpeg.Encode(f, img, &jpeg.Options{Quality: 90})
}

func writePNG(path string, img image.Image) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return png.Encode(f, img)
}

func writeGIF(path string, img image.Image) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return gif.Encode(f, img, nil)
}

// writeTruncatedJPEG encodes img as a full JPEG, then keeps only the
// shortest prefix for which image.DecodeConfig still succeeds (it only needs
// the header up to SOF) while image.Decode fails (the entropy-coded scan
// data after SOS is cut short). That combination is what forces the
// imaging package down its ErrCorrupt path instead of ErrUnsupportedFormat.
func writeTruncatedJPEG(path string, img image.Image) error {
	var full bytes.Buffer
	if err := jpeg.Encode(&full, img, &jpeg.Options{Quality: 90}); err != nil {
		return err
	}
	data := full.Bytes()

	for cut := len(data) / 2; cut < len(data); cut++ {
		if _, _, err := image.DecodeConfig(bytes.NewReader(data[:cut])); err != nil {
			continue // header not complete yet
		}
		if _, _, err := image.Decode(bytes.NewReader(data[:cut])); err != nil {
			return os.WriteFile(path, data[:cut], 0o644) // found it
		}
		// DecodeConfig and Decode both succeeded already (shouldn't happen
		// before cut == len(data)); keep looking just in case.
	}
	return fmt.Errorf("no truncation point makes DecodeConfig succeed while Decode fails")
}

// writeBombPNG crafts a PNG by hand: a valid 8-byte signature and an IHDR
// chunk declaring 30000x30000 pixels (900 megapixels), followed by a
// minimal IDAT/IEND — a few hundred bytes on disk that nonetheless report a
// gigapixel image, the decompression-bomb guard's test fixture.
//
// The CRC in every chunk is real, computed with crc32.ChecksumIEEE over the
// chunk type + data (never the length): a wrong CRC makes image.DecodeConfig
// reject the file before it ever reads the declared dimensions, defeating
// the point of this fixture.
func writeBombPNG(path string) error {
	var buf bytes.Buffer
	buf.Write([]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}) // PNG signature

	const bombDim = 30000
	ihdr := make([]byte, 13)
	binary.BigEndian.PutUint32(ihdr[0:4], bombDim) // width
	binary.BigEndian.PutUint32(ihdr[4:8], bombDim) // height
	ihdr[8] = 8                                    // bit depth
	ihdr[9] = 2                                    // color type: truecolor
	ihdr[10] = 0                                   // compression method
	ihdr[11] = 0                                   // filter method
	ihdr[12] = 0                                   // interlace method
	writeChunk(&buf, "IHDR", ihdr)

	// DecodeConfig never reads this far, so the payload doesn't need to be
	// valid zlib — it only needs to be present so the stream is well-formed.
	writeChunk(&buf, "IDAT", []byte{0x00})

	writeChunk(&buf, "IEND", nil)

	if err := verifyBombHeader(buf.Bytes(), bombDim); err != nil {
		return err
	}
	return os.WriteFile(path, buf.Bytes(), 0o644)
}

func writeChunk(buf *bytes.Buffer, chunkType string, data []byte) {
	var length [4]byte
	binary.BigEndian.PutUint32(length[:], uint32(len(data)))
	buf.Write(length[:])

	body := append([]byte(chunkType), data...)
	buf.Write(body)

	var crc [4]byte
	binary.BigEndian.PutUint32(crc[:], crc32.ChecksumIEEE(body))
	buf.Write(crc[:])
}

// verifyBombHeader is the generator's own self-check: it fails loudly at
// generation time (rather than silently at test time) if the crafted bytes
// don't actually decode to the declared dimensions.
func verifyBombHeader(data []byte, want int) error {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("self-check: DecodeConfig: %w", err)
	}
	if cfg.Width != want || cfg.Height != want {
		return fmt.Errorf("self-check: got %dx%d, want %dx%d", cfg.Width, cfg.Height, want, want)
	}
	return nil
}

func writeOnePixelPNG(path string) error {
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	img.Set(0, 0, color.RGBA{R: 200, G: 100, B: 50, A: 255})
	return writePNG(path, img)
}
