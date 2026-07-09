package main

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

// TestOnePixelEmbedMatchesTestdata guards against the in-package copy of the
// self-test fixture (task 037, required because go:embed cannot reach
// ../../testdata) silently diverging from testdata/onepixel.png (task 008).
func TestOnePixelEmbedMatchesTestdata(t *testing.T) {
	inPkg, err := os.ReadFile("onepixel.png")
	if err != nil {
		t.Fatal(err)
	}
	fixture, err := os.ReadFile(filepath.Join("..", "..", "testdata", "onepixel.png"))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(inPkg, fixture) {
		t.Fatalf("cmd/imagewarden/onepixel.png (%d bytes) diverged from testdata/onepixel.png (%d bytes)",
			len(inPkg), len(fixture))
	}
	if !bytes.Equal(onePixelPNG, inPkg) {
		t.Fatalf("embedded onePixelPNG (%d bytes) does not match cmd/imagewarden/onepixel.png (%d bytes) on disk",
			len(onePixelPNG), len(inPkg))
	}
}
