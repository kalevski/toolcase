package admin

import (
	"fmt"
	"net/http"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// handleCreateUpstream accepts an upstream fragment (the same YAML a file
// dropped into sites.d/ would contain — see config.Fragment), validates it
// against the running config, and writes it atomically as upstream-<name>.yml.
// The fragment must declare exactly one upstream (and no sites/proxies) so the
// file maps 1:1 to a name for DELETE /upstreams/{name}. Upstreams carry no
// content to sync — they exist so a proxy can proxy_pass to a named pool and
// /vhost can emit the upstream{} block; nginxpilot never proxies them itself.
func (s *Server) handleCreateUpstream(w http.ResponseWriter, r *http.Request) {
	cfg, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}
	body, ok := readFragmentBody(w, r)
	if !ok {
		return
	}

	frag, err := config.ParseFragment(body, "<admin POST /upstreams>")
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid fragment: %v", err), http.StatusBadRequest)
		return
	}
	if err := requireExactlyOne(frag, "upstream"); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	name := frag.Upstreams[0].Name
	// The name regex is enforced by validateCandidate (full Validate); the
	// fragmentPath base check below blocks any path-separator surprises so a
	// crafted name can never escape sites.d/.
	target, err := fragmentPath(dir, ext, upstreamStemPrefix+name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := validateCandidate(cfg, frag, target); err != nil {
		http.Error(w, fmt.Sprintf("fragment rejected: %v", err), http.StatusBadRequest)
		return
	}

	warnings, err := checkFragmentTargets(r, cfg, frag)
	if err != nil {
		http.Error(w, fmt.Sprintf("fragment rejected: %v", err), http.StatusBadRequest)
		return
	}

	s.writeFragmentAndReload(w, target, body, "upstream", name, warnings)
}

// handleDeleteUpstream removes the deterministic upstream-<name>.yml fragment
// and reloads. Unlike a site, an upstream can be referenced (by a proxy's
// proxy_pass), so removing it can make the config invalid. That is checked
// against the running config *before* touching disk — a still-referenced
// upstream is a 409 and the file is left in place, so the on-disk config can
// never drift into a state a restart would reject. Repoint or delete the
// dependent proxy first.
func (s *Server) handleDeleteUpstream(w http.ResponseWriter, r *http.Request) {
	cfg, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}

	name := r.PathValue("name")
	target, err := fragmentPath(dir, ext, upstreamStemPrefix+name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate the config with this upstream removed (empty fragment, target
	// dropped) before deleting the file, so a dangling proxy reference is a
	// clean 409 rather than a disk/running-config split.
	if err := validateCandidate(cfg, &config.Fragment{}, target); err != nil {
		http.Error(w, fmt.Sprintf("upstream still in use: %v", err), http.StatusConflict)
		return
	}

	s.removeFragmentAndReload(w, target, "upstream", name)
}
