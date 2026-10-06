package server

import (
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"io/fs"
	"mime"
	"net/http"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/kalevski/toolcase/webmail/internal/httpx"
)

// asset is one embedded file, read once: the bytes, a content ETag and, for
// compressible types, a gzip copy. The set is bounded by the embedded files
// (only paths that exist in the FS are ever cached).
type asset struct {
	ctype string
	data  []byte
	gz    []byte // nil when not compressible or not smaller
	etag  string
}

// compressible reports whether a media type shrinks under gzip (fonts in
// woff2 and raster images are already compressed).
func compressible(ct string) bool {
	return strings.HasPrefix(ct, "text/") || strings.Contains(ct, "javascript") ||
		strings.Contains(ct, "json") || strings.Contains(ct, "xml") || strings.HasPrefix(ct, "image/svg") ||
		strings.Contains(ct, "wasm")
}

func newAsset(name string, data []byte) *asset {
	ct := mime.TypeByExtension(path.Ext(name))
	if ct == "" {
		ct = "application/octet-stream"
	}
	sum := sha256.Sum256(data)
	a := &asset{ctype: ct, data: data, etag: `"` + hex.EncodeToString(sum[:8]) + `"`}
	if compressible(ct) && len(data) >= 256 {
		var buf bytes.Buffer
		zw, _ := gzip.NewWriterLevel(&buf, gzip.BestCompression)
		_, _ = zw.Write(data)
		if zw.Close() == nil && buf.Len() < len(data) {
			a.gz = buf.Bytes()
		}
	}
	return a
}

// serve writes the asset, gzip-encoded when the client accepts it. The ETag
// is per representation so conditional requests answer 304 either way.
func (a *asset) serve(w http.ResponseWriter, r *http.Request, name string) {
	h := w.Header()
	h.Set("Content-Type", a.ctype)
	body, etag := a.data, a.etag
	if compressible(a.ctype) {
		h.Add("Vary", "Accept-Encoding")
	}
	if a.gz != nil && acceptsGzip(r) {
		h.Set("Content-Encoding", "gzip")
		body, etag = a.gz, a.etag[:len(a.etag)-1]+`-gz"`
	}
	h.Set("ETag", etag)
	http.ServeContent(w, r, name, time.Time{}, bytes.NewReader(body))
}

func acceptsGzip(r *http.Request) bool {
	for _, v := range r.Header.Values("Accept-Encoding") {
		for _, tok := range strings.Split(v, ",") {
			name, q, _ := strings.Cut(tok, ";")
			if strings.TrimSpace(name) == "gzip" {
				q = strings.ReplaceAll(q, " ", "")
				return q != "q=0" && q != "q=0.0" && q != "q=0.00" && q != "q=0.000"
			}
		}
	}
	return false
}

// spaHandler serves the embedded SPA: a real file when the path names one,
// index.html for any other non-API path (client-side routes). Hashed assets
// under /assets/ are immutable; index.html is never cached so a new build is
// picked up at once. Files are read (and compressed) once, not per request.
func spaHandler(files fs.FS) http.Handler {
	var cache sync.Map // path -> *asset
	load := func(p string) *asset {
		if a, ok := cache.Load(p); ok {
			return a.(*asset)
		}
		f, err := files.Open(p)
		if err != nil {
			return nil
		}
		defer f.Close()
		if st, err := f.Stat(); err != nil || st.IsDir() {
			return nil
		}
		data, err := fs.ReadFile(files, p)
		if err != nil {
			return nil
		}
		a, _ := cache.LoadOrStore(p, newAsset(p, data))
		return a.(*asset)
	}
	indexData, _ := fs.ReadFile(files, "index.html")
	index := newAsset("index.html", indexData)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			httpx.Error(w, r, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed.")
			return
		}
		p := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if p == "api" || strings.HasPrefix(p, "api/") || strings.HasPrefix(p, "_") {
			httpx.Error(w, r, http.StatusNotFound, "not_found", "Not found.")
			return
		}
		if p != "" && p != "index.html" {
			if a := load(p); a != nil {
				if strings.HasPrefix(p, "assets/") {
					w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
				} else {
					w.Header().Set("Cache-Control", "public, max-age=3600")
				}
				a.serve(w, r, p)
				return
			}
			// a missing file with an extension is a 404, not the app shell
			if path.Ext(p) != "" && strings.HasPrefix(p, "assets/") {
				http.NotFound(w, r)
				return
			}
		}
		w.Header().Set("Cache-Control", "no-cache")
		index.serve(w, r, "index.html")
	})
}
