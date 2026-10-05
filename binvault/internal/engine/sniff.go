package engine

import (
	"bytes"
	"net/http"
	"strings"
)

// SniffLen is how much of the body decides the content type (spec §3.13).
const SniffLen = 512

type signature struct {
	offset int
	magic  []byte
	typ    string
}

// extra signatures beyond Go's sniffer (spec §3.13: "plus a table of extra
// signatures"). Ordered; the first match wins.
var extraSignatures = []signature{
	{0, []byte("SQLite format 3\x00"), "application/vnd.sqlite3"},
	{0, []byte("\x28\xb5\x2f\xfd"), "application/zstd"},
	{0, []byte("\xfd7zXZ\x00"), "application/x-xz"},
	{0, []byte("fLaC"), "audio/flac"},
	{0, []byte("OggS"), "application/ogg"},
	{0, []byte("II*\x00"), "image/tiff"},
	{0, []byte("MM\x00*"), "image/tiff"},
	{0, []byte("\x1f\x8b"), "application/gzip"},
	{0, []byte("Rar!\x1a\x07"), "application/vnd.rar"},
	{0, []byte("7z\xbc\xaf\x27\x1c"), "application/x-7z-compressed"},
	{257, []byte("ustar"), "application/x-tar"},
	{0, []byte("\x00\x00\x01\x00"), "image/x-icon"},
	{0, []byte("wOFF"), "font/woff"},
	{0, []byte("wOF2"), "font/woff2"},
}

// Sniff returns the content type of data (its first SniffLen bytes): Go's
// sniffer, refined by a table of extra signatures. Unrecognised binary data is
// application/octet-stream.
func Sniff(data []byte) string {
	if len(data) > SniffLen {
		data = data[:SniffLen]
	}
	// ISO base media (HEIC, AVIF, MP4 family): "ftyp" at offset 4.
	if len(data) >= 12 && bytes.Equal(data[4:8], []byte("ftyp")) {
		brand := string(data[8:12])
		switch {
		case brand == "avif" || brand == "avis":
			return "image/avif"
		case strings.HasPrefix(brand, "hei") || strings.HasPrefix(brand, "hev") || brand == "mif1" || brand == "msf1":
			return "image/heic"
		case brand == "qt  ":
			return "video/quicktime"
		}
	}
	got := http.DetectContentType(data)
	if got == "application/octet-stream" || got == "text/plain; charset=utf-8" || got == "application/zip" {
		for _, s := range extraSignatures {
			if len(data) >= s.offset+len(s.magic) && bytes.Equal(data[s.offset:s.offset+len(s.magic)], s.magic) {
				return s.typ
			}
		}
	}
	if strings.HasPrefix(got, "text/xml") || strings.HasPrefix(got, "text/plain") || strings.HasPrefix(got, "text/html") {
		if isSVG(data) {
			return "image/svg+xml"
		}
	}
	if got == "application/x-gzip" {
		return "application/gzip"
	}
	return got
}

func isSVG(data []byte) bool {
	s := bytes.TrimLeft(data, "\xef\xbb\xbf \t\r\n")
	if len(s) > 0 && s[0] != '<' {
		return false
	}
	low := bytes.ToLower(s)
	return bytes.HasPrefix(low, []byte("<svg")) ||
		(bytes.HasPrefix(low, []byte("<?xml")) && bytes.Contains(low, []byte("<svg"))) ||
		(bytes.HasPrefix(low, []byte("<!doctype svg")))
}
