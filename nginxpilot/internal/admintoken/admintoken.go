// Package admintoken stores and checks the admin-API bearer token.
//
// The daemon only ever compares an incoming token, so admin.token_file holds a
// hash ("sha256:<hex>"), never the token: reading the file does not reveal it.
// admin.token_env, when set alongside token_file, only seeds the file on the
// first start; after that the file wins and the variable can be removed, so
// `docker inspect` shows at most a dead token. `nginxpilot token set` replaces
// the stored hash; the daemon reads it once at startup (restart to apply).
package admintoken

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

const prefix = "sha256:"

// MinLength is the shortest token `token set` accepts.
const MinLength = 32

// Hash is a stored token hash; nil means no auth is configured.
type Hash []byte

// Resolution is what Resolve found, for the caller to log.
type Resolution struct {
	Hash Hash
	// Seeded is true when token_file was just written from token_env.
	Seeded bool
	// EnvIgnored is true when token_env holds a token that no longer matches
	// the stored hash (it was rotated with `token set`).
	EnvIgnored bool
}

// Sum hashes a token into the stored format.
func Sum(token string) string {
	sum := sha256.Sum256([]byte(token))
	return prefix + hex.EncodeToString(sum[:])
}

// Parse reads a stored "sha256:<hex>" value.
func Parse(stored string) (Hash, error) {
	stored = strings.TrimSpace(stored)
	if !strings.HasPrefix(stored, prefix) {
		return nil, errors.New("not a sha256 hash — admin.token_file holds a hash since the plaintext format was dropped; run `nginxpilot token set` to store one")
	}
	raw, err := hex.DecodeString(strings.TrimPrefix(stored, prefix))
	if err != nil || len(raw) != sha256.Size {
		return nil, errors.New("malformed sha256 hash; run `nginxpilot token set` to store a new one")
	}
	return raw, nil
}

// Matches reports whether a presented bearer token hashes to h, in constant time.
func (h Hash) Matches(presented string) bool {
	sum := sha256.Sum256([]byte(presented))
	return subtle.ConstantTimeCompare(sum[:], h) == 1
}

// Resolve loads the admin token hash from the config's refs:
//
//   - neither ref set: no auth (nil hash, no error);
//   - token_env only: the variable's value, hashed in memory;
//   - token_file set: the stored hash; when the file is missing it is seeded
//     from token_env (which must then be set and non-empty).
//
// A configured ref that resolves to nothing is an error, so the daemon refuses
// to start rather than expose an unauthenticated endpoint.
func Resolve(tokenEnv, tokenFile string) (Resolution, error) {
	if tokenEnv == "" && tokenFile == "" {
		return Resolution{}, nil
	}
	envValue := ""
	if tokenEnv != "" {
		envValue = strings.TrimSpace(os.Getenv(tokenEnv))
	}

	if tokenFile == "" {
		if envValue == "" {
			return Resolution{}, fmt.Errorf("environment variable %s is not set or empty", tokenEnv)
		}
		sum := sha256.Sum256([]byte(envValue))
		return Resolution{Hash: sum[:]}, nil
	}

	raw, err := os.ReadFile(tokenFile)
	if err == nil {
		if err := config.CheckSecretFile(tokenFile); err != nil {
			return Resolution{}, err
		}
		hash, err := Parse(string(raw))
		if err != nil {
			return Resolution{}, fmt.Errorf("admin.token_file %s: %w", tokenFile, err)
		}
		return Resolution{Hash: hash, EnvIgnored: envValue != "" && !hash.Matches(envValue)}, nil
	}
	if !errors.Is(err, fs.ErrNotExist) {
		return Resolution{}, fmt.Errorf("admin.token_file %s: %w", tokenFile, err)
	}

	if envValue == "" {
		if tokenEnv == "" {
			return Resolution{}, fmt.Errorf("admin.token_file %s does not exist; run `nginxpilot token set` or set admin.token_env to seed it", tokenFile)
		}
		return Resolution{}, fmt.Errorf("admin.token_file %s does not exist and %s is empty, so there is nothing to seed it from", tokenFile, tokenEnv)
	}
	if err := Store(tokenFile, envValue); err != nil {
		return Resolution{}, fmt.Errorf("seed admin.token_file: %w", err)
	}
	sum := sha256.Sum256([]byte(envValue))
	return Resolution{Hash: sum[:], Seeded: true}, nil
}

// Store writes the hash of token to path atomically (temp file + rename, 0600).
// Run as root — `docker exec` defaults to it — the file is handed to the owner
// of its directory, so the unprivileged daemon can still read it.
func Store(path, token string) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	suffix := make([]byte, 6)
	if _, err := rand.Read(suffix); err != nil {
		return err
	}
	temp := filepath.Join(dir, "."+filepath.Base(path)+"-"+hex.EncodeToString(suffix))
	f, err := os.OpenFile(temp, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return err
	}
	defer os.Remove(temp)
	if _, err := f.WriteString(Sum(token) + "\n"); err != nil {
		f.Close()
		return err
	}
	if err := f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	if os.Geteuid() == 0 {
		if info, err := os.Stat(dir); err == nil {
			if st, ok := info.Sys().(*syscall.Stat_t); ok {
				if err := os.Chown(temp, int(st.Uid), int(st.Gid)); err != nil {
					return err
				}
			}
		}
	}
	return os.Rename(temp, path)
}
