package admin

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// logCredentialsDir is where inline log-destination credentials land:
// data_dir/log-credentials/<name>/<file>, one 0700 directory per destination,
// every file 0600 and daemon-owned — the same shape CheckSecretFile accepts.
const logCredentialsDir = "log-credentials"

// inlineLogCredential maps one inline fragment key onto the file it is stored
// in and the *_file reference that replaces it.
type inlineLogCredential struct {
	inline string
	ref    string
	file   string
}

var (
	inlineLogTLS = []inlineLogCredential{
		{inline: "ca_pem", ref: "ca_file", file: "ca.pem"},
		{inline: "client_cert_pem", ref: "client_cert_file", file: "client.crt"},
		{inline: "client_key_pem", ref: "client_key_file", file: "client.key"},
	}
	inlineLogAuth = []inlineLogCredential{
		{inline: "password", ref: "password_file", file: "password"},
		{inline: "token", ref: "token_file", file: "token"},
		{inline: "header_value", ref: "header_value_file", file: "header-value"},
	}
)

// storeLogDestCredentials lets a control plane send push credentials and
// certificates inline over the (authenticated) admin API while the on-disk
// config stays secrets-by-reference: every inline value is written to its own
// 0600 file and the fragment is rewritten to carry only the *_file path.
// Files from an earlier write that this fragment no longer uses are removed.
// A fragment that is not a single named destination is returned unchanged so
// the regular parse path reports the error.
func storeLogDestCredentials(cfg *config.Config, body []byte) ([]byte, error) {
	var doc map[string]any
	if err := yaml.Unmarshal(body, &doc); err != nil {
		return body, nil
	}
	list, ok := doc["log_destinations"].([]any)
	if !ok || len(list) != 1 {
		return body, nil
	}
	dest, ok := list[0].(map[string]any)
	if !ok {
		return body, nil
	}
	name, _ := dest["name"].(string)
	if !logDestNameRe.MatchString(name) {
		return body, nil
	}

	dir := ""
	if cfg.DataDir != "" {
		dir = filepath.Join(cfg.DataDir, logCredentialsDir, name)
	}

	auth, _ := dest["auth"].(map[string]any)
	pending := map[string]string{}
	take := func(block map[string]any, entries []inlineLogCredential) {
		if block == nil {
			return
		}
		for _, entry := range entries {
			raw, present := block[entry.inline]
			if !present {
				continue
			}
			delete(block, entry.inline)
			value, _ := raw.(string)
			if value == "" {
				continue
			}
			pending[entry.file] = value
			block[entry.ref] = filepath.Join(dir, entry.file)
		}
	}
	take(dest, inlineLogTLS)
	take(auth, inlineLogAuth)

	if len(pending) > 0 && dir == "" {
		return nil, errors.New("inline credentials need data_dir to be set")
	}
	if len(pending) > 0 {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return nil, fmt.Errorf("create credential dir: %w", err)
		}
		for file, value := range pending {
			path := filepath.Join(dir, file)
			if err := writeFileAtomic(path, []byte(value+"\n")); err != nil {
				return nil, fmt.Errorf("store %s: %w", file, err)
			}
			if err := os.Chmod(path, 0o600); err != nil {
				return nil, fmt.Errorf("store %s: %w", file, err)
			}
		}
	}
	if dir != "" {
		pruneLogCredentials(dir, pending)
	}
	if len(pending) == 0 {
		return body, nil
	}
	return yaml.Marshal(doc)
}

// pruneLogCredentials removes credential files a destination no longer uses
// (an auth method switched, a certificate dropped), and the directory itself
// once it is empty.
func pruneLogCredentials(dir string, keep map[string]string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if _, ok := keep[entry.Name()]; ok {
			continue
		}
		_ = os.Remove(filepath.Join(dir, entry.Name()))
	}
	if len(keep) == 0 {
		_ = os.Remove(dir)
	}
}

// removeLogCredentials drops a deleted destination's credential directory.
func removeLogCredentials(cfg *config.Config, name string) {
	if cfg.DataDir == "" || !logDestNameRe.MatchString(name) {
		return
	}
	_ = os.RemoveAll(filepath.Join(cfg.DataDir, logCredentialsDir, name))
}
