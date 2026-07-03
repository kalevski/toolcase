package admin

import (
	"fmt"
	"net/http"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// handleCreateProxy accepts a reverse-proxy fragment (the same YAML a file
// dropped into sites.d/ would contain — see config.Fragment), validates it
// against the running config, and writes it atomically as proxy-<domain>.yml.
// The fragment must declare exactly one proxy (and no sites/upstreams) so the
// file maps 1:1 to a domain for DELETE /proxies/{domain}. A proxy that names an
// upstream is validated against the upstreams already in the running config, so
// create the upstream first. Like /sites this only writes config nginxpilot
// generates with /vhost — the daemon never proxies traffic itself.
func (s *Server) handleCreateProxy(w http.ResponseWriter, r *http.Request) {
	cfg, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}
	body, ok := readFragmentBody(w, r)
	if !ok {
		return
	}

	frag, err := config.ParseFragment(body, "<admin POST /proxies>")
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid fragment: %v", err), http.StatusBadRequest)
		return
	}
	if err := requireExactlyOne(frag, "proxy"); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	domain, err := config.NormalizeWildcardDomain(frag.Proxies[0].Domain)
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid domain: %v", err), http.StatusBadRequest)
		return
	}
	target, err := fragmentPath(dir, ext, proxyStemPrefix+config.FileStem(domain))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate the candidate merged config (running config minus the file we
	// are about to (over)write, plus the new fragment) before touching disk:
	// duplicate domains (sites and proxies share the namespace), unknown
	// upstream references and malformed targets all come back as a precise 400.
	if err := validateCandidate(cfg, frag, target); err != nil {
		http.Error(w, fmt.Sprintf("fragment rejected: %v", err), http.StatusBadRequest)
		return
	}

	// Network target checks (DNS error/warn + optional reachability probe) run
	// only over the new fragment's backends, after offline validation passed.
	warnings, err := checkFragmentTargets(r, cfg, frag)
	if err != nil {
		http.Error(w, fmt.Sprintf("fragment rejected: %v", err), http.StatusBadRequest)
		return
	}

	s.writeFragmentAndReload(w, target, body, "proxy", domain, warnings)
}

// handleDeleteProxy removes the deterministic proxy-<domain>.yml fragment and
// reloads. Nothing references a proxy, so removing one is always valid config;
// a rejected reload (an unrelated invalid file) keeps the running config and is
// reported as a 500. Wildcard domains work too (URL-encoded or literal *,
// resolved to the _wildcard. file stem).
func (s *Server) handleDeleteProxy(w http.ResponseWriter, r *http.Request) {
	_, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}

	domain, err := config.NormalizeWildcardDomain(r.PathValue("domain"))
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid domain: %v", err), http.StatusBadRequest)
		return
	}
	target, err := fragmentPath(dir, ext, proxyStemPrefix+config.FileStem(domain))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.removeFragmentAndReload(w, target, "proxy", domain)
}
