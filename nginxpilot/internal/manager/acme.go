package manager

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/acme"
	"github.com/kalevski/toolcase/nginxpilot/internal/credstore"
)

// ErrAcmeDisabled is returned by certbot-backed operations when acme.enabled is
// false. ErrNoCertDir is returned by manual upload when no tls.cert_dir exists.
var (
	ErrAcmeDisabled = errors.New("acme is not enabled (acme.enabled: false)")
	ErrNoCertDir    = errors.New("no cert directory configured (tls.cert_dir)")
)

// AcmeEnabled reports whether certbot issuance is configured. Guarded by acmeMu
// because Reload may swap m.acme (enable/disable) concurrently.
func (m *Manager) AcmeEnabled() bool {
	m.acmeMu.Lock()
	defer m.acmeMu.Unlock()
	return m.acme != nil
}

// IssueCert issues one certificate (>=1 domains; wildcard only with dns), then
// re-applies managed nginx so the new cert is served immediately. email and
// provider are per-call overrides (empty → the daemon's acme.email /
// acme.dns.provider config defaults).
func (m *Manager) IssueCert(ctx context.Context, name string, domains []string, email, provider string, staging bool) error {
	m.acmeMu.Lock()
	defer m.acmeMu.Unlock()
	if m.acme == nil {
		return ErrAcmeDisabled
	}
	opts := acme.IssueOptions{Email: email, Provider: provider, Staging: staging}
	if _, err := m.acme.Issue(ctx, name, domains, opts); err != nil {
		return err
	}
	m.applyManaged(ctx)
	return nil
}

// RenewCert force-renews one cert by name, then re-applies managed nginx.
func (m *Manager) RenewCert(ctx context.Context, name string) error {
	m.acmeMu.Lock()
	defer m.acmeMu.Unlock()
	if m.acme == nil {
		return ErrAcmeDisabled
	}
	if _, err := m.acme.Renew(ctx, name); err != nil {
		return err
	}
	m.applyManaged(ctx)
	return nil
}

// RenewDue renews every cert near expiry and returns certbot's summary text.
func (m *Manager) RenewDue(ctx context.Context) (string, error) {
	m.acmeMu.Lock()
	defer m.acmeMu.Unlock()
	if m.acme == nil {
		return "", ErrAcmeDisabled
	}
	out, err := m.acme.RenewDue(ctx)
	if err != nil {
		return out, err
	}
	m.applyManaged(ctx)
	return out, nil
}

// DeleteCert removes a cert from whichever source owns it: a certbot-managed
// name (config_dir/live/<domain>/) → certbot delete; else a flat manual pair
// (<cert_dir>/<domain>.crt|.key) → remove the files. os.ErrNotExist when
// neither exists. Then re-applies managed nginx.
func (m *Manager) DeleteCert(ctx context.Context, domain string) error {
	m.acmeMu.Lock()
	defer m.acmeMu.Unlock()

	cfg := m.Config()
	if m.acme != nil {
		liveDir := filepath.Join(cfg.Acme.ConfigDirOrDefault(), "live", domain)
		if isDir(liveDir) {
			if _, err := m.acme.Delete(ctx, domain); err != nil {
				return err
			}
			m.applyManaged(ctx)
			return nil
		}
	}

	dir := m.CertDir()
	if dir != "" {
		crt := filepath.Join(dir, domain+".crt")
		key := filepath.Join(dir, domain+".key")
		if isFile(crt) || isFile(key) {
			_ = os.Remove(crt)
			_ = os.Remove(key)
			m.applyManaged(ctx)
			return nil
		}
	}
	return os.ErrNotExist
}

// AddManualCert validates a bring-your-own cert/key pair and writes the flat
// layout (<domain>.crt 0640 + <domain>.key 0600) into the cert dir, then
// re-applies managed nginx. Needs no certbot — works even with acme disabled.
func (m *Manager) AddManualCert(ctx context.Context, domain string, certPEM, keyPEM []byte) (existed bool, err error) {
	m.acmeMu.Lock()
	defer m.acmeMu.Unlock()

	dir := m.CertDir()
	if dir == "" {
		return false, ErrNoCertDir
	}
	if _, err := tls.X509KeyPair(certPEM, keyPEM); err != nil {
		return false, fmt.Errorf("cert/key pair invalid: %w", err)
	}
	if leaf := parseLeaf(certPEM); leaf != nil && time.Now().After(leaf.NotAfter) {
		return false, fmt.Errorf("certificate expired on %s", leaf.NotAfter.Format(time.RFC3339))
	}

	crt := filepath.Join(dir, domain+".crt")
	key := filepath.Join(dir, domain+".key")
	existed = isFile(crt) || isFile(key)

	if err := os.MkdirAll(dir, 0o750); err != nil {
		return existed, fmt.Errorf("create cert dir: %w", err)
	}
	if err := writeFileAtomic(crt, certPEM, 0o640); err != nil {
		return existed, fmt.Errorf("write cert: %w", err)
	}
	if err := writeFileAtomic(key, keyPEM, 0o600); err != nil {
		return existed, fmt.Errorf("write key: %w", err)
	}
	m.log.Info("manual cert written", "domain", domain, "dir", dir)
	m.applyManaged(ctx)
	return existed, nil
}

// SetAcmeCredentials stores a provider's credential (built from the request).
// No certbot run — it takes effect on the next issue/renew.
func (m *Manager) SetAcmeCredentials(provider string, req credstore.Request) error {
	if m.creds == nil {
		return ErrNoCertDir
	}
	body, err := credstore.Build(provider, req)
	if err != nil {
		return err
	}
	if err := m.creds.Set(provider, body); err != nil {
		return err
	}
	m.log.Info("acme provider credentials stored", "provider", provider)
	return nil
}

// ListAcmeCredentials lists stored providers (metadata only, never secrets).
func (m *Manager) ListAcmeCredentials() []credstore.Info {
	if m.creds == nil {
		return []credstore.Info{}
	}
	return m.creds.List()
}

// DeleteAcmeCredentials removes a provider's stored credential.
func (m *Manager) DeleteAcmeCredentials(provider string) error {
	if m.creds == nil {
		return os.ErrNotExist
	}
	return m.creds.Delete(provider)
}

// CertName is re-exported so the admin layer derives the cert-name consistently.
func CertName(domains []string) string { return acme.CertName(domains) }

func isDir(p string) bool  { fi, err := os.Stat(p); return err == nil && fi.IsDir() }
func isFile(p string) bool { fi, err := os.Stat(p); return err == nil && fi.Mode().IsRegular() }

// parseLeaf parses the first CERTIFICATE block from a PEM bundle (best-effort).
func parseLeaf(certPEM []byte) *x509.Certificate {
	data := certPEM
	for len(data) > 0 {
		var block *pem.Block
		block, data = pem.Decode(data)
		if block == nil {
			return nil
		}
		if block.Type != "CERTIFICATE" {
			continue
		}
		c, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil
		}
		return c
	}
	return nil
}

// writeFileAtomic writes data with the given perm crash-durably (temp+fsync+
// rename+dir-fsync), matching the discipline used elsewhere in the daemon.
func writeFileAtomic(path string, data []byte, perm os.FileMode) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".cert-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Chmod(perm); err != nil {
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
