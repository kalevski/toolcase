package manager

import (
	"context"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/phpfpm"
)

// PHPStatus snapshots the php runtime and every app's pool health for the admin
// /status endpoint.
func (m *Manager) PHPStatus() phpfpm.Status {
	m.mu.Lock()
	cfg := m.cfg
	m.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return phpfpm.Report(ctx, cfg)
}

// ApplyPools renders and applies the php-fpm pool set. It runs on the same
// occasions the nginx apply does — startup and reload — because an app's pool
// and its vhost have to appear together: a vhost whose pool is missing is
// quarantined, and a pool with no vhost serves nobody.
func (m *Manager) ApplyPools(ctx context.Context) error {
	m.mu.Lock()
	cfg := m.cfg
	m.mu.Unlock()

	if cfg == nil || !cfg.PHP.Enabled {
		return nil
	}

	res, err := phpfpm.Apply(ctx, cfg)
	if err != nil {
		m.log.Error("php-fpm pool apply failed", "error", err)
		return err
	}
	for app, reason := range res.Disabled {
		m.log.Error("php app disabled: its pool failed validation", "pool", app, "reason", reason)
	}
	if len(res.Written) > 0 {
		m.log.Info("php-fpm pools applied", "pools", len(res.Written), "reloaded", res.Reloaded)
	}

	// Give php-fpm a moment to actually listen before the nginx apply decides
	// whether each app's pool is available. Losing this race only costs a
	// reconcile cycle, but it would mean every app comes up quarantined on a
	// cold start, which reads like a broken feature.
	if !phpfpm.WaitForPools(ctx, cfg, 30*time.Second) {
		m.log.Warn("some php-fpm pools did not come up in time; their apps stay disabled until the next reconcile")
	}
	return nil
}

// RemoveAppData reclaims an app's persistent directory. Explicitly separate
// from removing the app, because the data belongs to whoever deployed it.
func (m *Manager) RemoveAppData(domain string) error {
	return m.deployer.RemoveApp(domain, true)
}

// PHPApps returns the enabled php apps from the live config.
func (m *Manager) PHPApps() []config.App {
	m.mu.Lock()
	cfg := m.cfg
	m.mu.Unlock()
	if cfg == nil {
		return nil
	}
	out := make([]config.App, 0, len(cfg.Apps))
	for _, a := range cfg.Apps {
		if a.IsEnabled() && a.RuntimeMode() == config.RuntimePHP {
			out = append(out, a)
		}
	}
	return out
}
