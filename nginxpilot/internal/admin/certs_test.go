package admin

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// GET /certs lists the certificates discovered in the configured cert dir, with
// the leaf's SANs / validity / issuer parsed out. Read-only — only the key
// *path* is exposed, never key material.
func TestListCertsEndpoint(t *testing.T) {
	env := newSitesEnv(t, "")
	dir := t.TempDir()
	notAfter := time.Now().Add(90 * 24 * time.Hour)
	writeFlatCert(t, dir, "webapp.mk", []string{"webapp.mk", "*.webapp.mk"}, notAfter)
	env.cfg.Tls = config.Tls{CertDir: dir}

	rec := do(env, http.MethodGet, "/certs", "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /certs: want 200, got %d", rec.Code)
	}
	var out struct {
		CertDir string `json:"cert_dir"`
		Certs   []struct {
			Domain   string    `json:"domain"`
			Names    []string  `json:"names"`
			CertPath string    `json:"cert_path"`
			KeyPath  string    `json:"key_path"`
			NotAfter time.Time `json:"not_after"`
			Issuer   string    `json:"issuer"`
		} `json:"certs"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode /certs: %v", err)
	}
	if out.CertDir != dir {
		t.Errorf("cert_dir: want %q, got %q", dir, out.CertDir)
	}
	if len(out.Certs) != 1 {
		t.Fatalf("want 1 cert, got %d: %s", len(out.Certs), rec.Body.String())
	}
	c := out.Certs[0]
	if c.Domain != "webapp.mk" {
		t.Errorf("domain: want webapp.mk, got %q", c.Domain)
	}
	if len(c.Names) != 2 || c.Names[0] != "webapp.mk" || c.Names[1] != "*.webapp.mk" {
		t.Errorf("names: want [webapp.mk *.webapp.mk], got %v", c.Names)
	}
	if !c.NotAfter.Truncate(time.Second).Equal(notAfter.Truncate(time.Second)) {
		t.Errorf("not_after: want ~%v, got %v", notAfter, c.NotAfter)
	}
	if c.Issuer == "" {
		t.Errorf("issuer: want non-empty (self-signed leaf CN)")
	}
	if c.CertPath == "" || c.KeyPath == "" {
		t.Errorf("cert_path/key_path must be set: %+v", c)
	}
	// Only the key path is exposed — never the key bytes.
	if strings.Contains(rec.Body.String(), "PRIVATE KEY") {
		t.Errorf("private key material leaked into /certs payload: %s", rec.Body.String())
	}
}

// No cert dir configured → an empty JSON array, never null, so clients iterate
// without a nil guard (mirrors the other list endpoints).
func TestListCertsEmptyIsArray(t *testing.T) {
	env := newSitesEnv(t, "")
	rec := do(env, http.MethodGet, "/certs", "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /certs: want 200, got %d", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "null") {
		t.Errorf("GET /certs emitted null, want []: %s", rec.Body.String())
	}
}

// writeFlatCert generates a self-signed cert/key pair in the flat layout
// (<domain>.crt + <domain>.key) under dir. The resulting leaf's Issuer CN equals
// its Subject CN (self-signed), which is all the /certs issuer field needs.
func writeFlatCert(t *testing.T, dir, domain string, sans []string, notAfter time.Time) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("gen key: %v", err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: domain},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     notAfter,
		DNSNames:     sans,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("create cert: %v", err)
	}
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyDER, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		t.Fatalf("marshal key: %v", err)
	}
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})
	if err := os.WriteFile(filepath.Join(dir, domain+".crt"), certPEM, 0o644); err != nil {
		t.Fatalf("write crt: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, domain+".key"), keyPEM, 0o600); err != nil {
		t.Fatalf("write key: %v", err)
	}
}
