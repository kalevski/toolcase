package admin

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
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

// GET /certs/bundle/{domain} exports a flat cert with its key, leaf identity and
// a no-store header — the material a control plane re-uploads elsewhere.
func TestCertBundleFlat(t *testing.T) {
	env := newSitesEnv(t, "")
	dir := t.TempDir()
	writeFlatCert(t, dir, "webapp.mk", []string{"webapp.mk", "*.webapp.mk"}, time.Now().Add(90*24*time.Hour))
	env.cfg.Tls = config.Tls{CertDir: dir}

	rec := do(env, http.MethodGet, "/certs/bundle/webapp.mk", "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("bundle: want 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("Cache-Control"); got != "no-store" {
		t.Errorf("Cache-Control: want no-store, got %q", got)
	}
	var out certBundle
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode bundle: %v", err)
	}
	crt, _ := os.ReadFile(filepath.Join(dir, "webapp.mk.crt"))
	key, _ := os.ReadFile(filepath.Join(dir, "webapp.mk.key"))
	if out.Key != string(key) {
		t.Errorf("key: want the on-disk key")
	}
	if out.Cert != string(crt) || out.Fullchain != string(crt) || out.Chain != "" {
		t.Errorf("a lone leaf must be cert == fullchain with an empty chain: %+v", out)
	}
	block, _ := pem.Decode(crt)
	sum := sha256.Sum256(block.Bytes)
	if out.FingerprintSHA256 != hex.EncodeToString(sum[:]) {
		t.Errorf("fingerprint: want %x, got %s", sum, out.FingerprintSHA256)
	}
	if out.Serial != "1" || out.Domain != "webapp.mk" || len(out.Names) != 2 || out.RenewManaged {
		t.Errorf("identity fields wrong: %+v", out)
	}
	if _, err := tls.X509KeyPair([]byte(out.Fullchain), []byte(out.Key)); err != nil {
		t.Errorf("exported pair does not load: %v", err)
	}
}

// A certbot live lineage exports its leaf and chain separately, and a wildcard
// path segment addresses the lineage the way renew does ("*." stripped).
func TestCertBundleLiveLayoutWithChain(t *testing.T) {
	env := newSitesEnv(t, "")
	dir := t.TempDir()
	leafPEM, chainPEM, keyPEM := chainedCert(t, []string{"example.com", "*.example.com"})
	live := filepath.Join(dir, "example.com")
	if err := os.MkdirAll(live, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(live, "fullchain.pem"), append(append([]byte{}, leafPEM...), chainPEM...), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(live, "privkey.pem"), keyPEM, 0o600); err != nil {
		t.Fatal(err)
	}
	env.cfg.Tls = config.Tls{CertDir: dir}

	rec := do(env, http.MethodGet, "/certs/bundle/*.example.com", "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("bundle: want 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var out certBundle
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode bundle: %v", err)
	}
	if out.Domain != "example.com" {
		t.Errorf("domain: want example.com, got %q", out.Domain)
	}
	if out.Cert != string(leafPEM) || out.Chain != string(chainPEM) {
		t.Errorf("leaf/chain split wrong:\ncert=%q\nchain=%q", out.Cert, out.Chain)
	}
	if out.Fullchain != string(leafPEM)+string(chainPEM) {
		t.Errorf("fullchain must be leaf + chain")
	}
	if out.Issuer != "Test CA" {
		t.Errorf("issuer: want Test CA, got %q", out.Issuer)
	}
}

// Only the exact cert name is exported: a wildcard neighbour that would serve
// the host is never handed out in its place.
func TestCertBundleExactNameOnly(t *testing.T) {
	env := newSitesEnv(t, "")
	dir := t.TempDir()
	writeFlatCert(t, dir, "webapp.mk", []string{"webapp.mk", "*.webapp.mk"}, time.Now().Add(time.Hour))
	env.cfg.Tls = config.Tls{CertDir: dir}

	if rec := do(env, http.MethodGet, "/certs/bundle/shop.webapp.mk", "", ""); rec.Code != http.StatusNotFound {
		t.Fatalf("SAN-covered name: want 404, got %d", rec.Code)
	}
}

// A key that does not belong to the cert (a torn write) is refused, never exported.
func TestCertBundleMismatchedKey(t *testing.T) {
	env := newSitesEnv(t, "")
	dir := t.TempDir()
	writeFlatCert(t, dir, "a.example", []string{"a.example"}, time.Now().Add(time.Hour))
	writeFlatCert(t, dir, "b.example", []string{"b.example"}, time.Now().Add(time.Hour))
	other, _ := os.ReadFile(filepath.Join(dir, "b.example.key"))
	if err := os.WriteFile(filepath.Join(dir, "a.example.key"), other, 0o600); err != nil {
		t.Fatal(err)
	}
	env.cfg.Tls = config.Tls{CertDir: dir}

	rec := do(env, http.MethodGet, "/certs/bundle/a.example", "", "")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("mismatched key: want 500, got %d", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "PRIVATE KEY") {
		t.Errorf("key material leaked in the error: %s", rec.Body.String())
	}
}

func TestCertBundleNoCertDir(t *testing.T) {
	env := newSitesEnv(t, "")
	if rec := do(env, http.MethodGet, "/certs/bundle/webapp.mk", "", ""); rec.Code != http.StatusNotImplemented {
		t.Fatalf("no cert dir: want 501, got %d", rec.Code)
	}
}

// chainedCert issues a leaf for sans from a throwaway CA and returns the leaf,
// chain (the CA) and leaf key as PEM.
func chainedCert(t *testing.T, sans []string) (leafPEM, chainPEM, keyPEM []byte) {
	t.Helper()
	caKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	caTmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(10),
		Subject:               pkix.Name{CommonName: "Test CA"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(24 * time.Hour),
		IsCA:                  true,
		BasicConstraintsValid: true,
		KeyUsage:              x509.KeyUsageCertSign,
	}
	caDER, err := x509.CreateCertificate(rand.Reader, caTmpl, caTmpl, &caKey.PublicKey, caKey)
	if err != nil {
		t.Fatal(err)
	}
	ca, _ := x509.ParseCertificate(caDER)
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(11),
		Subject:      pkix.Name{CommonName: sans[0]},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(12 * time.Hour),
		DNSNames:     sans,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, ca, &key.PublicKey, caKey)
	if err != nil {
		t.Fatal(err)
	}
	keyDER, _ := x509.MarshalECPrivateKey(key)
	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}),
		pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER}),
		pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})
}

// GET /certs carries each cert's serial and leaf fingerprint, equal to what the
// bundle export reports, and a re-issued cert under the same name shows a new
// fingerprint — the signal a control plane uses to spot a renewal.
func TestListCertsSerialAndFingerprint(t *testing.T) {
	env := newSitesEnv(t, "")
	dir := t.TempDir()
	writeFlatCert(t, dir, "webapp.mk", []string{"webapp.mk"}, time.Now().Add(time.Hour))
	env.cfg.Tls = config.Tls{CertDir: dir}

	type listed struct {
		Certs []struct {
			Serial            string `json:"serial"`
			FingerprintSHA256 string `json:"fingerprint_sha256"`
		} `json:"certs"`
	}
	list := func() (string, string) {
		t.Helper()
		var out listed
		rec := do(env, http.MethodGet, "/certs", "", "")
		if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil || len(out.Certs) != 1 {
			t.Fatalf("GET /certs: %v %s", err, rec.Body.String())
		}
		return out.Certs[0].Serial, out.Certs[0].FingerprintSHA256
	}

	serial, fp := list()
	crt, _ := os.ReadFile(filepath.Join(dir, "webapp.mk.crt"))
	block, _ := pem.Decode(crt)
	sum := sha256.Sum256(block.Bytes)
	if serial != "1" || fp != hex.EncodeToString(sum[:]) {
		t.Fatalf("want serial 1 and fingerprint %x, got %q %q", sum, serial, fp)
	}

	var bundle certBundle
	rec := do(env, http.MethodGet, "/certs/bundle/webapp.mk", "", "")
	if err := json.Unmarshal(rec.Body.Bytes(), &bundle); err != nil {
		t.Fatalf("decode bundle: %v", err)
	}
	if bundle.FingerprintSHA256 != fp || bundle.Serial != serial {
		t.Errorf("listing and bundle disagree: %q/%q vs %q/%q", serial, fp, bundle.Serial, bundle.FingerprintSHA256)
	}

	writeFlatCert(t, dir, "webapp.mk", []string{"webapp.mk"}, time.Now().Add(2*time.Hour))
	if _, fp2 := list(); fp2 == fp {
		t.Errorf("re-issued cert kept the old fingerprint %s", fp)
	}
}
