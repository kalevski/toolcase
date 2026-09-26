package manager

import (
	"context"
	"errors"
	"path/filepath"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/certs"
	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/credstore"
)

// renewalStartupDelay is the one-shot catch-up pass shortly after startup —
// certs may have expired while the daemon was down. The small delay avoids
// racing the first inline applyManaged in Run.
const renewalStartupDelay = 30 * time.Second

// RenewalState is the per-cert outcome the scheduler tracks, surfaced via
// GET /certs.
type RenewalState struct {
	LastAttempt time.Time
	LastSuccess time.Time
	LastError   string // "" after a success
	Manual      bool   // flat cert: warn-only, certbot can't renew it
}

// RenewalStatus is the scheduler snapshot for GET /status / GET /certs.
type RenewalStatus struct {
	Enabled       bool
	CheckInterval time.Duration
	RenewBefore   time.Duration
	NextCheck     time.Time
	States        map[string]RenewalState
}

// RenewalStatus snapshots the scheduler state (map copied — never the live one).
func (m *Manager) RenewalStatus() RenewalStatus {
	cfg := m.Config()
	r := cfg.Acme.Renewal
	st := RenewalStatus{
		Enabled:       cfg.Acme.Enabled && r.RenewalEnabled(),
		CheckInterval: r.CheckIntervalOrDefault(),
		RenewBefore:   r.RenewBeforeOrDefault(),
		States:        map[string]RenewalState{},
	}
	m.renewMu.Lock()
	st.NextCheck = m.renewNext
	for k, v := range m.renewals {
		st.States[k] = v
	}
	m.renewMu.Unlock()
	return st
}

// RenewManaged reports whether a cert (by index key) is certbot-renewable —
// i.e. a live/<domain>/ dir exists under acme.config_dir. Flat manual certs
// return false.
func (m *Manager) RenewManaged(domain string) bool {
	if !m.AcmeEnabled() {
		return false
	}
	cfg := m.Config()
	return isDir(filepath.Join(cfg.Acme.ConfigDirOrDefault(), "live", domain))
}

// RenewTimeout bounds one renewal run. A renewal replays whichever challenge
// each cert was issued with, so when DNS-01 is allowed at all, allow for its
// propagation wait. Shared by the admin renew handlers and the renewal
// scheduler so an operator-tuned propagation_seconds is always honoured.
func (m *Manager) RenewTimeout() time.Duration {
	a := m.Config().Acme
	if a.AllowsChallenge(config.ChallengeDNS) {
		return time.Duration(a.DNS.MaxPropagationSeconds())*time.Second + 120*time.Second
	}
	return 120 * time.Second
}

// IssueTimeout bounds one issuance with the given challenge and DNS provider
// ("" = the defaults): DNS-01 waits for that provider's propagation plus a
// buffer, HTTP-01 is quicker.
func (m *Manager) IssueTimeout(challenge, provider string) time.Duration {
	a := m.Config().Acme
	if challenge == "" {
		challenge = a.ChallengeOrDefault()
	}
	if challenge == config.ChallengeDNS {
		if provider == "" {
			provider = a.DNS.Provider
		}
		return time.Duration(a.DNS.PropagationSecondsFor(provider))*time.Second + 120*time.Second
	}
	return 120 * time.Second
}

// AcmeStatus is the acme block of GET /status: what this daemon can issue, so
// a control plane can pick a challenge and provider per request.
type AcmeStatus struct {
	Enabled    bool     `json:"enabled"`
	Challenge  string   `json:"challenge,omitempty"`
	Challenges []string `json:"challenges,omitempty"`
	// DNSProvider is the default DNS plugin (acme.dns.provider).
	DNSProvider string `json:"dns_provider,omitempty"`
	// DNSProviders lists the certbot DNS plugins installed on this host; null
	// until the background probe has finished.
	DNSProviders      []string `json:"dns_providers"`
	DNSProvidersError string   `json:"dns_providers_error,omitempty"`
	RenewBefore       string   `json:"renew_before,omitempty"`
	// PropagationSeconds is the fallback DNS wait; PropagationSecondsByProvider
	// the per-plugin overrides (only present when DNS-01 is allowed).
	PropagationSeconds           int            `json:"propagation_seconds,omitempty"`
	PropagationSecondsByProvider map[string]int `json:"propagation_seconds_by_provider,omitempty"`
	// DNSConfigCredentials is set when acme.dns references a credential in the
	// config (credentials_env / credentials_file): which provider's default
	// account it serves and where it comes from. Every other provider and every
	// named account uses the runtime credential store.
	DNSConfigCredentials *DNSConfigCredentials `json:"dns_config_credentials,omitempty"`
}

// DNSConfigCredentials describes the config-referenced DNS credential.
type DNSConfigCredentials struct {
	Provider string `json:"provider"`
	Account  string `json:"account"`
	Source   string `json:"source"` // "env" | "file"
}

// AcmeStatus reports the effective ACME capabilities.
func (m *Manager) AcmeStatus() AcmeStatus {
	client := m.acme.Load()
	if client == nil {
		return AcmeStatus{Enabled: false}
	}
	a := m.Config().Acme
	st := AcmeStatus{
		Enabled:     true,
		Challenge:   a.ChallengeOrDefault(),
		Challenges:  a.ChallengesOrDefault(),
		RenewBefore: a.Renewal.RenewBeforeOrDefault().String(),
	}
	if a.AllowsChallenge(config.ChallengeDNS) {
		st.DNSProvider = a.DNS.Provider
		st.PropagationSeconds = a.DNS.PropagationSecondsOrDefault()
		st.PropagationSecondsByProvider = a.DNS.PropagationSecondsByProvider
		if client.HasConfigCredentials() {
			source := "file"
			if a.DNS.CredentialsEnv != "" {
				source = "env"
			}
			st.DNSConfigCredentials = &DNSConfigCredentials{Provider: a.DNS.Provider, Account: credstore.DefaultAccount, Source: source}
		}
	}
	if plugins, known, err := client.DNSPlugins(); known {
		st.DNSProviders = plugins
		if err != nil {
			st.DNSProvidersError = err.Error()
		}
	}
	return st
}

// renewalInterval reads the effective check interval fresh off the config, so
// a SIGHUP/POST /reload changing it takes effect without restart.
func (m *Manager) renewalInterval() time.Duration {
	return m.Config().Acme.Renewal.CheckIntervalOrDefault()
}

// runRenewalLoop is the renewal scheduler goroutine. Started unconditionally
// (one parked goroutine costs nothing): gating on AcmeEnabled at start time
// would be a bug — Reload can flip acme.enabled ON at runtime and a loop that
// was never started can't wake up. Every tick re-checks enablement instead.
func (m *Manager) runRenewalLoop(ctx context.Context) {
	startup := time.NewTimer(renewalStartupDelay)
	defer startup.Stop()
	interval := m.renewalInterval()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	m.renewMu.Lock()
	m.renewNext = time.Now().Add(renewalStartupDelay)
	m.renewMu.Unlock()

	for {
		select {
		case <-ctx.Done():
			return
		case <-startup.C:
		case <-ticker.C:
		}

		m.renewMu.Lock()
		m.renewNext = time.Now().Add(interval)
		m.renewMu.Unlock()

		if !m.AcmeEnabled() { // Reload may have nil'd m.acme; keep parking
			continue
		}
		r := m.Config().Acme.Renewal
		if !r.RenewalEnabled() {
			continue
		}
		m.renewDueOnce(ctx, r.RenewBeforeOrDefault())

		// SIGHUP-safe interval: recreate the ticker only when it changed.
		if ni := m.renewalInterval(); ni != interval {
			ticker.Reset(ni)
			interval = ni
		}
	}
}

// renewDueOnce loads the cert index, splits due certs into certbot-managed vs
// manual, renews the managed ones sequentially, and runs ONE applyManaged after
// the batch iff at least one renewal succeeded (RenewCert's one-cert-one-reload
// behavior is right for the manual API path, wrong for a batch). A failing cert
// is logged and recorded but never starves the rest.
//
// acmeMu is taken and released around EACH certbot run rather than held across
// the batch: the lock still guarantees one certbot at a time, but an operator's
// own issue/renew now only waits for the cert being renewed instead of for
// every due cert in the sweep — N x RenewTimeout, unattended and on a timer.
func (m *Manager) renewDueOnce(ctx context.Context, renewBefore time.Duration) {
	dir := m.CertDir()
	idx, err := certs.Load(dir)
	if err != nil {
		m.log.Warn("renewal check: cert load failed; retrying next tick", "dir", dir, "error", err)
		return
	}
	due := idx.ExpiringWithin(time.Now(), renewBefore)
	if len(due) == 0 {
		return
	}

	liveBase := filepath.Join(m.Config().Acme.ConfigDirOrDefault(), "live")

	anySucceeded := false
	for _, c := range due {
		expiresIn := time.Until(c.NotAfter).Round(time.Minute)
		if !isDir(filepath.Join(liveBase, c.Domain)) {
			// Manual flat cert — certbot can't renew it; warn every tick until
			// the operator re-uploads.
			m.log.Warn("manual cert is close to expiry; renew/re-upload it (certbot does not manage it)",
				"domain", c.Domain, "expires_in", expiresIn.String())
			m.recordRenewal(c.Domain, RenewalState{LastAttempt: time.Now(), Manual: true,
				LastError: "manual cert: renew/re-upload it (certbot does not manage it)"})
			continue
		}

		m.log.Info("renewing certificate", "domain", c.Domain, "expires_in", expiresIn.String())
		rerr := m.renewOne(ctx, c.Domain)
		if errors.Is(rerr, ErrAcmeDisabled) {
			// Disabled by a concurrent Reload. Stop, but fall through to the
			// apply below so certs renewed earlier in this batch still land.
			break
		}
		st := RenewalState{LastAttempt: time.Now()}
		if rerr != nil {
			st.LastError = rerr.Error()
			m.log.Error("certificate renewal failed; retrying next tick", "domain", c.Domain, "error", rerr)
		} else {
			st.LastSuccess = time.Now()
			anySucceeded = true
			m.log.Info("certificate renewed", "domain", c.Domain)
		}
		m.recordRenewal(c.Domain, st)
	}

	// One reload for the whole batch. Lock order matches the existing
	// issue/renew endpoints: acmeMu released before applyManaged takes applyMu.
	if anySucceeded {
		m.applyManaged(ctx)
	}
}

// renewOne runs certbot for one cert under the run lock, bounded by
// RenewTimeout. ErrAcmeDisabled when a concurrent Reload turned issuance off.
func (m *Manager) renewOne(ctx context.Context, domain string) error {
	m.acmeMu.Lock()
	defer m.acmeMu.Unlock()
	client := m.acme.Load()
	if client == nil {
		return ErrAcmeDisabled
	}
	runCtx, cancel := context.WithTimeout(ctx, m.RenewTimeout())
	defer cancel()
	_, err := client.Renew(runCtx, domain)
	return err
}

// recordRenewal stores a per-cert state, preserving a previous LastSuccess
// when the new state carries none.
func (m *Manager) recordRenewal(domain string, st RenewalState) {
	m.renewMu.Lock()
	defer m.renewMu.Unlock()
	if m.renewals == nil {
		m.renewals = map[string]RenewalState{}
	}
	if prev, ok := m.renewals[domain]; ok && st.LastSuccess.IsZero() {
		st.LastSuccess = prev.LastSuccess
	}
	m.renewals[domain] = st
}
