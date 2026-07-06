package nginxconf

import (
	"fmt"
	"strings"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// RedirectVhost renders a redirection host: a server{} block answering every
// request with `return <code> <target>;`. TLS matters — a redirect with
// tls: auto|required also gets 443 listeners so https://old.example.com/x
// redirects too. force_ssl is rejected in validation (the redirect IS the
// redirect).
func RedirectVhost(cfg *config.Config, r *config.Redirect, opts Options) (string, error) {
	return renderSimpleVhost(cfg, "redirect", r.Domain, r.ListenPort(), r.WebOptions, r.AccessList, opts, func(b *strings.Builder) {
		fmt.Fprintf(b, "\n    return %d %s;\n", r.CodeOrDefault(), redirectTarget(r))
	})
}

// redirectTarget builds the return-directive argument.
//
//	(auto,  true)  → "$scheme://new.example.com$request_uri"
//	(https, false) → "https://new.example.com"
//
// r.To is only ever a validated (IDNA-normalized) hostname + optional port —
// no raw string reaches the rendered file.
func redirectTarget(r *config.Redirect) string {
	scheme := r.SchemeOrAuto()
	if scheme == config.RedirectSchemeAuto {
		scheme = "$scheme"
	}
	target := scheme + "://" + r.To
	if r.PreservesPath() {
		target += "$request_uri"
	}
	return target
}
