package nginxconf

import (
	"fmt"
	"strings"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// acmeWebroot is the HTTP-01 webroot every managed vhost serves at
// /.well-known/acme-challenge/, or "" when HTTP-01 is not in use (acme off,
// or http not in acme.challenges). Without it, a name already claimed by a
// vhost could not validate over HTTP-01 — only the catch-all served the
// webroot — so its certificate could be neither issued nor renewed that way.
func acmeWebroot(cfg *config.Config) string {
	a := cfg.Acme
	if !a.Enabled || !a.AllowsChallenge(config.ChallengeHTTP) {
		return ""
	}
	return a.HTTP.Webroot
}

// writeACMEChallengeLocation emits the HTTP-01 location. ^~ keeps any regex
// location (a PHP app's dotfile deny, a proxy's pattern routes) from winning;
// allow all + auth_basic off lift a server-level access list, which would
// otherwise refuse the CA's validator; try_files keeps a miss a plain 404
// instead of falling through to the site or upstream.
func writeACMEChallengeLocation(b *strings.Builder, root, indent string) {
	fmt.Fprintf(b, "\n%s# ACME HTTP-01 challenges (nginxpilot): answered before any redirect, access list or route.\n", indent)
	fmt.Fprintf(b, "%slocation ^~ /.well-known/acme-challenge/ {\n", indent)
	fmt.Fprintf(b, "%s    root %s;\n", indent, root)
	fmt.Fprintf(b, "%s    default_type text/plain;\n", indent)
	fmt.Fprintf(b, "%s    allow all;\n", indent)
	fmt.Fprintf(b, "%s    auth_basic off;\n", indent)
	fmt.Fprintf(b, "%s    try_files $uri =404;\n", indent)
	fmt.Fprintf(b, "%s}\n", indent)
}
