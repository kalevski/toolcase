// Package web embeds the single-page app. The built SPA is written to dist/ by
// `npm run build` in webmail/web; a committed placeholder keeps `go vet` and
// `go build` working on a checkout without a built SPA.
package web

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var dist embed.FS

//go:embed placeholder
var placeholder embed.FS

// Assets returns the SPA files (rooted at index.html) and whether they are the
// real build (false: the placeholder page is served).
func Assets() (fs.FS, bool) {
	if sub, err := fs.Sub(dist, "dist"); err == nil {
		if _, err := fs.Stat(sub, "index.html"); err == nil {
			return sub, true
		}
	}
	sub, _ := fs.Sub(placeholder, "placeholder")
	return sub, false
}
