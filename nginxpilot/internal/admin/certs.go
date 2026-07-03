package admin

import (
	"net/http"
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
// directory (certbot live or flat layout), so a control plane (Perch) can show
// what's available without filesystem access. Read-only and disk-fresh — it
// loads the dir on each call, so renewals show immediately. Works in both
// managed and generate-only mode; an unconfigured/missing cert dir yields an
// empty list (not an error). The list always serializes as an array, never null.
func (s *Server) handleListCerts(w http.ResponseWriter, _ *http.Request) {
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
			Domain:       c.Domain,
			Names:        names,
			CertPath:     c.CertPath,
			KeyPath:      c.KeyPath,
			ModTime:      c.ModTime,
			NotBefore:    nonZeroTime(c.NotBefore),
			NotAfter:     nonZeroTime(c.NotAfter),
			Issuer:       c.Issuer,
			RenewManaged: s.mgr.RenewManaged(c.Domain),
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
	writeJSON(w, map[string]any{"cert_dir": dir, "certs": out}, s)
}

// nonZeroTime maps the zero time (an unparseable cert) to nil so the JSON field
// is omitted rather than serialized as "0001-01-01T00:00:00Z".
func nonZeroTime(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	return &t
}
