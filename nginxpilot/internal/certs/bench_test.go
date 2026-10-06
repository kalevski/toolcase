package certs

import (
	"fmt"
	"path/filepath"
	"testing"
)

func BenchmarkLoad(b *testing.B) {
	dir := b.TempDir()
	for i := 0; i < 300; i++ {
		d := fmt.Sprintf("site%d.example.com", i)
		writeCert(b, filepath.Join(dir, d, "fullchain.pem"), filepath.Join(dir, d, "privkey.pem"), d, "*."+d)
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := Load(dir); err != nil {
			b.Fatal(err)
		}
	}
}
