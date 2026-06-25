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

// maxFragmentBytes caps the POST /sites request body. A site fragment is a few
// hundred bytes; anything larger is a client error, not a fragment.
const maxFragmentBytes = 64 << 10

// handleCreateSite accepts a site fragment (the same YAML a file dropped into
// sites.d/ would contain — see config.Fragment / config/parse.go), validates it
// against the running config, writes it atomically into sites.d/ under a
// deterministic per-domain filename, and reloads. The fragment must declare
// exactly one site (and no upstreams/proxies) so the file maps 1:1 to a domain
// for DELETE /sites/{domain}. Invalid fragments are rejected before anything is
// written, so a bad fragment can never land on disk and break the next reload.
func (s *Server) handleCreateSite(w http.ResponseWriter, r *http.Request) {
	if s.reload == nil {
		http.Error(w, "fragment management not available", http.StatusNotImplemented)
		return
	}

	cfg := s.mgr.Config()
	dir, ext, err := fragmentTarget(cfg)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotImplemented)
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, maxFragmentBytes+1))
	if err != nil {
		http.Error(w, "read body failed", http.StatusBadRequest)
		return
	}
	if len(body) > maxFragmentBytes {
		http.Error(w, "fragment too large", http.StatusRequestEntityTooLarge)
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

	_, statErr := os.Stat(target)
	existed := statErr == nil
	if err := writeFileAtomic(target, body); err != nil {
		s.log.Error("write site fragment failed", "domain", domain, "file", target, "error", err)
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

	s.log.Info("site fragment written via API", "domain", domain, "file", target)
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	if existed {
		_, _ = w.Write([]byte("updated\n"))
		return
	}
	w.WriteHeader(http.StatusCreated)
	_, _ = w.Write([]byte("created\n"))
}

// handleDeleteSite removes the deterministic fragment file for a domain and
// reloads. Removing a site is always valid config, so the reload should accept
// it; a rejected reload (e.g. an unrelated invalid file) keeps the running
// config and is reported as a 500.
func (s *Server) handleDeleteSite(w http.ResponseWriter, r *http.Request) {
	if s.reload == nil {
		http.Error(w, "fragment management not available", http.StatusNotImplemented)
		return
	}

	cfg := s.mgr.Config()
	dir, ext, err := fragmentTarget(cfg)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotImplemented)
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

	if err := os.Remove(target); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			http.Error(w, "no fragment for domain", http.StatusNotFound)
			return
		}
		s.log.Error("remove site fragment failed", "domain", domain, "file", target, "error", err)
		http.Error(w, "remove fragment failed", http.StatusInternalServerError)
		return
	}

	if err := s.reload(); err != nil {
		http.Error(w, "fragment removed but reload rejected; running config kept", http.StatusInternalServerError)
		return
	}

	s.log.Info("site fragment removed via API", "domain", domain, "file", target)
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("deleted\n"))
}

// validateCandidate runs the full config validation over the running config
// with the target fragment file swapped for the new one, so the API rejects the
// exact set of errors a reload would (duplicate domains across files, malformed
// sources, …) without first writing to disk. Sites are copied by value, so
// Validate's in-place domain normalization never mutates the live config.
func validateCandidate(cfg *config.Config, frag *config.Fragment, target string) error {
	cand := *cfg
	sites := make([]config.Site, 0, len(cfg.Sites)+len(frag.Sites))
	for _, st := range cfg.Sites {
		if st.File != target { // drop the fragment we're replacing (update case)
			sites = append(sites, st)
		}
	}
	cand.Sites = append(sites, frag.Sites...)
	return config.Validate(&cand)
}

// fragmentTarget derives the sites.d/ directory and fragment extension from the
// first include glob, resolved relative to the main config file. Writing files
// here (matching the glob's extension) means the include loader picks them up on
// the next reload exactly as a hand-dropped file would.
func fragmentTarget(cfg *config.Config) (dir, ext string, err error) {
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

// fragmentPath builds the fragment file path for a (already-normalized) domain,
// guarding against any path-separator surprises as defense in depth on top of
// NormalizeDomain.
func fragmentPath(dir, ext, domain string) (string, error) {
	name := domain + ext
	if name != filepath.Base(name) {
		return "", fmt.Errorf("invalid domain %q", domain)
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
