package admin

import (
	"fmt"
	"net/http"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// handleCreateStream accepts a stream fragment (one streams: entry, no other
// kinds), validates the candidate merged config, and writes it as
// stream-<name>.yml. Streams are L4 (TCP/UDP) resources; they only take effect
// in managed mode with the stream include wired into nginx.conf (see
// `nginxpilot print-include`).
func (s *Server) handleCreateStream(w http.ResponseWriter, r *http.Request) {
	cfg, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}
	body, ok := readFragmentBody(w, r)
	if !ok {
		return
	}

	frag, err := config.ParseFragment(body, "<admin POST /streams>")
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid fragment: %v", err), http.StatusBadRequest)
		return
	}
	if err := requireExactlyOne(frag, "stream"); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	name := frag.Streams[0].Name
	target, err := fragmentPath(dir, ext, streamStemPrefix+name)
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
	s.writeFragmentAndReload(w, target, body, "stream", name, warnings)
}

// handleDeleteStream removes the deterministic stream-<name>.yml fragment and
// reloads. Nothing references a stream, so removing one is always valid config.
func (s *Server) handleDeleteStream(w http.ResponseWriter, r *http.Request) {
	_, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}
	name := r.PathValue("name")
	target, err := fragmentPath(dir, ext, streamStemPrefix+name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	s.removeFragmentAndReload(w, target, "stream", name)
}

// handleCreateStreamUpstream accepts a stream_upstreams: fragment (one entry),
// validates it, and writes it as stream-upstream-<name>.yml.
func (s *Server) handleCreateStreamUpstream(w http.ResponseWriter, r *http.Request) {
	cfg, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}
	body, ok := readFragmentBody(w, r)
	if !ok {
		return
	}

	frag, err := config.ParseFragment(body, "<admin POST /stream-upstreams>")
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid fragment: %v", err), http.StatusBadRequest)
		return
	}
	if err := requireExactlyOne(frag, "stream_upstream"); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	name := frag.StreamUpstreams[0].Name
	target, err := fragmentPath(dir, ext, streamUpstreamStemPrefix+name)
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
	s.writeFragmentAndReload(w, target, body, "stream-upstream", name, warnings)
}

// handleDeleteStreamUpstream removes the stream-upstream-<name>.yml fragment and
// reloads. A stream upstream can be referenced by a stream's proxy_pass, so a
// still-referenced upstream is a 409 (checked before any disk change).
func (s *Server) handleDeleteStreamUpstream(w http.ResponseWriter, r *http.Request) {
	cfg, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}
	name := r.PathValue("name")
	target, err := fragmentPath(dir, ext, streamUpstreamStemPrefix+name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := validateCandidate(cfg, &config.Fragment{}, target); err != nil {
		http.Error(w, fmt.Sprintf("stream_upstream still in use: %v", err), http.StatusConflict)
		return
	}
	s.removeFragmentAndReload(w, target, "stream-upstream", name)
}
