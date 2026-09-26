package admin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/acme"
	"github.com/kalevski/toolcase/nginxpilot/internal/certs"
	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/credstore"
	"github.com/kalevski/toolcase/nginxpilot/internal/manager"
)

// issueRequest is the POST /certs body. Email, Provider and Challenge are
// optional per-call overrides (empty → the daemon's acme.email /
// acme.dns.provider / acme.challenge defaults). Challenge must be one of
// acme.challenges.
type issueRequest struct {
	Domains   []string `json:"domains"`
	CertName  string   `json:"cert_name"`
	Email     string   `json:"email"`
	Provider  string   `json:"provider"`
	Account   string   `json:"account"`
	Challenge string   `json:"challenge"`
	Staging   bool     `json:"staging"`
	DryRun    bool     `json:"dry_run"`
}

// uploadRequest is the PUT /certs/{domain} body (manual bring-your-own cert).
type uploadRequest struct {
	Cert string `json:"cert"`
	Key  string `json:"key"`
}

// handleIssueCert issues a certificate via certbot (POST /certs).
func (s *Server) handleIssueCert(w http.ResponseWriter, r *http.Request) {
	if !s.mgr.AcmeEnabled() {
		http.Error(w, "acme is not enabled (acme.enabled: false)", http.StatusNotImplemented)
		return
	}
	body, ok := readFragmentBody(w, r)
	if !ok {
		return
	}
	var req issueRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, fmt.Sprintf("invalid JSON: %v", err), http.StatusBadRequest)
		return
	}
	if len(req.Domains) == 0 {
		http.Error(w, "at least one domain is required", http.StatusBadRequest)
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	req.Provider = strings.TrimSpace(req.Provider)
	challenge, err := acme.EffectiveChallenge(s.mgr.Config().Acme, strings.TrimSpace(req.Challenge))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if (req.Provider != "" || req.Account != "") && challenge != config.ChallengeDNS {
		http.Error(w, fmt.Sprintf("provider and account apply only to challenge dns (this request uses %s)", challenge), http.StatusBadRequest)
		return
	}
	if req.Provider != "" && !credstore.ValidProvider(req.Provider) {
		http.Error(w, "invalid provider (must match [a-z0-9-]+)", http.StatusBadRequest)
		return
	}
	req.Account = credstore.NormalizeAccount(req.Account)
	if !credstore.ValidAccount(req.Account) {
		http.Error(w, "invalid account (must match [a-z0-9-]+)", http.StatusBadRequest)
		return
	}
	if req.Provider != "" && !s.mgr.HasAcmeCredentials(req.Provider, req.Account) {
		http.Error(w, fmt.Sprintf("no stored credentials for provider %q account %q", req.Provider, req.Account), http.StatusBadRequest)
		return
	}

	domains := make([]string, 0, len(req.Domains))
	for _, d := range req.Domains {
		nd, err := normalizeCertDomain(d)
		if err != nil {
			http.Error(w, fmt.Sprintf("invalid domain %q: %v", d, err), http.StatusBadRequest)
			return
		}
		if strings.HasPrefix(nd, "*.") && challenge != config.ChallengeDNS {
			http.Error(w, fmt.Sprintf("wildcard domain %q requires challenge dns (this request uses %s)", d, challenge), http.StatusBadRequest)
			return
		}
		domains = append(domains, nd)
	}

	name := manager.CertName(domains)
	if req.CertName != "" {
		n, err := normalizeCertName(req.CertName)
		if err != nil {
			http.Error(w, fmt.Sprintf("invalid cert_name %q: %v", req.CertName, err), http.StatusBadRequest)
			return
		}
		name = n
	}

	// Async: certbot (DNS-01 especially) can take minutes, so we don't block the
	// request on it. Register a job, run the issuance in a detached goroutine, and
	// return 202 + the job id immediately; the caller polls GET /certs/jobs/{id}.
	job := s.jobs.create(name, domains, challenge, req.Staging, req.DryRun)
	opts := acme.IssueOptions{
		Email: req.Email, Provider: req.Provider, Account: req.Account,
		Challenge: challenge, Staging: req.Staging, DryRun: req.DryRun,
	}
	go func() {
		s.jobs.update(job.ID, func(j *certJob) { j.State = jobRunning })
		// Detached from the request context (the HTTP response has already
		// returned, which would cancel r.Context()); bounded by the same per-issue
		// timeout the synchronous path used.
		ctx, cancel := context.WithTimeout(context.Background(), s.mgr.IssueTimeout(challenge, opts.Provider))
		defer cancel()
		if err := s.mgr.IssueCert(ctx, name, domains, opts); err != nil {
			s.log.Warn("cert issue failed", "cert_name", name, "job", job.ID, "error", err)
			s.jobs.update(job.ID, func(j *certJob) {
				j.State = jobFailed
				j.Error = err.Error()
			})
			return
		}
		if opts.DryRun {
			s.log.Info("cert dry run passed", "cert_name", name, "job", job.ID)
			s.jobs.update(job.ID, func(j *certJob) { j.State = jobSucceeded })
			return
		}
		s.log.Info("cert issued", "cert_name", name, "job", job.ID)
		s.jobs.update(job.ID, func(j *certJob) {
			j.State = jobSucceeded
			j.Cert = s.certInfoFor(name)
		})
	}()

	w.WriteHeader(http.StatusAccepted)
	writeJSON(w, map[string]any{
		"status":    "accepted",
		"job_id":    job.ID,
		"state":     job.State,
		"cert_name": name,
		"domains":   domains,
		"challenge": challenge,
		"dry_run":   req.DryRun,
	}, s)
}

// handleCertJob returns the status of one async issuance job (GET /certs/jobs/{id}).
func (s *Server) handleCertJob(w http.ResponseWriter, r *http.Request) {
	job := s.jobs.get(r.PathValue("id"))
	if job == nil {
		http.Error(w, "no such job", http.StatusNotFound)
		return
	}
	writeJSON(w, job, s)
}

// handleListCertJobs lists the tracked async issuance jobs, newest first
// (GET /certs/jobs). Ephemeral + best-effort — finished jobs are pruned after a TTL.
func (s *Server) handleListCertJobs(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, map[string]any{"jobs": s.jobs.list()}, s)
}

// handleUploadCert stores a manually supplied cert/key (PUT /certs/{domain}).
func (s *Server) handleUploadCert(w http.ResponseWriter, r *http.Request) {
	domain, err := config.NormalizeDomain(r.PathValue("domain"))
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid domain: %v", err), http.StatusBadRequest)
		return
	}
	body, ok := readFragmentBody(w, r)
	if !ok {
		return
	}
	var req uploadRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, fmt.Sprintf("invalid JSON: %v", err), http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Cert) == "" || strings.TrimSpace(req.Key) == "" {
		http.Error(w, "both cert and key (PEM) are required", http.StatusBadRequest)
		return
	}

	existed, err := s.mgr.AddManualCert(r.Context(), domain, []byte(req.Cert), []byte(req.Key))
	if err != nil {
		if errors.Is(err, manager.ErrNoCertDir) {
			http.Error(w, "no cert directory configured (tls.cert_dir)", http.StatusNotImplemented)
			return
		}
		http.Error(w, fmt.Sprintf("upload rejected: %v", err), http.StatusBadRequest)
		return
	}

	if !existed {
		w.WriteHeader(http.StatusCreated)
	}
	writeJSON(w, map[string]any{
		"status": map[bool]string{true: "replaced", false: "created"}[existed],
		"domain": domain,
		"cert":   s.certInfoFor(domain),
	}, s)
}

// handleRenewDue renews every cert near expiry (POST /certs/renew).
func (s *Server) handleRenewDue(w http.ResponseWriter, r *http.Request) {
	if !s.mgr.AcmeEnabled() {
		http.Error(w, "acme is not enabled", http.StatusNotImplemented)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), s.issueTimeout())
	defer cancel()
	out, err := s.mgr.RenewDue(ctx)
	if err != nil {
		http.Error(w, fmt.Sprintf("renew failed: %v", err), http.StatusBadGateway)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte(out))
}

// handleRenewCert force-renews one cert (POST /certs/{domain}/renew).
func (s *Server) handleRenewCert(w http.ResponseWriter, r *http.Request) {
	if !s.mgr.AcmeEnabled() {
		http.Error(w, "acme is not enabled", http.StatusNotImplemented)
		return
	}
	name, err := normalizeCertDomain(r.PathValue("domain"))
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid domain: %v", err), http.StatusBadRequest)
		return
	}
	name = strings.TrimPrefix(name, "*.")
	ctx, cancel := context.WithTimeout(r.Context(), s.issueTimeout())
	defer cancel()
	if err := s.mgr.RenewCert(ctx, name); err != nil {
		http.Error(w, fmt.Sprintf("renew failed: %v", err), http.StatusBadGateway)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("renewed\n"))
}

// revokeRequest is the optional POST /certs/{domain}/revoke body. Reason is one
// of acme.RevokeReasons (empty → unspecified); Delete also removes the lineage.
type revokeRequest struct {
	Reason string `json:"reason"`
	Delete bool   `json:"delete"`
}

// handleRevokeCert revokes a certbot-issued cert at its CA
// (POST /certs/{domain}/revoke). Synchronous like renew — no challenge runs, so
// it returns within seconds. Without "delete" the lineage stays on disk and
// keeps being served (revoked); the usual order is to install the replacement
// first, then revoke the old one with reason "superseded" and delete it.
func (s *Server) handleRevokeCert(w http.ResponseWriter, r *http.Request) {
	if !s.mgr.AcmeEnabled() {
		http.Error(w, "acme is not enabled", http.StatusNotImplemented)
		return
	}
	name, err := normalizeCertDomain(r.PathValue("domain"))
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid domain: %v", err), http.StatusBadRequest)
		return
	}
	name = strings.TrimPrefix(name, "*.")
	var req revokeRequest
	if r.ContentLength != 0 {
		body, ok := readFragmentBody(w, r)
		if !ok {
			return
		}
		if len(strings.TrimSpace(string(body))) > 0 {
			if err := json.Unmarshal(body, &req); err != nil {
				http.Error(w, fmt.Sprintf("invalid JSON: %v", err), http.StatusBadRequest)
				return
			}
		}
	}
	req.Reason = strings.ToLower(strings.TrimSpace(req.Reason))
	if req.Reason == "" {
		req.Reason = "unspecified"
	}
	if !acme.ValidRevokeReason(req.Reason) {
		http.Error(w, fmt.Sprintf("invalid reason %q (one of %s)", req.Reason, strings.Join(acme.RevokeReasons, ", ")), http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), s.issueTimeout())
	defer cancel()
	if err := s.mgr.RevokeCert(ctx, name, req.Reason, req.Delete); err != nil {
		switch {
		case errors.Is(err, os.ErrNotExist):
			http.Error(w, "no such cert", http.StatusNotFound)
		case errors.Is(err, manager.ErrManualCert):
			http.Error(w, err.Error(), http.StatusConflict)
		default:
			http.Error(w, fmt.Sprintf("revoke failed: %v", err), http.StatusBadGateway)
		}
		return
	}
	s.log.Info("cert revoked", "cert_name", name, "reason", req.Reason, "deleted", req.Delete)
	writeJSON(w, map[string]any{"status": "revoked", "domain": name, "reason": req.Reason, "deleted": req.Delete}, s)
}

// handleDeleteCert deletes a certbot-managed or manually uploaded cert
// (DELETE /certs/{domain}).
func (s *Server) handleDeleteCert(w http.ResponseWriter, r *http.Request) {
	domain, err := config.NormalizeDomain(r.PathValue("domain"))
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid domain: %v", err), http.StatusBadRequest)
		return
	}
	if err := s.mgr.DeleteCert(r.Context(), domain); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			http.Error(w, "no such cert", http.StatusNotFound)
			return
		}
		http.Error(w, fmt.Sprintf("delete failed: %v", err), http.StatusBadGateway)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("deleted\n"))
}

// handleSetCreds stores one provider account's credentials
// (PUT /acme/credentials/{provider} for the default account, or
// PUT /acme/credentials/{provider}/{account} for a named one — several accounts
// may exist for the same provider, so a control plane can give each of its own
// users a separate credential).
func (s *Server) handleSetCreds(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	if !credstore.ValidProvider(provider) {
		http.Error(w, "invalid provider (must match [a-z0-9-]+)", http.StatusBadRequest)
		return
	}
	account := credstore.NormalizeAccount(r.PathValue("account"))
	if !credstore.ValidAccount(account) {
		http.Error(w, "invalid account (must match [a-z0-9-]+)", http.StatusBadRequest)
		return
	}
	body, ok := readFragmentBody(w, r)
	if !ok {
		return
	}
	var req credstore.Request
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, fmt.Sprintf("invalid JSON: %v", err), http.StatusBadRequest)
		return
	}

	existed := s.credsExist(provider, account)
	if err := s.mgr.SetAcmeCredentials(provider, account, req); err != nil {
		http.Error(w, fmt.Sprintf("store credentials failed: %v", err), http.StatusBadRequest)
		return
	}
	if !existed {
		w.WriteHeader(http.StatusCreated)
	}
	writeJSON(w, map[string]any{
		"status":    map[bool]string{true: "replaced", false: "created"}[existed],
		"provider":  provider,
		"account":   account,
		"mechanism": credstore.Mechanism(provider),
	}, s)
}

// handleListCreds lists stored providers — names + metadata only, no secrets
// (GET /acme/credentials).
func (s *Server) handleListCreds(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, map[string]any{"credentials": s.mgr.ListAcmeCredentials()}, s)
}

// handleDeleteCreds removes a provider's credentials (DELETE /acme/credentials/{provider}).
func (s *Server) handleDeleteCreds(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	if !credstore.ValidProvider(provider) {
		http.Error(w, "invalid provider", http.StatusBadRequest)
		return
	}
	account := credstore.NormalizeAccount(r.PathValue("account"))
	if !credstore.ValidAccount(account) {
		http.Error(w, "invalid account", http.StatusBadRequest)
		return
	}
	if err := s.mgr.DeleteAcmeCredentials(provider, account); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			http.Error(w, "no credentials for that provider account", http.StatusNotFound)
			return
		}
		http.Error(w, fmt.Sprintf("delete failed: %v", err), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("deleted\n"))
}

func (s *Server) credsExist(provider, account string) bool {
	for _, c := range s.mgr.ListAcmeCredentials() {
		if c.Provider == provider && c.Account == account {
			return true
		}
	}
	return false
}

// certInfoFor reloads the cert index and returns the entry for key (cert-name /
// domain), or nil when not yet present. Best-effort — issuance already succeeded.
func (s *Server) certInfoFor(key string) *certInfo {
	idx, err := certs.Load(s.mgr.CertDir())
	if err != nil {
		return nil
	}
	for _, c := range idx.List() {
		if c.Domain == key {
			names := c.Names
			if names == nil {
				names = []string{}
			}
			return &certInfo{
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
			}
		}
	}
	return nil
}

// issueTimeout bounds a certbot run — delegated to the manager so the admin
// handlers and the renewal scheduler share one propagation-aware formula.
func (s *Server) issueTimeout() time.Duration {
	return s.mgr.RenewTimeout()
}

// normalizeCertDomain normalizes a domain, allowing a single leading "*."
// wildcard (which config.NormalizeDomain rejects).
// normalizeCertName validates a caller-chosen cert_name and returns the form
// certbot is given. The name becomes a certbot argv value (--cert-name), the
// lineage directory live/<name>/ and the {domain} segment of every later route
// (/certs/{domain}/renew, DELETE /certs/{domain}, /certs/bundle/{domain}), so it
// must be exactly what those routes normalize to: a domain-shaped name (letters,
// digits, hyphens; dots between labels; no wildcard), IDNA-normalized. A single
// label such as "wmk-3f9a12-g1" is fine. Anything that could read as a flag,
// escape the lineage directory or never be addressable again is refused.
func normalizeCertName(name string) (string, error) {
	if len(name) > 253 {
		return "", fmt.Errorf("longer than 253 characters")
	}
	if strings.HasPrefix(name, "-") || strings.HasPrefix(name, ".") || strings.HasSuffix(name, ".") || strings.Contains(name, "..") {
		return "", fmt.Errorf("must not start with '-' or '.', end with '.', or contain '..'")
	}
	n, err := config.NormalizeDomain(name)
	if err != nil {
		return "", err
	}
	for _, r := range n {
		if !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '-' || r == '.') {
			return "", fmt.Errorf("only letters, digits, '-' and '.' are allowed")
		}
	}
	return n, nil
}

func normalizeCertDomain(d string) (string, error) {
	if base, isWild := strings.CutPrefix(d, "*."); isWild {
		nd, err := config.NormalizeDomain(base)
		if err != nil {
			return "", err
		}
		return "*." + nd, nil
	}
	return config.NormalizeDomain(d)
}
