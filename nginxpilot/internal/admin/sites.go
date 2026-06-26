package admin

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// maxFragmentBytes caps a fragment request body. A site/upstream/proxy fragment
// is a few hundred bytes; anything larger is a client error, not a fragment.
const maxFragmentBytes = 64 << 10

// Fragment filename stem prefixes. Sites keep a bare <domain> stem for
// backward compatibility with already-deployed fragments; upstreams and
// proxies are namespaced so a site, a proxy (which shares the domain
// namespace) and an upstream never collide on one file and DELETE on one
// entity kind can never remove another's fragment.
const (
	upstreamStemPrefix = "upstream-"
	proxyStemPrefix    = "proxy-"
)

// handleCreateSite accepts a site fragment (the same YAML a file dropped into
// sites.d/ would contain — see config.Fragment / config/parse.go), validates it
// against the running config, writes it atomically into sites.d/ under a
// deterministic per-domain filename, and reloads. The fragment must declare
// exactly one site (and no upstreams/proxies) so the file maps 1:1 to a domain
// for DELETE /sites/{domain}. Invalid fragments are rejected before anything is
// written, so a bad fragment can never land on disk and break the next reload.
func (s *Server) handleCreateSite(w http.ResponseWriter, r *http.Request) {
	cfg, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}
	body, ok := readFragmentBody(w, r)
	if !ok {
		return
	}

	frag, err := config.ParseFragment(body, "<admin POST /sites>")
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid fragment: %v", err), http.StatusBadRequest)
		return
	}
	if len(frag.Sites) != 1 || len(frag.Upstreams) != 0 || len(frag.Proxies) != 0 {
		http.Error(w, "fragment must declare exactly one site (and no upstreams or proxies)", http.StatusBadRequest)
		return
	}

	domain, err := config.NormalizeDomain(frag.Sites[0].Domain)
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid domain: %v", err), http.StatusBadRequest)
		return
	}
	target, err := fragmentPath(dir, ext, domain)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate the candidate merged config (the running config minus the file
	// we are about to (over)write, plus the new fragment) before touching disk,
	// so duplicate-domain and per-site errors come back as a precise 400 and an
	// invalid fragment never reaches sites.d/.
	if err := validateCandidate(cfg, frag, target); err != nil {
		http.Error(w, fmt.Sprintf("fragment rejected: %v", err), http.StatusBadRequest)
		return
	}

	s.writeFragmentAndReload(w, target, body, "site", domain)
}

// handleDeleteSite removes the deterministic fragment file for a domain and
// reloads. Removing a site is always valid config, so the reload should accept
// it; a rejected reload (e.g. an unrelated invalid file) keeps the running
// config and is reported as a 500.
func (s *Server) handleDeleteSite(w http.ResponseWriter, r *http.Request) {
	_, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}

	domain, err := config.NormalizeDomain(r.PathValue("domain"))
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid domain: %v", err), http.StatusBadRequest)
		return
	}
	target, err := fragmentPath(dir, ext, domain)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.removeFragmentAndReload(w, target, "site", domain)
}

// fragmentTarget resolves the prerequisites shared by every fragment write:
// the reload hook must be wired and the config must declare an include: glob.
// It returns the running config plus the sites.d/ directory and extension, or
// writes a 501 and returns ok=false.
func (s *Server) fragmentTarget(w http.ResponseWriter) (cfg *config.Config, dir, ext string, ok bool) {
	if s.reload == nil {
		http.Error(w, "fragment management not available", http.StatusNotImplemented)
		return nil, "", "", false
	}
	cfg = s.mgr.Config()
	dir, ext, err := fragmentDir(cfg)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotImplemented)
		return nil, "", "", false
	}
	return cfg, dir, ext, true
}

// readFragmentBody reads and size-limits a fragment request body, writing the
// appropriate error response and returning ok=false on failure.
func readFragmentBody(w http.ResponseWriter, r *http.Request) ([]byte, bool) {
	body, err := io.ReadAll(io.LimitReader(r.Body, maxFragmentBytes+1))
	if err != nil {
		http.Error(w, "read body failed", http.StatusBadRequest)
		return nil, false
	}
	if len(body) > maxFragmentBytes {
		http.Error(w, "fragment too large", http.StatusRequestEntityTooLarge)
		return nil, false
	}
	return body, true
}

// writeFragmentAndReload writes a validated fragment to disk and reloads,
// rolling the file back if the on-disk reload is rejected. kind/key are used
// only for logging and the error/status text. Responds 201 (created) or 200
// (updated an existing fragment).
func (s *Server) writeFragmentAndReload(w http.ResponseWriter, target string, body []byte, kind, key string) {
	_, statErr := os.Stat(target)
	existed := statErr == nil
	if err := writeFileAtomic(target, body); err != nil {
		s.log.Error("write "+kind+" fragment failed", "key", key, "file", target, "error", err)
		http.Error(w, "write fragment failed", http.StatusInternalServerError)
		return
	}

	if err := s.reload(); err != nil {
		// Valid in isolation but the full on-disk reload was rejected (e.g. a
		// concurrent edit to another file). Roll back so we never leave a
		// fragment the running daemon hasn't accepted. The running config was
		// kept unchanged by the rejected reload, so removing the file restores
		// consistency without a second reload.
		_ = os.Remove(target)
		http.Error(w, "reload rejected; fragment rolled back", http.StatusInternalServerError)
		return
	}

	s.log.Info(kind+" fragment written via API", "key", key, "file", target)
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	if existed {
		_, _ = w.Write([]byte("updated\n"))
		return
	}
	w.WriteHeader(http.StatusCreated)
	_, _ = w.Write([]byte("created\n"))
}

// removeFragmentAndReload deletes a deterministic fragment file and reloads.
// kind/key drive the logging and error text. 404 when the file is absent.
func (s *Server) removeFragmentAndReload(w http.ResponseWriter, target, kind, key string) {
	if err := os.Remove(target); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			http.Error(w, "no fragment for "+kind, http.StatusNotFound)
			return
		}
		s.log.Error("remove "+kind+" fragment failed", "key", key, "file", target, "error", err)
		http.Error(w, "remove fragment failed", http.StatusInternalServerError)
		return
	}

	if err := s.reload(); err != nil {
		http.Error(w, "fragment removed but reload rejected; running config kept", http.StatusInternalServerError)
		return
	}

	s.log.Info(kind+" fragment removed via API", "key", key, "file", target)
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("deleted\n"))
}

// validateCandidate runs the full config validation over the running config
// with the target fragment file swapped for the new one, so the API rejects the
// exact set of errors a reload would (duplicate domains/names across files,
// malformed sources, unknown upstream references, …) without first writing to
// disk. Entries are dropped by their declaring File and the fragment's entries
// appended; every list is rebuilt into a fresh slice so Validate's in-place
// normalization never mutates the live config.
func validateCandidate(cfg *config.Config, frag *config.Fragment, target string) error {
	cand := *cfg

	sites := make([]config.Site, 0, len(cfg.Sites)+len(frag.Sites))
	for _, st := range cfg.Sites {
		if st.File != target { // drop the fragment we're replacing (update case)
			sites = append(sites, st)
		}
	}
	cand.Sites = append(sites, frag.Sites...)

	upstreams := make([]config.Upstream, 0, len(cfg.Upstreams)+len(frag.Upstreams))
	for _, u := range cfg.Upstreams {
		if u.File != target {
			upstreams = append(upstreams, u)
		}
	}
	cand.Upstreams = append(upstreams, frag.Upstreams...)

	proxies := make([]config.Proxy, 0, len(cfg.Proxies)+len(frag.Proxies))
	for _, p := range cfg.Proxies {
		if p.File != target {
			proxies = append(proxies, p)
		}
	}
	cand.Proxies = append(proxies, frag.Proxies...)

	return config.Validate(&cand)
}

// fragmentDir derives the sites.d/ directory and fragment extension from the
// first include glob, resolved relative to the main config file. Writing files
// here (matching the glob's extension) means the include loader picks them up on
// the next reload exactly as a hand-dropped file would.
func fragmentDir(cfg *config.Config) (dir, ext string, err error) {
	if len(cfg.Include) == 0 {
		return "", "", errors.New("fragment management requires an include: glob in the config")
	}
	pattern := cfg.Include[0]
	if !filepath.IsAbs(pattern) {
		pattern = filepath.Join(filepath.Dir(cfg.Path), pattern)
	}
	ext = filepath.Ext(pattern) // ".yml" from "sites.d/*.yml"
	if ext == "" {
		ext = ".yml"
	}
	return filepath.Dir(pattern), ext, nil
}

// fragmentPath builds the fragment file path for an (already-normalized) stem —
// a domain for a site/proxy, "upstream-<name>" for an upstream — guarding
// against any path-separator surprises as defense in depth on top of
// NormalizeDomain / the upstream name regex.
func fragmentPath(dir, ext, stem string) (string, error) {
	name := stem + ext
	if name != filepath.Base(name) {
		return "", fmt.Errorf("invalid fragment name %q", stem)
	}
	return filepath.Join(dir, name), nil
}

// writeFileAtomic writes data to path crash-durably: write a temp file in the
// same directory, fsync it, rename into place, then fsync the directory. Mirrors
// the durability discipline used for state and release swaps elsewhere.
func writeFileAtomic(path string, data []byte) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".fragment-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName) // no-op once the rename succeeds

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Chmod(0o640); err != nil { // group-readable, matching the daemon umask
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpName, path); err != nil {
		return err
	}
	if d, err := os.Open(dir); err == nil {
		_ = d.Sync()
		_ = d.Close()
	}
	return nil
}
