package manager

import (
	"context"
	"slices"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/realip"
)

// realIPStartupDelay is the one-shot catch-up fetch shortly after startup —
// a fresh install has no cached ranges yet, and waiting a full refresh
// interval for the first set would leave real-ip inert for hours.
const realIPStartupDelay = 15 * time.Second

// RealIPStatus is the refresh-loop snapshot for GET /status.
type RealIPStatus struct {
	Enabled     bool      `json:"enabled"`
	Header      string    `json:"header"`
	Recursive   bool      `json:"recursive"`
	Providers   []string  `json:"providers"`
	StaticCount int       `json:"static_count"`
	RangeCount  int       `json:"range_count"` // cached provider ranges currently in effect
	LastRefresh time.Time `json:"last_refresh,omitzero"`
	LastError   string    `json:"last_error,omitempty"`
}

// RealIPStatus snapshots the refresh-loop state for the admin layer.
func (m *Manager) RealIPStatus() RealIPStatus {
	cfg := m.Config()
	r := cfg.Nginx.RealIP
	st := RealIPStatus{
		Enabled:     r.Enabled,
		Header:      r.HeaderOrDefault(),
		Recursive:   r.IsRecursive(),
		Providers:   append([]string{}, r.Providers...),
		StaticCount: len(r.StaticCidrs),
		RangeCount:  len(realip.LoadAll(cfg.DataDir, r.Providers)),
	}
	m.realIPMu.Lock()
	st.LastRefresh = m.realIPLast
	st.LastError = m.realIPErr
	m.realIPMu.Unlock()
	return st
}

// realIPInterval reads the effective refresh interval fresh off the config.
func (m *Manager) realIPInterval() time.Duration {
	return m.Config().Nginx.RealIP.RefreshOrDefault()
}

// runRealIPLoop periodically re-fetches the configured providers' published
// ranges, persists a validated set on change, and triggers an apply so the
// managed include picks it up — through the same quarantine-safe pipeline as
// every other apply, so a bad fetch can never break nginx (invalid sets never
// even reach the cache). Started unconditionally (Reload can enable real_ip at
// runtime); every tick re-checks enablement.
func (m *Manager) runRealIPLoop(ctx context.Context) {
	startup := time.NewTimer(realIPStartupDelay)
	defer startup.Stop()
	interval := m.realIPInterval()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-startup.C:
		case <-ticker.C:
		}

		cfg := m.Config()
		r := cfg.Nginx.RealIP
		if r.Enabled && len(r.Providers) > 0 {
			m.refreshRealIPOnce(ctx)
		}

		// SIGHUP-safe interval: recreate the ticker only when it changed.
		if ni := m.realIPInterval(); ni != interval {
			ticker.Reset(ni)
			interval = ni
		}
	}
}

// refreshRealIPOnce fetches every configured provider, stores changed sets,
// and runs ONE apply iff anything changed. A per-provider failure keeps that
// provider's cached set and is surfaced via RealIPStatus.LastError.
func (m *Manager) refreshRealIPOnce(ctx context.Context) {
	cfg := m.Config()
	r := cfg.Nginx.RealIP

	changed := false
	var lastErr string
	for _, provider := range r.Providers {
		fetched, err := realip.Fetch(ctx, provider)
		if err != nil {
			lastErr = provider + ": " + err.Error()
			m.log.Warn("real-ip range fetch failed; keeping cached set", "provider", provider, "error", err)
			continue
		}
		cached, _ := realip.Load(cfg.DataDir, provider)
		if slices.Equal(fetched, cached) {
			continue
		}
		if err := realip.Store(cfg.DataDir, provider, fetched); err != nil {
			lastErr = provider + ": " + err.Error()
			m.log.Error("real-ip range store failed", "provider", provider, "error", err)
			continue
		}
		changed = true
		m.log.Info("real-ip ranges updated", "provider", provider, "count", len(fetched))
	}

	m.realIPMu.Lock()
	m.realIPLast = time.Now()
	m.realIPErr = lastErr
	m.realIPMu.Unlock()

	if changed && m.engine != nil {
		m.applyManaged(ctx)
	}
}
