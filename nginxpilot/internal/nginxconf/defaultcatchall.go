package nginxconf

import (
	"fmt"
	"strings"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// DefaultCatchAllFilename is the managed default/catch-all vhost's filename.
// Any name sorting after LogFormatIncludeFilename ("00-…") works — it only
// USES the log format, never declares one (G5).
const DefaultCatchAllFilename = "default-catchall.conf"

// DefaultCatchAllVhost renders the default/catch-all vhost nginxpilot owns
// when nginx.default_catch_all is on (managed mode only): a request for a
// host no resource claims gets 444 (connection closed, zero response bytes)
// instead of falling through to nginx's stock welcome page — mirroring the
// Docker image's static docker/default.conf, but with the same JSON access
// log every other managed vhost gets via writeAccessLog. /.well-known/acme-
// challenge/ is still served from the HTTP-01 webroot so a brand-new domain
// can validate before its own vhost exists. The 443 side rejects the TLS
// handshake outright (no cert presented, nothing identifiable sent back) —
// that happens before HTTP request parsing, so no access log applies there.
func DefaultCatchAllVhost(cfg *config.Config, opts Options) string {
	var b strings.Builder
	b.WriteString("# nginxpilot managed default/catch-all vhost — do not edit.\n\n")

	b.WriteString("server {\n")
	b.WriteString("    listen 80 default_server;\n")
	b.WriteString("    listen [::]:80 default_server;\n")
	b.WriteString("    server_name _;\n")
	b.WriteString("    server_tokens off;\n")
	writeAccessLog(&b, cfg, opts, "_", LogResourceDefault)
	if root := cfg.Acme.HTTP.Webroot; root != "" {
		fmt.Fprintf(&b, "\n    location /.well-known/acme-challenge/ {\n        root %s;\n    }\n", root)
	}
	b.WriteString("\n    location / {\n        return 444;\n    }\n")
	b.WriteString("}\n\n")

	b.WriteString("# Unmatched TLS: reject the handshake outright.\n")
	b.WriteString("server {\n")
	b.WriteString("    listen 443 ssl default_server;\n")
	b.WriteString("    listen [::]:443 ssl default_server;\n")
	b.WriteString("    server_name _;\n")
	b.WriteString("    ssl_reject_handshake on;\n")
	b.WriteString("}\n")
	return b.String()
}
