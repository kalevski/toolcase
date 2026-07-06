package manager

import (
	"context"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/certs"
	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/nginxctl"
)

// reconcileFlapTicks is the flap-damping threshold: a resource must fail (or
// recover) this many consecutive ticks before the disable policy (or
// auto-recovery) triggers an apply, so an intermittently-answering DNS server
// can't cause reload ping-pong.
const reconcileFlapTicks = 2

// reconcileKey matches ResourceResult identity.
type reconcileKey struct{ Kind, Key string }

// reconcileEntry tracks one non-healthy resource across ticks. Healthy
// resources carry no entry (the map is pruned), so it can't grow unboundedly.
type reconcileEntry struct {
	State        string    // last observed dry-run state for this resource
	Reason       string    // annotated reason (target pre-flight) or nginx -t stderr
	FirstFailure time.Time // wall clock, for the API `since` field
	ConsecOK     int       // consecutive passing ticks (recovery damping)
	ConsecFail   int       // consecutive failing ticks (disable damping)
	AtRisk       bool      // live+serving but failing the dry-run
}

// applyGeneration reads the apply counter (incremented by applyManaged).
func (m *Manager) applyGeneration() uint64 {
	m.applyMu.Lock()
	defer m.applyMu.Unlock()
	return m.applyGen
}

// reconcileInterval reads the effective tick interval fresh off the config.
func (m *Manager) reconcileInterval() time.Duration {
	return m.Config().Nginx.Reconcile.IntervalOrDefault()
}

// ReconcileSummary is the top-level reconcile block for GET /status.
type ReconcileSummary struct {
	Enabled     bool          `json:"enabled"`
	Interval    time.Duration `json:"-"`
	IntervalStr string        `json:"interval"`
	OnFailure   string        `json:"on_failure"`
	LastRun     *time.Time    `json:"last_run,omitempty"`
	AtRiskCount int           `json:"at_risk_count"`
}

// ReconcileStatus snapshots the loop state for the admin layer.
func (m *Manager) ReconcileStatus() ReconcileSummary {
	rc := m.Config().Nginx.Reconcile
	out := ReconcileSummary{
		Enabled:   m.engine != nil && rc.ReconcileEnabled(),
		Interval:  rc.IntervalOrDefault(),
		OnFailure: rc.OnFailureOrWarn(),
	}
	out.IntervalStr = out.Interval.String()
	m.reconMu.Lock()
	if !m.reconLast.IsZero() {
		t := m.reconLast
		out.LastRun = &t
	}
	for _, e := range m.reconcile {
		if e.AtRisk {
			out.AtRiskCount++
		}
	}
	m.reconMu.Unlock()
	return out
}

// runReconcileLoop periodically dry-runs the full config against nginx -t,
// diffs against the last apply, marks fresh failures as at_risk (policy warn)
// or triggers an apply so the quarantine pass disables them (policy disable),
// and always auto-recovers quarantined resources that pass again. One
// goroutine, one Ticker: ticks can never stack (a slow tick absorbs the next
// fire), and the generation counter discards a tick whose dry-run raced a
// real apply.
func (m *Manager) runReconcileLoop(ctx context.Context) {
	if m.engine == nil {
		return
	}
	interval := m.reconcileInterval()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		rc := m.Config().Nginx.Reconcile
		if !rc.ReconcileEnabled() {
			continue
		}
		m.reconcileOnce(ctx, rc.OnFailureOrWarn())
		if ni := m.reconcileInterval(); ni != interval {
			ticker.Reset(ni)
			interval = ni
		}
	}
}

// reconcileOnce runs one tick: generation-checked DryRun OUTSIDE applyMu (so
// /status and cert-watch applies never wait on nginx -t), then a short lock
// window for the diff, then at most one applyManaged.
func (m *Manager) reconcileOnce(ctx context.Context, policy string) {
	gen := m.applyGeneration()

	idx, err := certs.Load(m.certDir)
	if err != nil {
		idx = nil
	}
	res, err := m.engine.DryRun(ctx, m.Config(), idx) // no lock held — can take seconds
	if err != nil {
		m.log.Warn("reconcile dry-run failed; retrying next tick", "error", err)
		return
	}

	m.applyMu.Lock()
	if m.applyGen != gen {
		// An apply landed mid-dry-run: the result describes a config that no
		// longer exists. Skip; the next tick sees the settled state.
		m.applyMu.Unlock()
		return
	}
	last := m.lastApply
	m.applyMu.Unlock()

	if m.reconcileDiff(res, last, policy) {
		m.applyManaged(ctx) // takes applyMu itself; re-renders from live config
	}
}

// reconcileDiff classifies every resource of the dry-run result against the
// last apply and updates the reconcile state map. Returns true when an apply
// is warranted (recovery, or disable policy after flap damping). Logs only on
// TRANSITIONS — a flapping backend must not produce 1440 identical WARNs/day.
func (m *Manager) reconcileDiff(res, last nginxctl.ApplyResult, policy string) (needsApply bool) {
	now := map[reconcileKey]nginxctl.ResourceResult{}
	for _, r := range res.Resources {
		now[reconcileKey{r.Kind, r.Key}] = r
	}
	prev := map[reconcileKey]nginxctl.ResourceResult{}
	for _, r := range last.Resources {
		prev[reconcileKey{r.Kind, r.Key}] = r
	}

	m.reconMu.Lock()
	defer m.reconMu.Unlock()
	if m.reconcile == nil {
		m.reconcile = map[reconcileKey]*reconcileEntry{}
	}
	m.reconLast = time.Now()

	for key, cur := range now {
		before, existed := prev[key]
		entry := m.reconcile[key]

		switch {
		case cur.State == nginxctl.StateActive && (!existed || before.State == nginxctl.StateActive):
			// Healthy in both — clear any at_risk mark (log the transition).
			if entry != nil {
				if entry.AtRisk {
					m.log.Info("resource recovered (at_risk → ok)", "kind", key.Kind, "key", key.Key)
				}
				delete(m.reconcile, key)
			}

		case cur.State == nginxctl.StateDisabled && existed && before.State == nginxctl.StateActive:
			// New failure: live nginx keeps serving with its load-time state,
			// only a future reload would fail — so policy warn never touches
			// traffic, it only marks at_risk.
			if entry == nil {
				entry = &reconcileEntry{FirstFailure: time.Now()}
				m.reconcile[key] = entry
			}
			entry.State = nginxctl.StateAtRisk
			entry.Reason = cur.Reason
			entry.ConsecOK = 0
			entry.ConsecFail++
			if !entry.AtRisk {
				entry.AtRisk = true
				m.log.Warn("resource is at risk: live and serving but would fail the next apply",
					"kind", key.Kind, "key", key.Key, "reason", cur.Reason, "policy", policy)
			}
			if policy == config.ReconcileDisable && entry.ConsecFail >= reconcileFlapTicks {
				// The apply's quarantine pass does the disabling — the loop
				// never edits config.
				needsApply = true
			}

		case cur.State == nginxctl.StateActive && existed && before.State == nginxctl.StateDisabled:
			// Recovery candidate: only ever ADDS a resource back, and only
			// after the staged nginx -t proved the config valid — strictly safe.
			if entry == nil {
				entry = &reconcileEntry{FirstFailure: time.Now()}
				m.reconcile[key] = entry
			}
			entry.State = cur.State
			entry.ConsecFail = 0
			entry.ConsecOK++
			if entry.ConsecOK >= reconcileFlapTicks {
				m.log.Info("quarantined resource passes again; re-applying (disabled → recovered)",
					"kind", key.Kind, "key", key.Key)
				needsApply = true
			}

		case cur.State == nginxctl.StateDisabled:
			// Still broken (disabled in both, or brand-new and already failing)
			// — refresh the reason (DNS-rot reasons evolve), no log.
			if entry == nil {
				entry = &reconcileEntry{FirstFailure: time.Now(), State: nginxctl.StateDisabled}
				m.reconcile[key] = entry
			}
			entry.Reason = cur.Reason
			entry.ConsecOK = 0
			entry.ConsecFail++
		}
	}

	// Prune keys absent from both maps (resource deleted / disabled via its
	// enabled flag) so the map can't grow unboundedly across config edits.
	for key := range m.reconcile {
		_, inNow := now[key]
		_, inPrev := prev[key]
		if !inNow && !inPrev {
			delete(m.reconcile, key)
		}
	}
	return needsApply
}

// mergeReconcileState overlays at_risk state + since/last_reconcile timestamps
// onto the last apply's resources for GET /status. Called with applyMu held by
// NginxStatus; takes reconMu itself.
func (m *Manager) mergeReconcileState(resources []nginxctl.ResourceResult) []nginxctl.ResourceResult {
	m.reconMu.Lock()
	defer m.reconMu.Unlock()
	if len(m.reconcile) == 0 && m.reconLast.IsZero() {
		return resources
	}
	out := make([]nginxctl.ResourceResult, len(resources))
	copy(out, resources)
	var lastRun *time.Time
	if !m.reconLast.IsZero() {
		t := m.reconLast
		lastRun = &t
	}
	for i := range out {
		entry := m.reconcile[reconcileKey{out[i].Kind, out[i].Key}]
		if entry == nil {
			continue
		}
		out[i].LastReconcile = lastRun
		if !entry.FirstFailure.IsZero() {
			t := entry.FirstFailure
			out[i].Since = &t
		}
		if entry.AtRisk && out[i].State == nginxctl.StateActive {
			out[i].State = nginxctl.StateAtRisk
			out[i].Reason = entry.Reason
		}
	}
	return out
}
