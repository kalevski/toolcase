package manager

import (
	"context"
	"sync"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/nginxctl"
	"github.com/kalevski/toolcase/nginxpilot/internal/targetcheck"
)

// addrResolveConcurrency bounds the parallel lookups one snapshot may run. A
// snapshot is taken under applyMu (see refreshAddrSnapshot), so its total cost
// must stay near one lookup rather than scaling with the number of backends.
const addrResolveConcurrency = 8

// addrSet maps a backend hostname to the addresses it resolved to, sorted.
// Hosts that failed to resolve are ABSENT rather than empty: a DNS outage must
// read as "unknown", never as "moved", or it would trigger a reload storm.
type addrSet map[string][]string

// walkBackends calls fn for every DNS-relevant backend target in the config:
// proxy passes (the proxy default and each location's override), upstream
// server addresses, stream passes and stream-upstream server addresses.
// Disabled proxies, named upstream references (the upstream's own servers are
// walked instead) and Tier-1 rejects are skipped. It is the one traversal, so
// the pre-flight annotator (annotate.go) and the address watch below can never
// disagree about what counts as a backend.
func walkBackends(cfg *config.Config, fn func(kind, key string, t targetcheck.Target)) {
	pass := func(kind, key, raw string) {
		if raw == "" {
			return
		}
		if t, err := targetcheck.ParsePass(raw); err == nil {
			fn(kind, key, t)
		}
	}
	addr := func(kind, key, raw string) {
		if raw == "" {
			return
		}
		if t, err := targetcheck.ParseAddr(raw); err == nil {
			fn(kind, key, t)
		}
	}

	for i := range cfg.Proxies {
		p := &cfg.Proxies[i]
		if !p.IsEnabled() {
			continue
		}
		pass(nginxctl.KindProxy, p.Domain, p.Pass)
		for _, loc := range p.Locations {
			pass(nginxctl.KindProxy, p.Domain, loc.Pass)
		}
	}
	for i := range cfg.Upstreams {
		u := &cfg.Upstreams[i]
		for _, s := range u.Servers {
			addr(nginxctl.KindUpstream, u.Name, s.Address)
		}
	}
	for i := range cfg.Streams {
		s := &cfg.Streams[i]
		addr(nginxctl.KindStream, s.Name, s.Pass)
	}
	for i := range cfg.StreamUpstreams {
		u := &cfg.StreamUpstreams[i]
		for _, s := range u.Servers {
			addr(nginxctl.KindStreamUpstream, u.Name, s.Address)
		}
	}
}

// backendHosts returns the distinct resolvable hostnames the config points at.
// IP literals and unix sockets carry no hostname and are left out.
func backendHosts(cfg *config.Config) []string {
	seen := map[string]bool{}
	var out []string
	walkBackends(cfg, func(_, _ string, t targetcheck.Target) {
		if t.IsIP || t.IsUnix || t.Host == "" || seen[t.Host] {
			return
		}
		seen[t.Host] = true
		out = append(out, t.Host)
	})
	return out
}

// resolveBackends snapshots what every backend hostname resolves to right now,
// looking them up concurrently. A host that fails to resolve, or answers with
// nothing, is omitted (see addrSet).
func (m *Manager) resolveBackends(ctx context.Context) addrSet {
	hosts := backendHosts(m.Config())
	out := make(addrSet, len(hosts))
	if len(hosts) == 0 {
		return out
	}

	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, addrResolveConcurrency)
	for _, host := range hosts {
		wg.Add(1)
		go func(host string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			addrs, err := m.checker.ResolveHost(ctx, targetcheck.Target{Host: host})
			if err != nil || len(addrs) == 0 {
				return
			}
			mu.Lock()
			out[host] = addrs
			mu.Unlock()
		}(host)
	}
	wg.Wait()
	return out
}

// driftedHosts returns the hosts that resolved in BOTH snapshots but to a
// different set of addresses. A host that only appears in one of them is not
// drift: it was just added or removed from the config, or it stopped resolving
// — neither means the running nginx is pointing at the wrong place.
func driftedHosts(prev, cur addrSet) []string {
	var out []string
	for host, before := range prev {
		now, ok := cur[host]
		if !ok || equalAddrs(before, now) {
			continue
		}
		out = append(out, host)
	}
	return out
}

// equalAddrs compares two sorted address lists.
func equalAddrs(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// refreshAddrSnapshot records what the backends resolve to as of NOW. It is
// called straight after a successful apply, because that is the moment nginx
// read the config and cached its own answers — anything later would baseline a
// change nginx never saw and blackhole it permanently.
func (m *Manager) refreshAddrSnapshot(ctx context.Context) {
	if m.checker == nil {
		return
	}
	cur := m.resolveBackends(ctx)
	m.addrMu.Lock()
	m.addrSnap = cur
	m.addrMu.Unlock()
}

// addressesDrifted reports whether any backend has moved since the last apply,
// and names the movers in the log. nginx resolves a hostname in proxy_pass or
// an upstream server ONCE, when it loads the config: a backend that keeps its
// name but changes address — a recreated container, a failed-over service — is
// still reachable by name from everywhere except the one process that matters,
// and no dry-run can see it, because the name resolves perfectly. Only a
// reload makes nginx look again, so drift is a reason to apply.
func (m *Manager) addressesDrifted(ctx context.Context) bool {
	if m.checker == nil || !m.Config().Nginx.Reconcile.WatchAddressesEnabled() {
		return false
	}
	cur := m.resolveBackends(ctx)

	m.addrMu.Lock()
	prev := m.addrSnap
	if prev == nil {
		// No apply has been baselined yet (generate-only, or the first tick
		// raced boot). Record and judge from the next tick.
		m.addrSnap = cur
		m.addrMu.Unlock()
		return false
	}
	m.addrMu.Unlock()

	drifted := driftedHosts(prev, cur)
	for _, host := range drifted {
		m.log.Warn("backend address changed since the last reload; re-applying so nginx resolves it again",
			"host", host, "was", prev[host], "now", cur[host])
	}
	return len(drifted) > 0
}
