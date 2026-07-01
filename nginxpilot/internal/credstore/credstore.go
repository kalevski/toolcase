// Package credstore is the runtime credentials store for ACME DNS providers.
// A control plane (or a human) saves a provider's token/key over the admin API
// (PUT /acme/credentials/{provider}); nginxpilot persists it as a daemon-owned
// 0600 artifact under data_dir/acme/credentials/ and feeds it to certbot at
// issue time. This does not weaken the "no inline secrets in config" rule — the
// rule protects the committed YAML; the API still writes secrets only to 0600
// files, never into config or argv.
//
// Each provider has a mechanism describing how certbot consumes its artifact:
// most DNS plugins take a --dns-<provider>-credentials file (MechanismFlag);
// Route 53 reads an AWS shared-credentials file via AWS_SHARED_CREDENTIALS_FILE
// (MechanismAWS); Google Cloud DNS reads a service-account JSON via
// GOOGLE_APPLICATION_CREDENTIALS plus the --dns-google-credentials flag
// (MechanismGoogle).
package credstore

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

// Mechanisms — how certbot consumes a provider's stored artifact.
const (
	MechanismFlag   = "flag"     // --dns-<provider>-credentials <path>
	MechanismAWS    = "aws-file" // env AWS_SHARED_CREDENTIALS_FILE=<path>
	MechanismGoogle = "google"   // env GOOGLE_APPLICATION_CREDENTIALS=<path> + --dns-google-credentials <path>
)

// fileSuffix is the on-disk extension for a stored credential (content is
// provider-specific INI/JSON; certbot parses by content, not name).
const fileSuffix = ".cred"

// providerRe restricts a provider to the certbot DNS-plugin name charset; it
// also guards the on-disk filename against path tricks.
var providerRe = regexp.MustCompile(`^[a-z0-9-]+$`)

// ValidProvider reports whether name is an acceptable provider identifier.
func ValidProvider(name string) bool { return providerRe.MatchString(name) }

// Request is the parsed credential input. Raw is the provider-agnostic escape
// hatch (the full INI/JSON body); the typed fields are conveniences for the
// common providers.
type Request struct {
	Raw                string `json:"credentials"`
	Token              string `json:"token"`
	AccessKey          string `json:"access_key"`
	SecretKey          string `json:"secret_key"`
	ServiceAccountJSON string `json:"service_account_json"`
}

// Info is one stored provider's metadata for GET /acme/credentials. Secret
// material is never included.
type Info struct {
	Provider  string    `json:"provider"`
	Mechanism string    `json:"mechanism"`
	ModTime   time.Time `json:"mod_time"`
}

// Resolved is a stored credential located on disk, for the acme client.
type Resolved struct {
	Path      string
	Mechanism string
}

// Mechanism returns how certbot consumes a provider's credential (defaults to
// MechanismFlag for providers without a special case).
func Mechanism(provider string) string {
	switch provider {
	case "route53":
		return MechanismAWS
	case "google":
		return MechanismGoogle
	default:
		return MechanismFlag
	}
}

// Build renders the credential body for a provider from a Request. The Raw body
// always wins (provider-agnostic passthrough); otherwise a small set of known
// providers render their convenience fields into the right INI/JSON. Unknown
// providers must supply Raw.
func Build(provider string, req Request) ([]byte, error) {
	if !ValidProvider(provider) {
		return nil, fmt.Errorf("invalid provider %q (must match [a-z0-9-]+)", provider)
	}
	if s := strings.TrimSpace(req.Raw); s != "" {
		return []byte(ensureTrailingNewline(req.Raw)), nil
	}
	switch provider {
	case "digitalocean":
		if req.Token == "" {
			return nil, fmt.Errorf("digitalocean needs \"token\" (or raw \"credentials\")")
		}
		return []byte(fmt.Sprintf("dns_digitalocean_token = %s\n", req.Token)), nil
	case "cloudflare":
		if req.Token == "" {
			return nil, fmt.Errorf("cloudflare needs \"token\" (or raw \"credentials\")")
		}
		return []byte(fmt.Sprintf("dns_cloudflare_api_token = %s\n", req.Token)), nil
	case "linode":
		if req.Token == "" {
			return nil, fmt.Errorf("linode needs \"token\" (or raw \"credentials\")")
		}
		return []byte(fmt.Sprintf("dns_linode_key = %s\ndns_linode_version = 4\n", req.Token)), nil
	case "route53":
		if req.AccessKey == "" || req.SecretKey == "" {
			return nil, fmt.Errorf("route53 needs \"access_key\" and \"secret_key\" (or raw \"credentials\")")
		}
		return []byte(fmt.Sprintf("[default]\naws_access_key_id = %s\naws_secret_access_key = %s\n", req.AccessKey, req.SecretKey)), nil
	case "google":
		if strings.TrimSpace(req.ServiceAccountJSON) == "" {
			return nil, fmt.Errorf("google needs \"service_account_json\" (or raw \"credentials\")")
		}
		return []byte(req.ServiceAccountJSON), nil
	default:
		return nil, fmt.Errorf("provider %q has no convenience form; supply the full credentials body in \"credentials\"", provider)
	}
}

func ensureTrailingNewline(s string) string {
	if strings.HasSuffix(s, "\n") {
		return s
	}
	return s + "\n"
}

// Store persists per-provider credential artifacts under dir.
type Store struct {
	dir string
}

// New builds a store rooted at dir (created lazily on first Set).
func New(dir string) *Store { return &Store{dir: dir} }

func (s *Store) path(provider string) string {
	return filepath.Join(s.dir, provider+fileSuffix)
}

// Set writes (or replaces) a provider's credential atomically as a 0600,
// daemon-owned file.
func (s *Store) Set(provider string, content []byte) error {
	if !ValidProvider(provider) {
		return fmt.Errorf("invalid provider %q", provider)
	}
	if err := os.MkdirAll(s.dir, 0o700); err != nil {
		return fmt.Errorf("create credentials dir: %w", err)
	}
	return writeFileAtomic0600(s.path(provider), content)
}

// Has reports whether a credential is stored for the provider.
func (s *Store) Has(provider string) bool {
	if !ValidProvider(provider) {
		return false
	}
	fi, err := os.Stat(s.path(provider))
	return err == nil && fi.Mode().IsRegular()
}

// Get locates a stored credential for the acme client. ok=false when none.
func (s *Store) Get(provider string) (Resolved, bool) {
	if !s.Has(provider) {
		return Resolved{}, false
	}
	return Resolved{Path: s.path(provider), Mechanism: Mechanism(provider)}, true
}

// Delete removes a stored credential. Returns os.ErrNotExist when absent.
func (s *Store) Delete(provider string) error {
	if !ValidProvider(provider) {
		return fmt.Errorf("invalid provider %q", provider)
	}
	return os.Remove(s.path(provider))
}

// List enumerates stored providers (sorted) with metadata only — never the
// secret material. The nil/empty store yields an empty, non-nil slice.
func (s *Store) List() []Info {
	out := []Info{}
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return out
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), fileSuffix) {
			continue
		}
		provider := strings.TrimSuffix(e.Name(), fileSuffix)
		mt := time.Time{}
		if fi, err := e.Info(); err == nil {
			mt = fi.ModTime()
		}
		out = append(out, Info{Provider: provider, Mechanism: Mechanism(provider), ModTime: mt})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Provider < out[j].Provider })
	return out
}

// writeFileAtomic0600 writes data crash-durably with 0600 perms: temp file in
// the same dir, fsync, rename, fsync dir.
func writeFileAtomic0600(path string, data []byte) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".cred-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Chmod(0o600); err != nil {
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
