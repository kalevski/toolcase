// Package nginxconf generates nginx config from the daemon's config entities.
//
// Two surfaces share this generator so they never drift:
//   - generate-only mode — `print-vhost` / admin GET /vhost/<domain> render a
//     self-contained, paste-ready snippet (upstreams emitted inline, exploit
//     rules inline, TLS using discovered or conventional certbot paths).
//   - managed mode — the nginxctl engine renders one file per resource into the
//     directories nginxpilot owns, then validates + reloads nginx itself.
//
// The same toggles (TLS, force_ssl, http2, hsts, block_exploits, websocket,
// cache, gzip, advanced) and stream blocks flow through both.
package nginxconf

import (
	"errors"
	"fmt"
	"path/filepath"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// ErrUnknownDomain is returned by Vhost when no site or proxy owns the domain.
var ErrUnknownDomain = errors.New("domain is not configured")

// ErrCertRequired is returned by the managed renderers when a resource sets
// tls: required but no certificate is discovered for it — the engine maps this
// to quarantining (disabling) that one resource.
var ErrCertRequired = errors.New("tls: required but no certificate found")

// CertResolver resolves a domain to its cert/key paths. *certs.Index satisfies
// it; nginxconf declares its own interface to avoid importing the certs package
// (and the import cycle that would create).
type CertResolver interface {
	For(domain string) (cert, key string, ok bool)
}

// Options tune rendering. The zero value is the generate-only, self-contained
// mode used by print-vhost.
type Options struct {
	// Certs resolves discovered certificates. nil in print-vhost when no cert
	// dir is configured (TLS then renders conventional certbot paths).
	Certs CertResolver
	// Managed selects managed-mode rendering: exploit rules become an include,
	// the upstream blocks are NOT inlined (they live in their own files), and a
	// tls: required resource with no cert errors (ErrCertRequired) instead of
	// rendering a placeholder.
	Managed bool
	// IncludeDir is nginx.managed_include_dir — where the shared block-exploits
	// snippet lives, referenced by `include` in managed mode.
	IncludeDir string
}

// Vhost renders the self-contained snippet for one domain (print-vhost / the
// /vhost endpoint). Equivalent to VhostOpts with the zero Options.
func Vhost(cfg *config.Config, domain string) (string, error) {
	return VhostOpts(cfg, domain, Options{})
}

// VhostOpts renders one domain with explicit options (used by print-vhost when
// a cert dir is configured, so the snippet shows real cert paths).
func VhostOpts(cfg *config.Config, domain string, opts Options) (string, error) {
	for i := range cfg.Sites {
		if cfg.Sites[i].Domain == domain {
			return StaticVhost(cfg, &cfg.Sites[i], opts)
		}
	}
	for i := range cfg.Proxies {
		if cfg.Proxies[i].Domain == domain {
			return ProxyVhost(cfg, &cfg.Proxies[i], opts)
		}
	}
	return "", fmt.Errorf("%q: %w", domain, ErrUnknownDomain)
}

// tlsState is the resolved TLS decision for one resource.
type tlsState struct {
	enabled   bool   // emit an ssl listener
	cert, key string // cert/key paths (real or conventional placeholder)
	found     bool   // a real cert was discovered (vs a print-vhost placeholder)
}

// resolveTLS turns a resource's tls mode + the cert index into a concrete
// decision. In managed mode a missing cert means HTTP fallback (auto) or an
// ErrCertRequired (required); in print-vhost a missing cert yields conventional
// certbot placeholder paths so the snippet is still paste-ready.
func resolveTLS(mode, domain string, opts Options) (tlsState, error) {
	if mode == "" || mode == config.TLSOff {
		return tlsState{}, nil
	}
	if opts.Certs != nil {
		if cert, key, ok := opts.Certs.For(domain); ok {
			return tlsState{enabled: true, cert: cert, key: key, found: true}, nil
		}
	}
	// No discovered cert.
	if opts.Managed {
		if mode == config.TLSRequired {
			return tlsState{}, ErrCertRequired
		}
		return tlsState{}, nil // tls: auto → serve HTTP, the engine warns
	}
	// print-vhost: conventional Let's Encrypt paths so the snippet is usable.
	return tlsState{
		enabled: true,
		cert:    filepath.Join("/etc/letsencrypt/live", domain, "fullchain.pem"),
		key:     filepath.Join("/etc/letsencrypt/live", domain, "privkey.pem"),
		found:   false,
	}, nil
}
