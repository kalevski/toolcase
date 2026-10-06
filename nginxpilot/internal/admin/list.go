package admin

import (
	"encoding/json"
	"net/http"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// handleListSites, handleListUpstreams and handleListProxies expose the
// running merged config (main file + all fragments) as JSON so a control plane
// (Quaykeeper) can read current state without re-reading sites.d/ off disk. Secret
// material is never present — auth carries only *_env / *_file references — and
// internal provenance (the File field) is dropped via json:"-". The lists
// always serialize as an array, never null. Every list route shares the opt-in
// paging of paginate.go (limit / cursor); sites also take fields=summary.
func (s *Server) handleListSites(w http.ResponseWriter, r *http.Request) {
	p, ok := parsePage(w, r, true)
	if !ok {
		return
	}
	cfg := s.mgr.Config()
	page, body := paginate(cfg.Sites, func(x config.Site) string { return x.Domain }, p)
	if p.summary {
		out := make([]siteSummary, 0, len(page))
		for _, site := range page {
			out = append(out, siteSummary{Domain: site.Domain, Type: site.Source.Type, Routing: site.RoutingMode()})
		}
		body["sites"] = out
	} else {
		body["sites"] = page
	}
	writeJSON(w, r, body, s)
}

// siteSummary is the small `fields=summary` view of a site: enough to list and
// route on without serializing the whole merged object.
type siteSummary struct {
	Domain  string `json:"domain"`
	Type    string `json:"type"`
	Routing string `json:"routing"`
}

func listRoute[T any](s *Server, w http.ResponseWriter, r *http.Request, name string, items []T, key func(T) string) {
	p, ok := parsePage(w, r, false)
	if !ok {
		return
	}
	page, body := paginate(items, key, p)
	body[name] = page
	writeJSON(w, r, body, s)
}

func (s *Server) handleListUpstreams(w http.ResponseWriter, r *http.Request) {
	listRoute(s, w, r, "upstreams", s.mgr.Config().Upstreams, func(x config.Upstream) string { return x.Name })
}

func (s *Server) handleListProxies(w http.ResponseWriter, r *http.Request) {
	listRoute(s, w, r, "proxies", s.mgr.Config().Proxies, func(x config.Proxy) string { return x.Domain })
}

func (s *Server) handleListRedirects(w http.ResponseWriter, r *http.Request) {
	listRoute(s, w, r, "redirects", s.mgr.Config().Redirects, func(x config.Redirect) string { return x.Domain })
}

func (s *Server) handleListDeadHosts(w http.ResponseWriter, r *http.Request) {
	listRoute(s, w, r, "dead_hosts", s.mgr.Config().DeadHosts, func(x config.DeadHost) string { return x.Domain })
}

func (s *Server) handleListStreams(w http.ResponseWriter, r *http.Request) {
	listRoute(s, w, r, "streams", s.mgr.Config().Streams, func(x config.Stream) string { return x.Name })
}

func (s *Server) handleListStreamUpstreams(w http.ResponseWriter, r *http.Request) {
	listRoute(s, w, r, "stream_upstreams", s.mgr.Config().StreamUpstreams, func(x config.StreamUpstream) string { return x.Name })
}

// writeJSON encodes compact by default; ?pretty=1 indents (for humans with
// curl). Callers whose body is a pre-encoded document (/schema) don't use it.
func writeJSON(w http.ResponseWriter, r *http.Request, v any, s *Server) {
	w.Header().Set("Content-Type", "application/json")
	enc := json.NewEncoder(w)
	if r != nil && r.URL.Query().Get("pretty") == "1" {
		enc.SetIndent("", "  ")
	}
	if err := enc.Encode(v); err != nil {
		s.log.Warn("admin list encode failed", "error", err)
	}
}
