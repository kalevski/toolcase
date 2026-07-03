package admin

import (
	"fmt"
	"net/http"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// handleCreateRedirect accepts a redirection-host fragment (one redirects:
// entry, nothing else), validates the candidate merged config, and writes it
// atomically as redirect-<domain>.yml. Redirect domains share the site/proxy
// domain namespace; wildcard domains (*.example.com) are supported.
func (s *Server) handleCreateRedirect(w http.ResponseWriter, r *http.Request) {
	cfg, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}
	body, ok := readFragmentBody(w, r)
	if !ok {
		return
	}

	frag, err := config.ParseFragment(body, "<admin POST /redirects>")
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid fragment: %v", err), http.StatusBadRequest)
		return
	}
	if err := requireExactlyOne(frag, "redirect"); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	domain, err := config.NormalizeWildcardDomain(frag.Redirects[0].Domain)
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid domain: %v", err), http.StatusBadRequest)
		return
	}
	target, err := fragmentPath(dir, ext, redirectStemPrefix+config.FileStem(domain))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := validateCandidate(cfg, frag, target); err != nil {
		http.Error(w, fmt.Sprintf("fragment rejected: %v", err), http.StatusBadRequest)
		return
	}

	s.writeFragmentAndReload(w, target, body, "redirect", domain, nil)
}

// handleDeleteRedirect removes the deterministic redirect-<domain>.yml
// fragment and reloads.
func (s *Server) handleDeleteRedirect(w http.ResponseWriter, r *http.Request) {
	_, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}

	domain, err := config.NormalizeWildcardDomain(r.PathValue("domain"))
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid domain: %v", err), http.StatusBadRequest)
		return
	}
	target, err := fragmentPath(dir, ext, redirectStemPrefix+config.FileStem(domain))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.removeFragmentAndReload(w, target, "redirect", domain)
}

// handleCreateDeadHost accepts a dead-host fragment (one dead_hosts: entry,
// nothing else), validates the candidate merged config, and writes it
// atomically as dead-<domain>.yml.
func (s *Server) handleCreateDeadHost(w http.ResponseWriter, r *http.Request) {
	cfg, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}
	body, ok := readFragmentBody(w, r)
	if !ok {
		return
	}

	frag, err := config.ParseFragment(body, "<admin POST /dead-hosts>")
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid fragment: %v", err), http.StatusBadRequest)
		return
	}
	if err := requireExactlyOne(frag, "dead_host"); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	domain, err := config.NormalizeWildcardDomain(frag.DeadHosts[0].Domain)
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid domain: %v", err), http.StatusBadRequest)
		return
	}
	target, err := fragmentPath(dir, ext, deadHostStemPrefix+config.FileStem(domain))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := validateCandidate(cfg, frag, target); err != nil {
		http.Error(w, fmt.Sprintf("fragment rejected: %v", err), http.StatusBadRequest)
		return
	}

	s.writeFragmentAndReload(w, target, body, "dead_host", domain, nil)
}

// handleDeleteDeadHost removes the deterministic dead-<domain>.yml fragment
// and reloads.
func (s *Server) handleDeleteDeadHost(w http.ResponseWriter, r *http.Request) {
	_, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}

	domain, err := config.NormalizeWildcardDomain(r.PathValue("domain"))
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid domain: %v", err), http.StatusBadRequest)
		return
	}
	target, err := fragmentPath(dir, ext, deadHostStemPrefix+config.FileStem(domain))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.removeFragmentAndReload(w, target, "dead_host", domain)
}
