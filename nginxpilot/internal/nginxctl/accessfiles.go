package nginxctl

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/nginxconf"
)

// writeAccessFiles regenerates <data_dir>/access/<name>.htpasswd for every
// configured access list and prunes files for lists that no longer exist. The
// files hold password hashes (never plaintext) but are still 0600 within a
// 0700 dir — nginx workers read them as the daemon's user in the supported
// same-user deployment, and nothing else needs them.
func writeAccessFiles(cfg *config.Config) error {
	dir := filepath.Join(cfg.DataDir, nginxconf.AccessDirName)
	if len(cfg.AccessLists) == 0 {
		// No lists → prune the whole generated dir (idempotent).
		if err := os.RemoveAll(dir); err != nil && !os.IsNotExist(err) {
			return err
		}
		return nil
	}
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return err
	}

	want := map[string]bool{}
	for i := range cfg.AccessLists {
		l := &cfg.AccessLists[i]
		want[l.Name+".htpasswd"] = true
		path := nginxconf.HtpasswdPath(cfg.DataDir, l.Name)
		if err := os.WriteFile(path, []byte(nginxconf.HtpasswdContent(l)), 0o640); err != nil {
			return err
		}
	}

	// Prune stale files so a deleted list can't leave a live credential file.
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".htpasswd") || want[e.Name()] {
			continue
		}
		_ = os.Remove(filepath.Join(dir, e.Name()))
	}
	return nil
}
