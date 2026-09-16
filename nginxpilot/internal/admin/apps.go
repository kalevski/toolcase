package admin

import (
	"fmt"
	"net/http"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// appStemPrefix namespaces app fragment filenames. Apps share the domain
// namespace with sites and proxies, so the file stem must be namespaced or a
// DELETE on one entity kind could remove another's fragment.
const appStemPrefix = "app-"

// handleListApps exposes the running apps as JSON so a control plane reads
// current state without re-reading the fragment directory off disk.
func (s *Server) handleListApps(w http.ResponseWriter, _ *http.Request) {
	cfg := s.mgr.Config()
	apps := cfg.Apps
	if apps == nil {
		apps = []config.App{}
	}
	writeJSON(w, map[string]any{"apps": apps}, s)
}

// handleCreateApp accepts an app fragment, validates the candidate merged
// config, writes it atomically under a deterministic per-domain filename and
// reloads. Same contract as POST /sites: exactly one app per fragment so the
// file maps 1:1 to a domain for DELETE, and nothing reaches disk until the
// merged config validates.
func (s *Server) handleCreateApp(w http.ResponseWriter, r *http.Request) {
	cfg, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}
	body, ok := readFragmentBody(w, r)
	if !ok {
		return
	}

	frag, err := config.ParseFragment(body, "<admin POST /apps>")
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid fragment: %v", err), http.StatusBadRequest)
		return
	}
	if err := requireExactlyOne(frag, "app"); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	domain, err := config.NormalizeDomain(frag.Apps[0].Domain)
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid domain: %v", err), http.StatusBadRequest)
		return
	}
	target, err := fragmentPath(dir, ext, appStemPrefix+config.FileStem(domain))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := validateCandidate(cfg, frag, target); err != nil {
		http.Error(w, fmt.Sprintf("fragment rejected: %v", err), http.StatusBadRequest)
		return
	}

	s.writeFragmentAndReload(w, target, body, "app", domain, nil)
}

// handleDeleteApp removes an app's fragment and reloads. The app's persistent
// data is deliberately NOT touched: releases are ours to recreate, the data
// directory belongs to whoever deployed the app. Reclaiming it is an explicit
// separate action (DELETE /apps/{domain}/data).
func (s *Server) handleDeleteApp(w http.ResponseWriter, r *http.Request) {
	_, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}

	domain, err := config.NormalizeDomain(r.PathValue("domain"))
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid domain: %v", err), http.StatusBadRequest)
		return
	}
	target, err := fragmentPath(dir, ext, appStemPrefix+config.FileStem(domain))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.removeFragmentAndReload(w, target, "app", domain)
}

// handleDeleteAppData reclaims an app's persistent directory. Separate from
// DELETE /apps/{domain} on purpose — the uploads an application accumulated are
// the user's, and destroying them must be something they asked for rather than
// a side effect of removing the vhost.
func (s *Server) handleDeleteAppData(w http.ResponseWriter, r *http.Request) {
	domain, err := config.NormalizeDomain(r.PathValue("domain"))
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid domain: %v", err), http.StatusBadRequest)
		return
	}
	if err := s.mgr.RemoveAppData(domain); err != nil {
		http.Error(w, fmt.Sprintf("remove app data: %v", err), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"status": "deleted", "domain": domain}, s)
}
