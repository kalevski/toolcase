package certs

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func writeFile(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
}

// writeCert writes a real self-signed leaf cert (with the given SAN DNS names)
// to certPath and a placeholder key to keyPath, so SAN-based matching can be
// exercised. The key content is irrelevant — the index never parses it.
func writeCert(t *testing.T, certPath, keyPath string, dnsNames ...string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(certPath), 0o755); err != nil {
		t.Fatal(err)
	}
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: dnsNames[0]},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		DNSNames:     dnsNames,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &priv.PublicKey, priv)
	if err != nil {
		t.Fatal(err)
	}
	pemBytes := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	if err := os.WriteFile(certPath, pemBytes, 0o600); err != nil {
		t.Fatal(err)
	}
	writeFile(t, keyPath)
}

func TestLoadBothLayouts(t *testing.T) {
	dir := t.TempDir()
	// certbot live layout
	writeFile(t, filepath.Join(dir, "a.example.com", "fullchain.pem"))
	writeFile(t, filepath.Join(dir, "a.example.com", "privkey.pem"))
	// flat layout
	writeFile(t, filepath.Join(dir, "b.example.com.crt"))
	writeFile(t, filepath.Join(dir, "b.example.com.key"))
	// incomplete pair (cert without key) → ignored
	writeFile(t, filepath.Join(dir, "c.example.com.crt"))

	idx, err := Load(dir)
	if err != nil {
		t.Fatalf("load: %v", err)
	}

	if cert, key, ok := idx.For("a.example.com"); !ok ||
		cert != filepath.Join(dir, "a.example.com", "fullchain.pem") ||
		key != filepath.Join(dir, "a.example.com", "privkey.pem") {
		t.Errorf("certbot layout not resolved: %q %q %v", cert, key, ok)
	}
	if cert, key, ok := idx.For("b.example.com"); !ok ||
		cert != filepath.Join(dir, "b.example.com.crt") ||
		key != filepath.Join(dir, "b.example.com.key") {
		t.Errorf("flat layout not resolved: %q %q %v", cert, key, ok)
	}
	if _, _, ok := idx.For("c.example.com"); ok {
		t.Error("incomplete pair must not resolve")
	}
	if _, _, ok := idx.For("missing.example.com"); ok {
		t.Error("missing domain must not resolve")
	}
}

func TestWildcardAndSANMatch(t *testing.T) {
	dir := t.TempDir()
	// Wildcard cert in the certbot live layout, keyed by lineage name webapp.mk.
	writeCert(t,
		filepath.Join(dir, "webapp.mk", "fullchain.pem"),
		filepath.Join(dir, "webapp.mk", "privkey.pem"),
		"webapp.mk", "*.webapp.mk")
	// Multi-SAN flat cert that lists an explicit host not equal to its file name.
	writeCert(t,
		filepath.Join(dir, "bundle.crt"),
		filepath.Join(dir, "bundle.key"),
		"alpha.example.com", "beta.example.com")

	idx, err := Load(dir)
	if err != nil {
		t.Fatalf("load: %v", err)
	}

	wildCert := filepath.Join(dir, "webapp.mk", "fullchain.pem")
	// Wildcard covers a one-label subdomain.
	if cert, _, ok := idx.For("test.webapp.mk"); !ok || cert != wildCert {
		t.Errorf("wildcard should cover test.webapp.mk: %q %v", cert, ok)
	}
	// Apex still resolves (exact dir-name key + explicit SAN).
	if cert, _, ok := idx.For("webapp.mk"); !ok || cert != wildCert {
		t.Errorf("apex webapp.mk should resolve: %q %v", cert, ok)
	}
	// Wildcard does NOT cover the apex-as-wildcard nor multi-label hosts.
	if _, _, ok := idx.For("a.b.webapp.mk"); ok {
		t.Error("wildcard must not cover multi-label a.b.webapp.mk")
	}
	// Case-insensitive subdomain match.
	if _, _, ok := idx.For("UP.webapp.mk"); !ok {
		t.Error("wildcard match must be case-insensitive")
	}
	// Explicit SAN on a flat cert resolves even though the file is named bundle.*.
	flatCert := filepath.Join(dir, "bundle.crt")
	if cert, _, ok := idx.For("alpha.example.com"); !ok || cert != flatCert {
		t.Errorf("explicit SAN alpha.example.com should resolve: %q %v", cert, ok)
	}
	if cert, _, ok := idx.For("beta.example.com"); !ok || cert != flatCert {
		t.Errorf("explicit SAN beta.example.com should resolve: %q %v", cert, ok)
	}
	// Unrelated domain still misses.
	if _, _, ok := idx.For("nope.example.org"); ok {
		t.Error("unrelated domain must not resolve")
	}
}

func TestLoadMissingDirIsEmpty(t *testing.T) {
	idx, err := Load(filepath.Join(t.TempDir(), "does-not-exist"))
	if err != nil {
		t.Fatalf("missing dir should not error: %v", err)
	}
	if len(idx.Domains()) != 0 {
		t.Error("missing dir should yield empty index")
	}
}

func TestNilIndexSafe(t *testing.T) {
	var idx *Index
	if _, _, ok := idx.For("x"); ok {
		t.Error("nil index For should be false")
	}
	if idx.Fingerprint() != "" {
		t.Error("nil index fingerprint should be empty")
	}
}

// A renewal (same path, newer mtime) changes the fingerprint, so the watcher
// reports a change.
func TestWatcherDetectsRenewal(t *testing.T) {
	dir := t.TempDir()
	key := filepath.Join(dir, "a.example.com", "privkey.pem")
	writeFile(t, filepath.Join(dir, "a.example.com", "fullchain.pem"))
	writeFile(t, key)

	idx0, _ := Load(dir)
	w := NewWatcher(dir, time.Minute, idx0.Fingerprint(), nil)

	// No change yet.
	if changed, _, _ := w.Poll(); changed {
		t.Error("no change should be reported initially")
	}

	// Bump the key mtime (simulate renewal in place).
	future := time.Now().Add(2 * time.Hour)
	if err := os.Chtimes(key, future, future); err != nil {
		t.Fatal(err)
	}
	changed, _, err := w.Poll()
	if err != nil {
		t.Fatal(err)
	}
	if !changed {
		t.Error("renewal (mtime bump) should be detected")
	}
	// Stable afterward.
	if changed, _, _ := w.Poll(); changed {
		t.Error("no further change should be reported")
	}
}
