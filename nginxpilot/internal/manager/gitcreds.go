package manager

// Git source credentials (git-credentials admin API). A control plane stores a
// repo token here and references it from a site fragment via auth.token_file —
// the token is resolved at fetch time, so a replaced token takes effect on the
// next sync with no reload.

import (
	"os"

	"github.com/kalevski/toolcase/nginxpilot/internal/gitcreds"
)

// SetGitCredential stores (or replaces) a repo token under name and returns
// the on-disk path a fragment's auth.token_file should reference.
func (m *Manager) SetGitCredential(name, token string) (string, error) {
	path, err := m.gitCreds.Set(name, token)
	if err != nil {
		return "", err
	}
	m.log.Info("git credential stored", "name", name, "path", path)
	return path, nil
}

// HasGitCredential reports whether a credential is stored under name.
func (m *Manager) HasGitCredential(name string) bool {
	return m.gitCreds.Has(name)
}

// ListGitCredentials lists stored credentials (metadata only, never tokens).
func (m *Manager) ListGitCredentials() []gitcreds.Info {
	if m.gitCreds == nil {
		return []gitcreds.Info{}
	}
	return m.gitCreds.List()
}

// DeleteGitCredential removes a stored credential. os.ErrNotExist when absent.
func (m *Manager) DeleteGitCredential(name string) error {
	if m.gitCreds == nil {
		return os.ErrNotExist
	}
	return m.gitCreds.Delete(name)
}
