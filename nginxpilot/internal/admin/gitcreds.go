package admin

// Git source credentials endpoints (PUT/GET/DELETE /git-credentials). A control
// plane (e.g. Perch) stores a private repo's access token as a daemon-owned
// 0600 file and references it from the site fragment via auth.token_file. The
// token is write-only over this API — GET returns metadata (name/path/mtime),
// never the secret material.

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"

	"github.com/kalevski/toolcase/nginxpilot/internal/gitcreds"
)

// handleSetGitCred stores a repo token (PUT /git-credentials/{name}).
func (s *Server) handleSetGitCred(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if !gitcreds.ValidName(name) {
		http.Error(w, "invalid credential name (must match [A-Za-z0-9][A-Za-z0-9._-]*)", http.StatusBadRequest)
		return
	}
	body, ok := readFragmentBody(w, r)
	if !ok {
		return
	}
	var req struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, fmt.Sprintf("invalid JSON: %v", err), http.StatusBadRequest)
		return
	}

	existed := s.mgr.HasGitCredential(name)
	path, err := s.mgr.SetGitCredential(name, req.Token)
	if err != nil {
		http.Error(w, fmt.Sprintf("store credential failed: %v", err), http.StatusBadRequest)
		return
	}
	if !existed {
		w.WriteHeader(http.StatusCreated)
	}
	writeJSON(w, map[string]any{
		"status": map[bool]string{true: "replaced", false: "created"}[existed],
		"name":   name,
		"path":   path,
	}, s)
}

// handleListGitCreds lists stored credentials — names + metadata only, no
// secrets (GET /git-credentials).
func (s *Server) handleListGitCreds(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, map[string]any{"credentials": s.mgr.ListGitCredentials()}, s)
}

// handleDeleteGitCred removes a stored credential (DELETE /git-credentials/{name}).
func (s *Server) handleDeleteGitCred(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if !gitcreds.ValidName(name) {
		http.Error(w, "invalid credential name", http.StatusBadRequest)
		return
	}
	if err := s.mgr.DeleteGitCredential(name); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			http.Error(w, "no such credential", http.StatusNotFound)
			return
		}
		http.Error(w, fmt.Sprintf("delete failed: %v", err), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("deleted\n"))
}
