package server

import (
	"bytes"
	"io/fs"
	"mime"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/kalevski/toolcase/webmail/internal/httpx"
)

// spaHandler serves the embedded SPA: a real file when the path names one,
// index.html for any other non-API path (client-side routes). Hashed assets
// under /assets/ are immutable; index.html is never cached so a new build is
// picked up at once.
func spaHandler(files fs.FS) http.Handler {
	index, _ := fs.ReadFile(files, "index.html")
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
			if f, err := files.Open(p); err == nil {
				defer f.Close()
				if st, err := f.Stat(); err == nil && !st.IsDir() {
					if data, err := fs.ReadFile(files, p); err == nil {
						ct := mime.TypeByExtension(path.Ext(p))
						if ct == "" {
							ct = "application/octet-stream"
						}
						w.Header().Set("Content-Type", ct)
						if strings.HasPrefix(p, "assets/") {
							w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
						} else {
							w.Header().Set("Cache-Control", "public, max-age=3600")
						}
						http.ServeContent(w, r, p, time.Time{}, bytes.NewReader(data))
						return
					}
				}
			}
			// a missing file with an extension is a 404, not the app shell
			if path.Ext(p) != "" && strings.HasPrefix(p, "assets/") {
				http.NotFound(w, r)
				return
			}
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeContent(w, r, "index.html", time.Time{}, bytes.NewReader(index))
	})
}
