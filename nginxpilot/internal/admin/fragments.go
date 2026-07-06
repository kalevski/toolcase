package admin

import (
	"fmt"
	"net/http"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/targetcheck"
)

// fragmentCounts counts every list a Fragment declares, keyed by the human
// kind name the shape errors use. Every config.Fragment list MUST appear here
// — a reflection test (TestFragmentCountsCoverEveryList) enforces that, so a
// new resource kind can never silently slip through the shape gate the way
// streams once did.
func fragmentCounts(f *config.Fragment) map[string]int {
	return map[string]int{
		"site":            len(f.Sites),
		"upstream":        len(f.Upstreams),
		"proxy":           len(f.Proxies),
		"redirect":        len(f.Redirects),
		"dead_host":       len(f.DeadHosts),
		"access_list":     len(f.AccessLists),
		"stream_upstream": len(f.StreamUpstreams),
		"stream":          len(f.Streams),
		"log_destination": len(f.LogDestinations),
	}
}

// requireExactlyOne verifies the fragment declares exactly one resource of the
// given kind and nothing else — the invariant that keeps every fragment file
// 1:1 with a DELETE-able resource.
func requireExactlyOne(f *config.Fragment, kind string) error {
	counts := fragmentCounts(f)
	if _, known := counts[kind]; !known {
		return fmt.Errorf("unknown fragment kind %q", kind)
	}
	if counts[kind] != 1 {
		return fmt.Errorf("fragment must declare exactly one %s (and nothing else)", kind)
	}
	for k, n := range counts {
		if k != kind && n != 0 {
			return fmt.Errorf("fragment must declare exactly one %s (and nothing else; found %s entries)", kind, k)
		}
	}
	return nil
}

// checkFragmentTargets runs the network target-check tiers (DNS error/warn +
// optional reachability probe) over the NEW fragment's backends only — never
// the whole config. Returns warnings to surface in the write response, and a
// non-nil err when dns severity is "error" and a host doesn't resolve. The
// ?skip_target_checks=true override handles the DNS-record-lands-later
// bootstrap case.
func checkFragmentTargets(r *http.Request, cfg *config.Config, frag *config.Fragment) (warnings []string, err error) {
	if r.URL.Query().Get("skip_target_checks") == "true" {
		return nil, nil
	}
	tc := cfg.Nginx.TargetChecks
	dnsSeverity := tc.DNSSeverity()
	probe := tc.ReachabilityEnabled()
	if dnsSeverity == config.TargetDNSOff && !probe {
		return nil, nil
	}

	checker := &targetcheck.Checker{Timeout: tc.TimeoutOrDefault()}
	ctx := r.Context()

	var targets []targetcheck.Target
	addPass := func(pass string) {
		if pass == "" {
			return
		}
		if t, perr := targetcheck.ParsePass(pass); perr == nil {
			targets = append(targets, t)
		}
	}
	addAddr := func(addr string) {
		if addr == "" {
			return
		}
		if t, perr := targetcheck.ParseAddr(addr); perr == nil {
			targets = append(targets, t)
		}
	}
	for i := range frag.Proxies {
		addPass(frag.Proxies[i].Pass)
		for _, loc := range frag.Proxies[i].Locations {
			addPass(loc.Pass)
		}
	}
	for i := range frag.Upstreams {
		for _, s := range frag.Upstreams[i].Servers {
			addAddr(s.Address)
		}
	}
	for i := range frag.Streams {
		addAddr(frag.Streams[i].Pass)
	}
	for i := range frag.StreamUpstreams {
		for _, s := range frag.StreamUpstreams[i].Servers {
			addAddr(s.Address)
		}
	}

	for _, t := range targets {
		if dnsSeverity != config.TargetDNSOff {
			if derr := checker.CheckDNS(ctx, t); derr != nil {
				if dnsSeverity == config.TargetDNSError {
					return warnings, fmt.Errorf("pass %v (add ?skip_target_checks=true to override)", derr)
				}
				warnings = append(warnings, derr.Error())
				continue // an unresolvable host can't be probed
			}
		}
		if probe {
			if rerr := checker.CheckReachable(ctx, t); rerr != nil {
				warnings = append(warnings, rerr.Error())
			}
		}
	}
	return warnings, nil
}
