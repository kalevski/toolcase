package manager

import (
	"context"

	"github.com/kalevski/toolcase/nginxpilot/internal/certs"
	"github.com/kalevski/toolcase/nginxpilot/internal/nginxctl"
)

// Managed reports whether managed mode is on (nginx.manage: true).
func (m *Manager) Managed() bool { return m.engine != nil }

// applyManaged loads the current certs and runs the apply engine, recording the
// result for /status. Serialized by applyMu so a reload and a cert-change apply
// can never interleave. A failure is logged, not fatal — nginx keeps serving the
// last-good config (the engine rolls back on a post-swap failure).
func (m *Manager) applyManaged(ctx context.Context) {
	if m.engine == nil {
		return
	}
	m.applyMu.Lock()
	defer m.applyMu.Unlock()
	m.applyGen++ // reconcile ticks whose dry-run raced this apply discard their result

	idx, err := certs.Load(m.certDir)
	if err != nil {
		m.log.Warn("cert load failed; applying without certs", "dir", m.certDir, "error", err)
		idx = nil
	}
	m.certIndex = idx

	res, err := m.engine.Apply(ctx, m.Config(), idx)
	m.lastApply = res
	if err != nil {
		m.log.Error("nginx apply failed", "error", err)
		return
	}
	if d := res.Disabled(); len(d) > 0 {
		m.log.Warn("nginx config applied with disabled resources", "active", len(res.Resources)-len(d), "disabled", len(d))
	} else {
		m.log.Info("nginx config applied", "resources", len(res.Resources))
	}
}

// triggerApply schedules an apply off the lock path (Reload holds m.mu, and
// applyManaged takes m.Config() which would deadlock if called inline).
func (m *Manager) triggerApply() {
	if m.engine == nil {
		return
	}
	ctx := m.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	go m.applyManaged(ctx)
}

// runCertWatch polls the cert dir and re-applies on renewal (reload_on_change).
func (m *Manager) runCertWatch(ctx context.Context) {
	if m.engine == nil || !m.reloadOnChange || m.certDir == "" {
		<-ctx.Done()
		return
	}
	last := m.certIndex.Fingerprint()
	w := certs.NewWatcher(m.certDir, m.watchInterval, last, m.log)
	w.Run(ctx, func(*certs.Index) { m.applyManaged(ctx) })
}

// CertDir resolves the configured TLS cert directory, independent of managed
// mode (m.certDir is populated only when nginx.manage is on). Returns "" when
// TLS is unconfigured or the configured cert_dir_env names an unset variable.
// The admin cert-listing endpoint reads disk fresh from this dir, so it reflects
// renewals immediately and works in generate-only mode too.
func (m *Manager) CertDir() string {
	if m.certDir != "" {
		return m.certDir
	}
	dir, err := m.Config().Tls.ResolveDir()
	if err != nil {
		return ""
	}
	return dir
}

// NginxStatus returns the managed-mode flag and the last apply's per-resource
// states for GET /status, overlaid with the reconcile loop's at_risk state and
// since/last_reconcile timestamps.
func (m *Manager) NginxStatus() (managed bool, resources []nginxctl.ResourceResult) {
	if m.engine == nil {
		return false, nil
	}
	m.applyMu.Lock()
	res := m.lastApply.Resources
	m.applyMu.Unlock()
	return true, m.mergeReconcileState(res)
}

// NginxTest runs a dry-run apply (render + validate, no swap/reload) for POST
// /nginx/test, returning the per-resource pass/fail set without committing.
func (m *Manager) NginxTest(ctx context.Context) (nginxctl.ApplyResult, bool, error) {
	if m.engine == nil {
		return nginxctl.ApplyResult{}, false, nil
	}
	idx, err := certs.Load(m.certDir)
	if err != nil {
		idx = nil
	}
	res, err := m.engine.DryRun(ctx, m.Config(), idx)
	return res, true, err
}
