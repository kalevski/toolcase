package app_test

import (
	"encoding/base64"
	"hash/crc32"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type urlPath struct{}

// enc percent-encodes a key for a request path (slashes stay).
func (*urlPath) enc(key string) string {
	parts := strings.Split(key, "/")
	for i, p := range parts {
		parts[i] = url.PathEscape(p)
	}
	return strings.Join(parts, "/")
}

func crc32IEEE(b []byte) string {
	s := crc32.ChecksumIEEE(b)
	return base64.StdEncoding.EncodeToString([]byte{byte(s >> 24), byte(s >> 16), byte(s >> 8), byte(s)})
}

func removeAllBlobs(t *testing.T, dir string) {
	t.Helper()
	_ = filepath.Walk(filepath.Join(dir, "blobs"), func(p string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			_ = os.Remove(p)
		}
		return nil
	})
}
