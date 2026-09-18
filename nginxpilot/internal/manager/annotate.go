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

// Annotate walks the backends (walkBackends, shared with the address watch)
// and notes the ones that do not resolve.
func (a checkerAnnotator) Annotate(ctx context.Context, cfg *config.Config) map[string]string {
	out := map[string]string{}
	if a.checker == nil {
		return out
	}
	walkBackends(cfg, func(kind, key string, t targetcheck.Target) {
		k := nginxctl.AnnotationKey(kind, key)
		if _, dup := out[k]; dup {
			return
		}
		if derr := a.checker.CheckDNS(ctx, t); derr != nil {
			out[k] = "backend " + derr.Error() + " (checked before nginx -t)"
		}
	})
	return out
}
