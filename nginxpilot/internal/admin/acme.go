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

	"github.com/kalevski/toolcase/nginxpilot/internal/certs"
	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/credstore"
	"github.com/kalevski/toolcase/nginxpilot/internal/manager"
)

// issueRequest is the POST /certs body. Email and Provider are optional per-call
// overrides (empty → the daemon's acme.email / acme.dns.provider config defaults).
type issueRequest struct {
	Domains  []string `json:"domains"`
	CertName string   `json:"cert_name"`
	Email    string   `json:"email"`
	Provider string   `json:"provider"`
	Staging  bool     `json:"staging"`
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
	if req.Provider != "" && !credstore.ValidProvider(req.Provider) {
		http.Error(w, "invalid provider (must match [a-z0-9-]+)", http.StatusBadRequest)
		return
	}

	challenge := s.mgr.Config().Acme.ChallengeOrDefault()
	domains := make([]string, 0, len(req.Domains))
	for _, d := range req.Domains {
		nd, err := normalizeCertDomain(d)
		if err != nil {
			http.Error(w, fmt.Sprintf("invalid domain %q: %v", d, err), http.StatusBadRequest)
			return
		}
		if strings.HasPrefix(nd, "*.") && challenge != config.ChallengeDNS {
			http.Error(w, fmt.Sprintf("wildcard domain %q requires acme.challenge: dns (current: %s)", d, challenge), http.StatusBadRequest)
			return
		}
		domains = append(domains, nd)
	}

	name := req.CertName
	if name == "" {
		name = manager.CertName(domains)
	}

	// Async: certbot (DNS-01 especially) can take minutes, so we don't block the
	// request on it. Register a job, run the issuance in a detached goroutine, and
	// return 202 + the job id immediately; the caller polls GET /certs/jobs/{id}.
	job := s.jobs.create(name, domains, req.Staging)
	email, provider, staging := req.Email, req.Provider, req.Staging
	go func() {
		s.jobs.update(job.ID, func(j *certJob) { j.State = jobRunning })
		// Detached from the request context (the HTTP response has already
		// returned, which would cancel r.Context()); bounded by the same per-issue
		// timeout the synchronous path used.
		ctx, cancel := context.WithTimeout(context.Background(), s.issueTimeout())
		defer cancel()
		if err := s.mgr.IssueCert(ctx, name, domains, email, provider, staging); err != nil {
			s.log.Warn("cert issue failed", "cert_name", name, "job", job.ID, "error", err)
			s.jobs.update(job.ID, func(j *certJob) {
				j.State = jobFailed
				j.Error = err.Error()
			})
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

// handleSetCreds stores provider credentials (PUT /acme/credentials/{provider}).
func (s *Server) handleSetCreds(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	if !credstore.ValidProvider(provider) {
		http.Error(w, "invalid provider (must match [a-z0-9-]+)", http.StatusBadRequest)
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

	existed := s.credsExist(provider)
	if err := s.mgr.SetAcmeCredentials(provider, req); err != nil {
		http.Error(w, fmt.Sprintf("store credentials failed: %v", err), http.StatusBadRequest)
		return
	}
	if !existed {
		w.WriteHeader(http.StatusCreated)
	}
	writeJSON(w, map[string]any{
		"status":    map[bool]string{true: "replaced", false: "created"}[existed],
		"provider":  provider,
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
	if err := s.mgr.DeleteAcmeCredentials(provider); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			http.Error(w, "no credentials for provider", http.StatusNotFound)
			return
		}
		http.Error(w, fmt.Sprintf("delete failed: %v", err), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("deleted\n"))
}

func (s *Server) credsExist(provider string) bool {
	for _, c := range s.mgr.ListAcmeCredentials() {
		if c.Provider == provider {
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
				Domain:    c.Domain,
				Names:     names,
				CertPath:  c.CertPath,
				KeyPath:   c.KeyPath,
				ModTime:   c.ModTime,
				NotBefore: nonZeroTime(c.NotBefore),
				NotAfter:  nonZeroTime(c.NotAfter),
				Issuer:    c.Issuer,
			}
		}
	}
	return nil
}

// issueTimeout bounds a certbot run: DNS-01 waits for propagation, so allow that
// plus a buffer; the HTTP challenges are quicker.
func (s *Server) issueTimeout() time.Duration {
	a := s.mgr.Config().Acme
	if a.ChallengeOrDefault() == config.ChallengeDNS {
		return time.Duration(a.DNS.PropagationSecondsOrDefault())*time.Second + 120*time.Second
	}
	return 120 * time.Second
}

// normalizeCertDomain normalizes a domain, allowing a single leading "*."
// wildcard (which config.NormalizeDomain rejects).
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
