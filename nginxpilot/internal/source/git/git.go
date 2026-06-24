// Package git implements the git source via the system git binary
// (spec §4.1, Q15): battle-tested auth, zero maintenance. Every invocation
// runs with a scrubbed environment and a context deadline.
package git

import (
	"archive/tar"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/source"
	"github.com/kalevski/toolcase/nginxpilot/internal/state"
)

// Syncer syncs one git-backed site.
type Syncer struct {
	domain  string
	url     string
	branch  string
	subdir  string
	auth    config.Auth
	limits  config.Limits
	dataDir string
	log     *slog.Logger

	// keyPath is the on-disk ssh private key path for the current sync,
	// resolved by materializeKey (key_file path as-is, or a temp file
	// written from key_env). Empty outside an in-flight Sync.
	keyPath string
}

// New builds a Syncer from a validated site source.
func New(domain string, src config.Source, dataDir string, log *slog.Logger) *Syncer {
	return &Syncer{
		domain:  domain,
		url:     src.URL,
		branch:  src.Branch,
		subdir:  strings.Trim(path.Clean(src.Subdir), "/"),
		auth:    src.Auth,
		limits:  src.Limits.Effective(),
		dataDir: dataDir,
		log:     log,
	}
}

// Type implements source.Source.
func (s *Syncer) Type() string { return config.SourceGit }

// CacheDir returns the bare-repo cache path for a site identified by domain,
// url, and branch. Identical inputs always return the same path; any field
// difference produces a distinct path. Exported so the manager can build the
// live set for garbage collection without constructing a Syncer.
func CacheDir(domain, dataDir, url, branch string) string {
	sum := sha256.Sum256([]byte(domain + "\x00" + url + "\x00" + branch))
	return filepath.Join(dataDir, "cache", "git", hex.EncodeToString(sum[:8]))
}

// cacheDir is the bare fetch target for this Syncer — never served, fully disposable.
func (s *Syncer) cacheDir() string {
	return CacheDir(s.domain, s.dataDir, s.url, s.branch)
}

// Sync implements source.Source.
func (s *Syncer) Sync(ctx context.Context, st *state.SiteState, stagingDir string) (*source.Result, error) {
	if _, err := exec.LookPath("git"); err != nil {
		return nil, fmt.Errorf("git binary not found in PATH")
	}

	cleanupKey, err := s.materializeKey()
	if err != nil {
		return nil, err
	}
	defer cleanupKey()

	cache := s.cacheDir()
	if err := s.ensureCache(ctx, cache); err != nil {
		return nil, err
	}

	sha, err := s.git(ctx, cache, "rev-parse", "refs/heads/"+s.branch)
	if err != nil {
		return nil, fmt.Errorf("rev-parse %s: %w", s.branch, err)
	}
	sha = strings.TrimSpace(sha)

	if sha == st.DeployedRef {
		return &source.Result{Changed: false, Ref: sha}, nil
	}

	if err := s.extract(ctx, cache, sha, stagingDir); err != nil {
		return nil, err
	}
	return &source.Result{Changed: true, Ref: sha}, nil
}

// ensureCache clones the bare cache if missing, otherwise fetches. Any
// fetch error (force-push, shallow confusion) nukes the cache and reclones
// once — the cache is disposable (spec §4.1).
func (s *Syncer) ensureCache(ctx context.Context, cache string) error {
	if _, err := os.Stat(filepath.Join(cache, "HEAD")); err != nil {
		return s.clone(ctx, cache)
	}
	_, err := s.git(ctx, cache, "fetch", "--depth=1", "--force", "--prune", "origin",
		"+refs/heads/"+s.branch+":refs/heads/"+s.branch)
	if err == nil {
		return nil
	}
	if ctx.Err() != nil {
		return err
	}
	s.log.Warn("git fetch failed, nuking cache and recloning", "url", s.url, "error", err)
	if rmErr := os.RemoveAll(cache); rmErr != nil {
		return fmt.Errorf("remove broken cache: %w", rmErr)
	}
	return s.clone(ctx, cache)
}

func (s *Syncer) clone(ctx context.Context, cache string) error {
	if err := os.MkdirAll(filepath.Dir(cache), 0o750); err != nil {
		return err
	}
	_ = os.RemoveAll(cache)
	// Shallow, single-branch, bare: content is all that's deployed, history
	// is dead weight (spec Q13).
	_, err := s.git(ctx, filepath.Dir(cache), "clone", "--bare", "--depth=1",
		"--single-branch", "--branch", s.branch, "--", s.url, cache)
	if err != nil {
		return fmt.Errorf("clone %s: %w", s.url, err)
	}
	return nil
}

// extract materializes the tree at sha into stagingDir via
// `git archive | in-process tar`, honoring subdir and skipping symlinks.
func (s *Syncer) extract(ctx context.Context, cache, sha, stagingDir string) error {
	args := []string{"archive", "--format=tar", sha}
	if s.subdir != "" && s.subdir != "." {
		args = append(args, "--", s.subdir)
	}

	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = cache
	env, err := s.gitEnv()
	if err != nil {
		return err
	}
	cmd.Env = env
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	extractErr := s.untar(stdout, stagingDir)
	waitErr := cmd.Wait()
	if waitErr != nil {
		return fmt.Errorf("git archive %s: %w: %s", sha[:12], waitErr, strings.TrimSpace(stderr.String()))
	}
	if extractErr != nil {
		return fmt.Errorf("extract git archive: %w", extractErr)
	}
	return nil
}

// untar extracts a tar stream into dest, stripping the subdir prefix when
// configured. Paths are validated against traversal; symlinks and other
// special entries are skipped with a warning (an escaping symlink would be
// a read-anything primitive through nginx). Entry count and total written
// bytes are bounded by s.limits (mirrors httpzip extraction guards).
func (s *Syncer) untar(r io.Reader, dest string) error {
	maxEntries := s.limits.MaxEntries
	maxUncompressed := int64(s.limits.MaxUncompressedSize)

	prefix := ""
	if s.subdir != "" && s.subdir != "." {
		prefix = s.subdir + "/"
	}

	var entries int
	var written int64

	tr := tar.NewReader(r)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}

		entries++
		if entries > maxEntries {
			return fmt.Errorf("limit exceeded: max_entries (%d)", maxEntries)
		}

		name := path.Clean(strings.TrimPrefix(hdr.Name, "./"))
		if name == "." {
			continue
		}
		if path.IsAbs(name) || name == ".." || strings.HasPrefix(name, "../") {
			return fmt.Errorf("archive entry %q escapes the staging dir", hdr.Name)
		}
		if prefix != "" {
			if name+"/" == prefix || name == strings.TrimSuffix(prefix, "/") {
				continue
			}
			if !strings.HasPrefix(name, prefix) {
				continue
			}
			name = strings.TrimPrefix(name, prefix)
		}
		target := filepath.Join(dest, filepath.FromSlash(name))

		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0o750); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0o750); err != nil {
				return err
			}
			f, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o640)
			if err != nil {
				return err
			}
			remaining := maxUncompressed - written
			// +1 so that reading exactly budget+1 bytes signals overrun.
			n, copyErr := io.Copy(f, io.LimitReader(tr, remaining+1))
			written += n
			closeErr := f.Close()
			if copyErr != nil {
				return copyErr
			}
			if closeErr != nil {
				return closeErr
			}
			if written > maxUncompressed {
				return fmt.Errorf("limit exceeded: max_uncompressed_size (%s)", s.limits.MaxUncompressedSize)
			}
		case tar.TypeSymlink, tar.TypeLink:
			s.log.Warn("skipping link entry in git tree", "entry", hdr.Name)
		case tar.TypeXGlobalHeader, tar.TypeXHeader:
			// pax metadata emitted by git archive — not content.
		default:
			s.log.Warn("skipping special entry in git tree", "entry", hdr.Name, "type", hdr.Typeflag)
		}
	}
}

// git runs one git invocation with a scrubbed environment.
func (s *Syncer) git(ctx context.Context, dir string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = dir
	env, err := s.gitEnv()
	if err != nil {
		return "", err
	}
	cmd.Env = env
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git %s: %w: %s", args[0], err, strings.TrimSpace(stderr.String()))
	}
	return stdout.String(), nil
}

// gitEnv builds the scrubbed environment: no terminal prompts, no user or
// system git config, explicit GIT_SSH_COMMAND, secrets injected via
// GIT_CONFIG_* env vars so they never appear in argv (spec §4.1).
func (s *Syncer) gitEnv() ([]string, error) {
	env := []string{
		"PATH=" + os.Getenv("PATH"),
		"HOME=" + s.dataDir,
		"GIT_TERMINAL_PROMPT=0",
		"GIT_CONFIG_NOSYSTEM=1",
		"GIT_CONFIG_GLOBAL=/dev/null",
		"LC_ALL=C",
	}

	switch s.auth.MethodOrNone() {
	case config.AuthSSHKey:
		kh := s.auth.KnownHosts
		strict := "accept-new" // TOFU default (spec Q7)
		if kh != "" {
			strict = "yes"
		} else {
			kh = filepath.Join(s.dataDir, "known_hosts")
		}
		keyPath := s.keyPath
		if keyPath == "" {
			keyPath = s.auth.KeyFile // materializeKey not run (e.g. unit test)
		}
		sshCmd := fmt.Sprintf(
			"ssh -F /dev/null -i %s -o IdentitiesOnly=yes -o UserKnownHostsFile=%s -o StrictHostKeyChecking=%s -o BatchMode=yes",
			shellQuote(keyPath), shellQuote(kh), strict)
		env = append(env, "GIT_SSH_COMMAND="+sshCmd)
	case config.AuthHTTPSToken:
		token, err := config.ResolveSecret(s.auth.TokenEnv, s.auth.TokenFile)
		if err != nil {
			return nil, fmt.Errorf("resolve git token: %w", err)
		}
		env = append(env, basicAuthEnv(s.url, s.auth.Username, token)...)
	case config.AuthGitHubToken:
		// Token-only GitHub auth: the access token is the basic-auth
		// password under the fixed "x-access-token" username — the
		// convention GitHub uses for OAuth / gh-CLI / app tokens, and
		// which PATs also accept. The token is injected as an
		// Authorization header via GIT_CONFIG_* so it never lands in
		// argv or on disk (matches https-token, spec §4.1).
		token, err := config.ResolveSecret(s.auth.TokenEnv, s.auth.TokenFile)
		if err != nil {
			return nil, fmt.Errorf("resolve git token: %w", err)
		}
		env = append(env, basicAuthEnv(s.url, "x-access-token", token)...)
	default:
		// none: still pin a sane GIT_SSH_COMMAND so ssh URLs can't fall
		// back to interactive prompts (validation forbids none+ssh anyway).
		env = append(env, "GIT_SSH_COMMAND=ssh -F /dev/null -o BatchMode=yes")
	}
	return env, nil
}

func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

// materializeKey resolves the ssh private key (ssh-key auth) to a path ssh
// can read, setting s.keyPath and returning a cleanup func.
//
//   - key_file: used in place; cleanup is a no-op.
//   - key_env:  the key material is written to a 0600 temp file owned by the
//     daemon under data_dir/tmp, and cleanup removes it. This lets a key be
//     supplied entirely through config + an env var (e.g. docker run -e
//     SSH_KEY="$(cat id_ed25519)"), with no host-side staging or chown — the
//     friction key_file hits in a container where the host-uid key is
//     unreadable by the unprivileged daemon.
//
// For non-ssh-key auth it is a no-op.
func (s *Syncer) materializeKey() (func(), error) {
	noop := func() {}
	if s.auth.MethodOrNone() != config.AuthSSHKey {
		return noop, nil
	}
	if s.auth.KeyFile != "" {
		s.keyPath = s.auth.KeyFile
		return noop, nil
	}

	key, err := config.ResolveSecret(s.auth.KeyEnv, "")
	if err != nil {
		return nil, fmt.Errorf("resolve ssh key: %w", err)
	}
	dir := filepath.Join(s.dataDir, "tmp")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("ssh key tmp dir: %w", err)
	}
	f, err := os.CreateTemp(dir, "sshkey-*")
	if err != nil {
		return nil, fmt.Errorf("create ssh key file: %w", err)
	}
	path := f.Name()
	cleanup := func() { _ = os.Remove(path) }
	if err := f.Chmod(0o600); err != nil {
		_ = f.Close()
		cleanup()
		return nil, fmt.Errorf("chmod ssh key file: %w", err)
	}
	// ResolveSecret trims surrounding whitespace; OpenSSH needs the trailing
	// newline back or it rejects the key as malformed.
	if _, err := f.WriteString(key + "\n"); err != nil {
		_ = f.Close()
		cleanup()
		return nil, fmt.Errorf("write ssh key file: %w", err)
	}
	if err := f.Close(); err != nil {
		cleanup()
		return nil, fmt.Errorf("close ssh key file: %w", err)
	}
	s.keyPath = path
	return cleanup, nil
}

// basicAuthEnv builds the GIT_CONFIG_* entries that attach an
// `Authorization: Basic` header to requests for url, so the credential
// never appears in argv or on disk (spec §4.1).
func basicAuthEnv(url, user, token string) []string {
	basic := base64.StdEncoding.EncodeToString([]byte(user + ":" + token))
	return []string{
		"GIT_CONFIG_COUNT=1",
		"GIT_CONFIG_KEY_0=http." + url + ".extraHeader",
		"GIT_CONFIG_VALUE_0=Authorization: Basic " + basic,
	}
}
