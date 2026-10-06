package server

import (
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func spaFS() fstest.MapFS {
	return fstest.MapFS{
		"index.html":        {Data: []byte("<!doctype html><title>x</title>" + strings.Repeat("<p>shell</p>", 50))},
		"assets/app.js":     {Data: []byte(strings.Repeat("console.log('hello');\n", 200))},
		"assets/font.woff2": {Data: []byte(strings.Repeat("W", 500))},
	}
}

func get(h http.Handler, target string, hdr ...string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodGet, target, nil)
	for i := 0; i+1 < len(hdr); i += 2 {
		r.Header.Set(hdr[i], hdr[i+1])
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestSPAGzipAndETag(t *testing.T) {
	h := spaHandler(spaFS())
	plain := get(h, "/assets/app.js")
	if plain.Header().Get("Content-Encoding") != "" || plain.Header().Get("Cache-Control") != "public, max-age=31536000, immutable" {
		t.Fatalf("plain: %v", plain.Header())
	}
	if ct := plain.Header().Get("Content-Type"); !strings.Contains(ct, "javascript") {
		t.Fatalf("content type %q", ct)
	}
	gz := get(h, "/assets/app.js", "Accept-Encoding", "br, gzip;q=0.8")
	if gz.Header().Get("Content-Encoding") != "gzip" || gz.Header().Get("Vary") != "Accept-Encoding" {
		t.Fatalf("gzip: %v", gz.Header())
	}
	zr, err := gzip.NewReader(gz.Body)
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(zr)
	if string(body) != plain.Body.String() || gz.Body.Len() >= plain.Body.Len() {
		t.Fatalf("gzip body differs or is not smaller")
	}
	if gz.Header().Get("ETag") == plain.Header().Get("ETag") || plain.Header().Get("ETag") == "" {
		t.Fatalf("etags: %q %q", gz.Header().Get("ETag"), plain.Header().Get("ETag"))
	}
	if nm := get(h, "/assets/app.js", "If-None-Match", plain.Header().Get("ETag")); nm.Code != http.StatusNotModified {
		t.Fatalf("conditional: %d", nm.Code)
	}
	if off := get(h, "/assets/app.js", "Accept-Encoding", "gzip;q=0"); off.Header().Get("Content-Encoding") != "" {
		t.Fatal("gzip;q=0 must not compress")
	}
	if woff := get(h, "/assets/font.woff2", "Accept-Encoding", "gzip"); woff.Header().Get("Content-Encoding") != "" {
		t.Fatal("woff2 must not be recompressed")
	}
}

func TestSPAShellAndMissing(t *testing.T) {
	h := spaHandler(spaFS())
	if w := get(h, "/inbox/42"); w.Code != 200 || w.Header().Get("Cache-Control") != "no-cache" || !strings.HasPrefix(w.Header().Get("Content-Type"), "text/html") {
		t.Fatalf("shell: %d %v", w.Code, w.Header())
	}
	if w := get(h, "/assets/missing.js"); w.Code != 404 {
		t.Fatalf("missing asset: %d", w.Code)
	}
	if w := get(h, "/api/x"); w.Code != 404 {
		t.Fatalf("api: %d", w.Code)
	}
}
