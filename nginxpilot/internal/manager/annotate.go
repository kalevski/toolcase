package manager

import (
	"context"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/nginxctl"
	"github.com/kalevski/toolcase/nginxpilot/internal/targetcheck"
)

// checkerAnnotator implements nginxctl.TargetAnnotator: it walks every
// DNS-relevant backend in the config and returns kind+"\x00"+key → reason for
// each resource whose host fails to resolve. It lives in manager (not
// targetcheck) because config imports targetcheck for Tier-1 parsing — an
// annotator walking *config.Config there would be an import cycle. Best-effort
// — the apply engine only ever uses these as better error messages for
// resources nginx -t already rejected.
type checkerAnnotator struct {
	checker *targetcheck.Checker
}

// Annotate walks proxy pass targets, upstream server addresses, stream passes
// and stream-upstream server addresses. IP literals, unix sockets and named
// upstream references are skipped (upstreams are checked per-server).
func (a checkerAnnotator) Annotate(ctx context.Context, cfg *config.Config) map[string]string {
	out := map[string]string{}
	if a.checker == nil {
		return out
	}
	note := func(kind, key, msg string) {
		k := nginxctl.AnnotationKey(kind, key)
		if _, dup := out[k]; !dup {
			out[k] = msg
		}
	}
	checkPass := func(kind, key, pass string) {
		if pass == "" {
			return
		}
		t, err := targetcheck.ParsePass(pass)
		if err != nil {
			return // Tier 1 already rejected it upstream; nothing to add
		}
		if derr := a.checker.CheckDNS(ctx, t); derr != nil {
			note(kind, key, "backend "+derr.Error()+" (checked before nginx -t)")
		}
	}
	checkAddr := func(kind, key, addr string) {
		if addr == "" {
			return
		}
		t, err := targetcheck.ParseAddr(addr)
		if err != nil {
			return
		}
		if derr := a.checker.CheckDNS(ctx, t); derr != nil {
			note(kind, key, "backend "+derr.Error()+" (checked before nginx -t)")
		}
	}

	for i := range cfg.Proxies {
		p := &cfg.Proxies[i]
		if !p.IsEnabled() {
			continue
		}
		checkPass(nginxctl.KindProxy, p.Domain, p.Pass)
		for _, loc := range p.Locations {
			checkPass(nginxctl.KindProxy, p.Domain, loc.Pass)
		}
	}
	for i := range cfg.Upstreams {
		u := &cfg.Upstreams[i]
		for _, s := range u.Servers {
			checkAddr(nginxctl.KindUpstream, u.Name, s.Address)
		}
	}
	for i := range cfg.Streams {
		s := &cfg.Streams[i]
		checkAddr(nginxctl.KindStream, s.Name, s.Pass)
	}
	for i := range cfg.StreamUpstreams {
		u := &cfg.StreamUpstreams[i]
		for _, s := range u.Servers {
			checkAddr(nginxctl.KindStreamUpstream, u.Name, s.Address)
		}
	}
	return out
}
