package admin

import (
	"encoding/json"
	"net/http"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// handleListSites, handleListUpstreams and handleListProxies expose the
// running merged config (main file + all fragments) as JSON so a control plane
// (Perch) can read current state without re-reading sites.d/ off disk. Secret
// material is never present — auth carries only *_env / *_file references — and
// internal provenance (the File field) is dropped via json:"-". The lists
// always serialize as an array, never null.
func (s *Server) handleListSites(w http.ResponseWriter, _ *http.Request) {
	cfg := s.mgr.Config()
	sites := cfg.Sites
	if sites == nil {
		sites = []config.Site{}
	}
	writeJSON(w, map[string]any{"sites": sites}, s)
}

func (s *Server) handleListUpstreams(w http.ResponseWriter, _ *http.Request) {
	cfg := s.mgr.Config()
	upstreams := cfg.Upstreams
	if upstreams == nil {
		upstreams = []config.Upstream{}
	}
	writeJSON(w, map[string]any{"upstreams": upstreams}, s)
}

func (s *Server) handleListProxies(w http.ResponseWriter, _ *http.Request) {
	cfg := s.mgr.Config()
	proxies := cfg.Proxies
	if proxies == nil {
		proxies = []config.Proxy{}
	}
	writeJSON(w, map[string]any{"proxies": proxies}, s)
}

func (s *Server) handleListRedirects(w http.ResponseWriter, _ *http.Request) {
	cfg := s.mgr.Config()
	redirects := cfg.Redirects
	if redirects == nil {
		redirects = []config.Redirect{}
	}
	writeJSON(w, map[string]any{"redirects": redirects}, s)
}

func (s *Server) handleListDeadHosts(w http.ResponseWriter, _ *http.Request) {
	cfg := s.mgr.Config()
	deadHosts := cfg.DeadHosts
	if deadHosts == nil {
		deadHosts = []config.DeadHost{}
	}
	writeJSON(w, map[string]any{"dead_hosts": deadHosts}, s)
}

func (s *Server) handleListStreams(w http.ResponseWriter, _ *http.Request) {
	cfg := s.mgr.Config()
	streams := cfg.Streams
	if streams == nil {
		streams = []config.Stream{}
	}
	writeJSON(w, map[string]any{"streams": streams}, s)
}

func (s *Server) handleListStreamUpstreams(w http.ResponseWriter, _ *http.Request) {
	cfg := s.mgr.Config()
	ups := cfg.StreamUpstreams
	if ups == nil {
		ups = []config.StreamUpstream{}
	}
	writeJSON(w, map[string]any{"stream_upstreams": ups}, s)
}

func writeJSON(w http.ResponseWriter, v any, s *Server) {
	w.Header().Set("Content-Type", "application/json")
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	if err := enc.Encode(v); err != nil {
		s.log.Warn("admin list encode failed", "error", err)
	}
}
