package nginxctl

import (
	"errors"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/nginxconf"
)

// Resource kinds, surfaced in ApplyResult / GET /status.
const (
	KindSite           = "site"
	KindProxy          = "proxy"
	KindUpstream       = "upstream"
	KindStream         = "stream"
	KindStreamUpstream = "stream-upstream"
)

// Resource states.
const (
	StateActive   = "active"
	StateDisabled = "disabled"
)

// nginx context a rendered file belongs to.
const (
	ctxHTTP   = "http"
	ctxStream = "stream"
)

// rendered is one resource's generated nginx file, awaiting validation.
type rendered struct {
	kind     string
	key      string // domain or name
	filename string
	content  string
	context  string // ctxHTTP | ctxStream
}

// renderResources turns a config into the set of per-resource files plus any
// resources disabled at render time (currently only tls: required with no
// cert). baseHTTP holds shared http-context includes (cache zones) that are
// always kept — they are generator output, not quarantinable resources.
func renderResources(cfg *config.Config, certs nginxconf.CertResolver, includeDir string) (resources []rendered, baseHTTP []rendered, disabled []ResourceResult) {
	opts := nginxconf.Options{Certs: certs, Managed: true, IncludeDir: includeDir}

	// Shared http-context cache zone include (only when a proxy uses caching).
	if inc := nginxconf.CachePathInclude(cfg); inc != "" {
		baseHTTP = append(baseHTTP, rendered{
			kind: "cache", key: "cache", filename: nginxconf.CacheIncludeFilename,
			content: inc, context: ctxHTTP,
		})
	}

	// http upstreams first — proxies reference them by name.
	for i := range cfg.Upstreams {
		u := &cfg.Upstreams[i]
		resources = append(resources, rendered{
			kind: KindUpstream, key: u.Name, filename: "upstream-" + u.Name + ".conf",
			content: nginxconf.UpstreamBlock(u), context: ctxHTTP,
		})
	}
	for i := range cfg.Sites {
		s := &cfg.Sites[i]
		content, err := nginxconf.StaticVhost(cfg, s, opts)
		if err != nil {
			disabled = append(disabled, disableResult(KindSite, s.Domain, "site-"+s.Domain+".conf", err))
			continue
		}
		resources = append(resources, rendered{
			kind: KindSite, key: s.Domain, filename: "site-" + s.Domain + ".conf",
			content: content, context: ctxHTTP,
		})
	}
	for i := range cfg.Proxies {
		p := &cfg.Proxies[i]
		// A disabled proxy renders nothing — it keeps its config (and admin API
		// presence) but nginx stops routing its domain. Not a quarantine, so it
		// is not reported in `disabled`.
		if !p.IsEnabled() {
			continue
		}
		content, err := nginxconf.ProxyVhost(cfg, p, opts)
		if err != nil {
			disabled = append(disabled, disableResult(KindProxy, p.Domain, "proxy-"+p.Domain+".conf", err))
			continue
		}
		resources = append(resources, rendered{
			kind: KindProxy, key: p.Domain, filename: "proxy-" + p.Domain + ".conf",
			content: content, context: ctxHTTP,
		})
	}

	// stream context.
	for i := range cfg.StreamUpstreams {
		u := &cfg.StreamUpstreams[i]
		resources = append(resources, rendered{
			kind: KindStreamUpstream, key: u.Name, filename: "stream-upstream-" + u.Name + ".conf",
			content: nginxconf.StreamUpstreamBlock(u), context: ctxStream,
		})
	}
	for i := range cfg.Streams {
		s := &cfg.Streams[i]
		content, err := nginxconf.StreamBlock(s, opts)
		if err != nil {
			disabled = append(disabled, disableResult(KindStream, s.Name, "stream-"+s.Name+".conf", err))
			continue
		}
		resources = append(resources, rendered{
			kind: KindStream, key: s.Name, filename: "stream-" + s.Name + ".conf",
			content: content, context: ctxStream,
		})
	}
	return resources, baseHTTP, disabled
}

// disableResult builds a ResourceResult for a render-time disable, with a
// human reason (cert-required gets a clearer message than the raw error).
func disableResult(kind, key, file string, err error) ResourceResult {
	reason := err.Error()
	if errors.Is(err, nginxconf.ErrCertRequired) {
		reason = "tls: required but no certificate was found for this resource"
	}
	return ResourceResult{Kind: kind, Key: key, File: file, State: StateDisabled, Reason: reason}
}
