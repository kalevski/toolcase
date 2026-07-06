package admin

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/htpasswd"
)

// accessListInfo is the masked read shape for GET /access-lists (better.md §1):
// the full policy minus every password hash — like NPM's maskItems, the store
// is write-only for secret material. `users` always serializes as an array.
type accessListInfo struct {
	Name     string               `json:"name"`
	Satisfy  string               `json:"satisfy,omitempty"`
	PassAuth bool                 `json:"pass_auth,omitempty"`
	Users    []accessListUserInfo `json:"users"`
	Rules    []config.AccessRule  `json:"rules"`
}

// accessListUserInfo is one masked user: the hash never crosses the wire, only
// whether a password has been set yet.
type accessListUserInfo struct {
	Username    string `json:"username"`
	HasPassword bool   `json:"has_password"`
}

func maskAccessList(l *config.AccessList) accessListInfo {
	users := make([]accessListUserInfo, 0, len(l.Users))
	for _, u := range l.Users {
		users = append(users, accessListUserInfo{Username: u.Username, HasPassword: u.PasswordHash != ""})
	}
	rules := l.Rules
	if rules == nil {
		rules = []config.AccessRule{}
	}
	return accessListInfo{
		Name:     l.Name,
		Satisfy:  l.Satisfy,
		PassAuth: l.PassAuth,
		Users:    users,
		Rules:    rules,
	}
}

// handleListAccessLists lists every configured access list, masked.
func (s *Server) handleListAccessLists(w http.ResponseWriter, _ *http.Request) {
	cfg := s.mgr.Config()
	out := make([]accessListInfo, 0, len(cfg.AccessLists))
	for i := range cfg.AccessLists {
		out = append(out, maskAccessList(&cfg.AccessLists[i]))
	}
	writeJSON(w, map[string]any{"access_lists": out}, s)
}

// handleCreateAccessList accepts an access-list fragment (one access_lists:
// entry, nothing else), validates the candidate merged config, and writes it
// atomically as access-<name>.yml. User passwords arrive as password_hash
// (pre-hashed) or via the dedicated PUT …/users/{username} call — never as
// plaintext in the fragment.
func (s *Server) handleCreateAccessList(w http.ResponseWriter, r *http.Request) {
	cfg, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}
	body, ok := readFragmentBody(w, r)
	if !ok {
		return
	}

	frag, err := config.ParseFragment(body, "<admin POST /access-lists>")
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid fragment: %v", err), http.StatusBadRequest)
		return
	}
	if err := requireExactlyOne(frag, "access_list"); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	name := frag.AccessLists[0].Name
	// The name regex is enforced by validateCandidate (full Validate); the
	// fragmentPath base check blocks any path-separator surprises.
	target, err := fragmentPath(dir, ext, accessListStemPrefix+name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// A control plane never sees password hashes (GET masks them), so a
	// replace-by-name edit arrives with hash-less users — carry each unchanged
	// user's existing hash forward, or every rules edit would silently wipe
	// the list's passwords. An explicit incoming password_hash still wins.
	mergeExistingPasswordHashes(cfg, &frag.AccessLists[0])

	if err := validateCandidate(cfg, frag, target); err != nil {
		http.Error(w, fmt.Sprintf("fragment rejected: %v", err), http.StatusBadRequest)
		return
	}

	// Persist the canonical render (not the raw body) so the merged hashes land.
	s.writeFragmentAndReload(w, target, []byte(renderAccessListFragment(&frag.AccessLists[0])), "access_list", name, nil)
}

// mergeExistingPasswordHashes fills the incoming list's hash-less users from
// the running config's same-named list (username-matched).
func mergeExistingPasswordHashes(cfg *config.Config, incoming *config.AccessList) {
	var existing *config.AccessList
	for i := range cfg.AccessLists {
		if cfg.AccessLists[i].Name == incoming.Name {
			existing = &cfg.AccessLists[i]
			break
		}
	}
	if existing == nil {
		return
	}
	byName := map[string]string{}
	for _, u := range existing.Users {
		byName[u.Username] = u.PasswordHash
	}
	for i := range incoming.Users {
		if incoming.Users[i].PasswordHash == "" {
			incoming.Users[i].PasswordHash = byName[incoming.Users[i].Username]
		}
	}
}

// handleDeleteAccessList removes the deterministic access-<name>.yml fragment
// and reloads. Like an upstream, an access list can be referenced (by a
// proxy/redirect/dead host's access_list:), so the candidate config is
// validated with the fragment dropped BEFORE touching disk — a still-referenced
// list is a 409 and the file stays in place.
func (s *Server) handleDeleteAccessList(w http.ResponseWriter, r *http.Request) {
	cfg, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}

	name := r.PathValue("name")
	target, err := fragmentPath(dir, ext, accessListStemPrefix+name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := validateCandidate(cfg, &config.Fragment{}, target); err != nil {
		http.Error(w, fmt.Sprintf("access list still in use: %v", err), http.StatusConflict)
		return
	}

	s.removeFragmentAndReload(w, target, "access_list", name)
}

// maxPasswordBytes bounds the PUT password body (htpasswd lines are small; a
// megabyte "password" is an abuse signal, not a credential).
const maxPasswordBytes = 1024

// handleSetAccessListUser (re)sets one user's password:
//
//	PUT /access-lists/{name}/users/{username}   body: {"password": "..."}
//
// The plaintext is hashed server-side (apr1 — the scheme nginx's auth_basic
// accepts everywhere) and written into the list's fragment as password_hash,
// so neither fragments nor GET responses ever carry plaintext. The user is
// upserted: an unknown username is added to the list. Only API-managed lists
// (an access-<name>.yml fragment) can be updated this way — a list declared in
// the main config file answers 409.
func (s *Server) handleSetAccessListUser(w http.ResponseWriter, r *http.Request) {
	cfg, dir, ext, ok := s.fragmentTarget(w)
	if !ok {
		return
	}

	name := r.PathValue("name")
	username := r.PathValue("username")
	if strings.ContainsAny(username, ":\n\r\t ") || username == "" {
		http.Error(w, "invalid username", http.StatusBadRequest)
		return
	}

	var req struct {
		Password string `json:"password"`
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, maxPasswordBytes+1))
	if err != nil || len(body) > maxPasswordBytes {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if err := json.Unmarshal(body, &req); err != nil || req.Password == "" {
		http.Error(w, `body must be {"password": "..."} with a non-empty password`, http.StatusBadRequest)
		return
	}

	target, err := fragmentPath(dir, ext, accessListStemPrefix+name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	frag, ok := s.loadAccessListFragment(w, cfg, target, name)
	if !ok {
		return
	}

	hash, err := htpasswd.Hash(req.Password)
	if err != nil {
		http.Error(w, "hashing failed", http.StatusInternalServerError)
		return
	}
	list := &frag.AccessLists[0]
	upserted := false
	for i := range list.Users {
		if list.Users[i].Username == username {
			list.Users[i].PasswordHash = hash
			upserted = true
			break
		}
	}
	if !upserted {
		list.Users = append(list.Users, config.AccessListUser{Username: username, PasswordHash: hash})
	}

	rendered := renderAccessListFragment(list)
	if err := validateCandidate(cfg, frag, target); err != nil {
		http.Error(w, fmt.Sprintf("fragment rejected: %v", err), http.StatusBadRequest)
		return
	}
	s.writeFragmentAndReload(w, target, []byte(rendered), "access_list", name, nil)
}

// loadAccessListFragment reads + parses the API-managed fragment for one
// access list, distinguishing "list doesn't exist" (404) from "list exists but
// is declared in a hand-managed file" (409).
func (s *Server) loadAccessListFragment(w http.ResponseWriter, cfg *config.Config, target, name string) (*config.Fragment, bool) {
	raw, err := os.ReadFile(target)
	if err != nil {
		declared := false
		for i := range cfg.AccessLists {
			if cfg.AccessLists[i].Name == name {
				declared = true
				break
			}
		}
		if declared {
			http.Error(w, "access list is not API-managed (declared outside the fragment dir)", http.StatusConflict)
		} else {
			http.Error(w, "no fragment for access_list", http.StatusNotFound)
		}
		return nil, false
	}
	frag, err := config.ParseFragment(raw, target)
	if err != nil {
		http.Error(w, fmt.Sprintf("stored fragment is invalid: %v", err), http.StatusInternalServerError)
		return nil, false
	}
	if err := requireExactlyOne(frag, "access_list"); err != nil || frag.AccessLists[0].Name != name {
		http.Error(w, "stored fragment does not match this access list", http.StatusConflict)
		return nil, false
	}
	return frag, true
}

// renderAccessListFragment emits the canonical single-list fragment YAML the
// password-set path rewrites. Values are validation-vetted; hashes/usernames
// are quoted so crypt's `$`/`.`/`/` charset can never trip a YAML parser.
func renderAccessListFragment(l *config.AccessList) string {
	var b strings.Builder
	b.WriteString("# managed by nginxpilot admin API; do not edit by hand.\n")
	b.WriteString("access_lists:\n")
	fmt.Fprintf(&b, "  - name: %s\n", l.Name)
	if l.Satisfy != "" {
		fmt.Fprintf(&b, "    satisfy: %s\n", l.Satisfy)
	}
	if l.PassAuth {
		b.WriteString("    pass_auth: true\n")
	}
	if len(l.Users) > 0 {
		b.WriteString("    users:\n")
		for _, u := range l.Users {
			fmt.Fprintf(&b, "      - username: %q\n", u.Username)
			if u.PasswordHash != "" {
				fmt.Fprintf(&b, "        password_hash: %q\n", u.PasswordHash)
			}
		}
	}
	if len(l.Rules) > 0 {
		b.WriteString("    rules:\n")
		for _, r := range l.Rules {
			if r.Allow != "" {
				fmt.Fprintf(&b, "      - allow: %q\n", r.Allow)
			} else {
				fmt.Fprintf(&b, "      - deny: %q\n", r.Deny)
			}
		}
	}
	return b.String()
}
