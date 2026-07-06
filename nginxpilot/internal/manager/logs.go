package manager

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/logship"
)

// logDestTestTimeout bounds one "Test connection" push.
const logDestTestTimeout = 10 * time.Second

// startLogship configures the shipper from the current config and, when
// access-log intake is enabled, binds the UDP listener. Called from Run
// BEFORE applyManaged so the listener exists before nginx is reloaded with
// access_log syslog: directives pointing at it (G6). A bind failure degrades
// to a /status error, never a daemon crash.
func (m *Manager) startLogship(ctx context.Context) {
	m.mu.Lock()
	cfg := m.cfg
	m.mu.Unlock()
	m.reconfigureLogship(ctx, cfg)
}

// reconfigureLogship applies a (new) config to the shipping side: destinations
// hot-swap without touching nginx; the intake restarts only when its address
// or enablement changed. Serialized by logsMu.
func (m *Manager) reconfigureLogship(ctx context.Context, cfg *config.Config) {
	m.logsMu.Lock()
	defer m.logsMu.Unlock()

	// Lazily created so a Manager built as a bare struct (tests) works too.
	if m.shipper == nil {
		m.shipper = logship.NewShipper(m.log)
	}
	m.shipper.Configure(buildShipDestinations(cfg, m.log))

	wantAddr := ""
	if cfg.Logs.Access.Enabled {
		wantAddr = cfg.Logs.Access.ListenOrDefault()
	}
	if m.intake != nil && (wantAddr == "" || m.intake.Addr() != wantAddr) {
		m.intake.Close()
		m.intake = nil
	}
	m.intakeErr = ""
	if wantAddr != "" && m.intake == nil {
		intake := logship.NewIntake(wantAddr, m.shipper, cfg.Logs.ParseAccessOptions(), m.log)
		if err := intake.Start(ctx); err != nil {
			m.log.Error("log intake bind failed; access-log shipping is down", "addr", wantAddr, "error", err)
			m.intakeErr = err.Error()
		} else {
			m.intake = intake
		}
	}
}

// buildShipDestinations maps enabled config destinations onto compiled logship
// destinations, auto-adding the Prometheus-convention `instance` label (G17)
// so two edges shipping identical label sets don't interleave streams.
func buildShipDestinations(cfg *config.Config, log *slog.Logger) []logship.Destination {
	hostname, _ := os.Hostname()
	var out []logship.Destination
	for i := range cfg.LogDestinations {
		d := &cfg.LogDestinations[i]
		if !d.IsEnabled() {
			continue
		}
		ship, err := d.ShipDestination()
		if err != nil {
			// Validation compiles the same filter, so this cannot normally fail.
			log.Warn("log destination skipped", "destination", d.Name, "error", err)
			continue
		}
		if ship.Type == logship.DestLoki && hostname != "" {
			if _, set := ship.Labels.Static["instance"]; !set {
				ship.Labels.Static["instance"] = hostname
			}
		}
		out = append(out, ship)
	}
	return out
}

// stopLogship flushes and stops shipping (shutdown path).
func (m *Manager) stopLogship() {
	m.logsMu.Lock()
	defer m.logsMu.Unlock()
	if m.intake != nil {
		m.intake.Close()
		m.intake = nil
	}
	if m.shipper != nil {
		m.shipper.Close()
	}
}

// LogsStatusPayload is the `logs` object in GET /status and GET /logs/status.
type LogsStatusPayload struct {
	Enabled      bool   `json:"enabled"`       // logs.access.enabled
	SyslogListen string `json:"syslog_listen"` // effective intake address
	IntakeError  string `json:"intake_error,omitempty"`
	logship.Status
}

// LogsStatus snapshots per-destination shipping stats plus intake health.
func (m *Manager) LogsStatus() LogsStatusPayload {
	cfg := m.Config()
	m.logsMu.Lock()
	intakeErr := m.intakeErr
	shipper := m.shipper
	m.logsMu.Unlock()
	payload := LogsStatusPayload{
		Enabled:      cfg.Logs.Access.Enabled,
		SyslogListen: cfg.Logs.Access.ListenOrDefault(),
		IntakeError:  intakeErr,
	}
	if shipper != nil {
		payload.Status = shipper.Status()
	} else {
		payload.Destinations = []logship.DestStatus{}
	}
	return payload
}

// TestLogDestination compiles a destination (saved or candidate) and pushes
// one synthetic test entry, returning the delivery error — the log-pipeline
// analog of POST /nginx/test (G11: body-based, works pre-save).
func (m *Manager) TestLogDestination(ctx context.Context, d *config.LogDestination) error {
	ship, err := d.ShipDestination()
	if err != nil {
		return err
	}
	testCtx, cancel := context.WithTimeout(ctx, logDestTestTimeout)
	defer cancel()
	return logship.TestDestination(testCtx, &ship)
}
