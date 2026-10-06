package admin

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/certs"
)

// certInfo is one discovered cert/key pair as GET /certs serializes it. Paths
// and parsed leaf metadata only — no key material is ever read or returned (the
// privkey *path* is exposed, never its contents). The parsed fields mirror
// certs.Entry and are best-effort: not_before/not_after/issuer are omitted when
// the leaf cert could not be parsed (names is then empty too). names always
// serializes as an array, never null.
type certInfo struct {
	Domain    string     `json:"domain"`
	Names     []string   `json:"names"`
	CertPath  string     `json:"cert_path"`
	KeyPath   string     `json:"key_path"`
	ModTime   time.Time  `json:"mod_time"`
	NotBefore *time.Time `json:"not_before,omitempty"`
	NotAfter  *time.Time `json:"not_after,omitempty"`
	Issuer    string     `json:"issuer,omitempty"`
	// Serial (hex) and FingerprintSHA256 (hex SHA-256 of the leaf DER) identify
	// this exact issuance — both change on renewal. Omitted when unparseable.
	Serial            string `json:"serial,omitempty"`
	FingerprintSHA256 string `json:"fingerprint_sha256,omitempty"`

	// Renewal-scheduler enrichment (Feature: automatic renewal).
	// ExpiresInSeconds is computed from NotAfter at serialization time;
	// RenewManaged reports whether certbot can renew this cert (a live/ dir
	// exists) vs a manual flat cert the operator must re-upload.
	ExpiresInSeconds *int64     `json:"expires_in_seconds,omitempty"`
	RenewManaged     bool       `json:"renew_managed"`
	LastRenewTime    *time.Time `json:"last_renew_time,omitempty"`
	LastRenewError   string     `json:"last_renew_error,omitempty"`
}

// handleListCerts lists the TLS certificates discovered in the configured cert
// directory (certbot live or flat layout), so a control plane (Quaykeeper) can show
// what's available without filesystem access. Read-only and disk-fresh — it
// loads the dir on each call, so renewals show immediately. Works in both
// managed and generate-only mode; an unconfigured/missing cert dir yields an
// empty list (not an error). The list always serializes as an array, never null.
func (s *Server) handleListCerts(w http.ResponseWriter, r *http.Request) {
	dir := s.mgr.CertDir()
	idx, err := certs.Load(dir)
	if err != nil {
		s.log.Warn("cert list load failed", "dir", dir, "error", err)
		http.Error(w, "cert load failed", http.StatusInternalServerError)
		return
	}
	renewal := s.mgr.RenewalStatus()
	list := idx.List()
	out := make([]certInfo, 0, len(list))
	for _, c := range list {
		names := c.Names
		if names == nil {
			names = []string{}
		}
		info := certInfo{
			Domain:            c.Domain,
			Names:             names,
			CertPath:          c.CertPath,
			KeyPath:           c.KeyPath,
			ModTime:           c.ModTime,
			NotBefore:         nonZeroTime(c.NotBefore),
			NotAfter:          nonZeroTime(c.NotAfter),
			Issuer:            c.Issuer,
			Serial:            c.Serial,
			FingerprintSHA256: c.FingerprintSHA256,
			RenewManaged:      s.mgr.RenewManaged(c.Domain),
		}
		if !c.NotAfter.IsZero() {
			secs := int64(time.Until(c.NotAfter).Seconds())
			info.ExpiresInSeconds = &secs
		}
		if st, ok := renewal.States[c.Domain]; ok {
			info.LastRenewTime = nonZeroTime(st.LastSuccess)
			info.LastRenewError = st.LastError
		}
		out = append(out, info)
	}
	p, ok := parsePage(w, r, false)
	if !ok {
		return
	}
	page, body := paginate(out, func(x certInfo) string { return x.Domain }, p)
	body["cert_dir"] = dir
	body["certs"] = page
	writeJSON(w, r, body, s)
}

// nonZeroTime maps the zero time (an unparseable cert) to nil so the JSON field
// is omitted rather than serialized as "0001-01-01T00:00:00Z".
func nonZeroTime(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	return &t
}

// certBundle is one cert as GET /certs/bundle/{domain} serializes it: the PEM
// material itself (leaf, chain, fullchain and private key) plus the leaf's
// identity, so a control plane can keep a central copy of a cert this daemon
// issued and upload it to other nodes with PUT /certs/{domain}.
type certBundle struct {
	Domain            string    `json:"domain"`
	Names             []string  `json:"names"`
	Cert              string    `json:"cert"`
	Chain             string    `json:"chain"`
	Fullchain         string    `json:"fullchain"`
	Key               string    `json:"key"`
	NotBefore         time.Time `json:"not_before"`
	NotAfter          time.Time `json:"not_after"`
	Issuer            string    `json:"issuer"`
	Serial            string    `json:"serial"`
	FingerprintSHA256 string    `json:"fingerprint_sha256"`
	RenewManaged      bool      `json:"renew_managed"`
	ModTime           time.Time `json:"mod_time"`
}

// handleCertBundle exports one cert with its private key
// (GET /certs/bundle/{domain}) — the only route that returns key material. The
// cert is addressed by its exact index key (the certbot lineage or flat-file
// name, a leading "*." stripped the way renew strips it); SAN matching is never
// applied, so a wildcard neighbour is never exported in its place. The response
// is marked no-store and every export is logged (domain and fingerprint only).
func (s *Server) handleCertBundle(w http.ResponseWriter, r *http.Request) {
	name, err := normalizeCertDomain(r.PathValue("domain"))
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid domain: %v", err), http.StatusBadRequest)
		return
	}
	name = strings.TrimPrefix(name, "*.")
	dir := s.mgr.CertDir()
	if dir == "" {
		http.Error(w, "no cert directory configured (tls.cert_dir)", http.StatusNotImplemented)
		return
	}
	idx, err := certs.Load(dir)
	if err != nil {
		s.log.Warn("cert bundle load failed", "dir", dir, "error", err)
		http.Error(w, "cert load failed", http.StatusInternalServerError)
		return
	}
	entry, ok := idx.Get(name)
	if !ok {
		http.Error(w, "no such cert", http.StatusNotFound)
		return
	}
	bundle, err := readCertBundle(name, entry)
	if err != nil {
		s.log.Warn("cert bundle read failed", "domain", name, "error", err)
		http.Error(w, fmt.Sprintf("cert bundle unreadable: %v", err), http.StatusInternalServerError)
		return
	}
	bundle.RenewManaged = s.mgr.RenewManaged(name)
	s.log.Info("cert bundle exported", "domain", name, "fingerprint_sha256", bundle.FingerprintSHA256)
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, r, bundle, s)
}

// readCertBundle reads a cert/key pair off disk and splits the cert file into
// leaf and chain. Both layouts keep the leaf first (certbot's fullchain.pem, and
// a flat .crt uploaded as leaf + chain), so the first CERTIFICATE block is the
// leaf and the rest is the chain. The key must parse as the leaf's own key — a
// half-written renewal (new cert, old key) is refused rather than exported.
func readCertBundle(name string, e certs.Entry) (certBundle, error) {
	certPEM, err := os.ReadFile(e.CertPath)
	if err != nil {
		return certBundle{}, fmt.Errorf("read cert: %w", err)
	}
	keyPEM, err := os.ReadFile(e.KeyPath)
	if err != nil {
		return certBundle{}, fmt.Errorf("read key: %w", err)
	}
	var blocks []*pem.Block
	for rest := certPEM; ; {
		var block *pem.Block
		block, rest = pem.Decode(rest)
		if block == nil {
			break
		}
		if block.Type == "CERTIFICATE" {
			blocks = append(blocks, block)
		}
	}
	if len(blocks) == 0 {
		return certBundle{}, fmt.Errorf("no certificate in %s", e.CertPath)
	}
	leaf, err := x509.ParseCertificate(blocks[0].Bytes)
	if err != nil {
		return certBundle{}, fmt.Errorf("parse leaf: %w", err)
	}
	if _, err := tls.X509KeyPair(certPEM, keyPEM); err != nil {
		return certBundle{}, fmt.Errorf("key does not match cert: %w", err)
	}
	var chain strings.Builder
	for _, b := range blocks[1:] {
		chain.Write(pem.EncodeToMemory(b))
	}
	names := make([]string, 0, len(leaf.DNSNames))
	for _, n := range leaf.DNSNames {
		names = append(names, strings.ToLower(n))
	}
	issuer := leaf.Issuer.CommonName
	if issuer == "" {
		issuer = leaf.Issuer.String()
	}
	leafPEM := string(pem.EncodeToMemory(blocks[0]))
	return certBundle{
		Domain:            name,
		Names:             names,
		Cert:              leafPEM,
		Chain:             chain.String(),
		Fullchain:         leafPEM + chain.String(),
		Key:               string(keyPEM),
		NotBefore:         leaf.NotBefore,
		NotAfter:          leaf.NotAfter,
		Issuer:            issuer,
		Serial:            certs.LeafSerial(leaf),
		FingerprintSHA256: certs.LeafFingerprint(leaf),
		ModTime:           e.ModTime,
	}, nil
}
