package manager

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// TestReconfigureLogshipRestartsIntakeOnParseOptionsChange is bug 4: editing
// logs.redact.query_params (or anonymize_ip) and reloading must restart the
// intake, or the new redaction policy silently never applies.
func TestReconfigureLogshipRestartsIntakeOnParseOptionsChange(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	ctx := context.Background()

	cfg := &config.Config{
		Logs: config.Logs{
			Access: config.AccessLogs{Enabled: true, SyslogListen: "127.0.0.1:0"},
		},
	}
	m := &Manager{log: logger, cfg: cfg}
	defer m.stopLogship()

	m.reconfigureLogship(ctx, cfg)
	first := m.intake
	if first == nil {
		t.Fatal("expected an intake to be started")
	}

	// Reload with the SAME config: no restart should happen.
	m.reconfigureLogship(ctx, cfg)
	if m.intake != first {
		t.Error("intake was restarted with no config change")
	}

	// Same listen address, but redact_params changed — must restart.
	cfg2 := &config.Config{
		Logs: config.Logs{
			Access: config.AccessLogs{Enabled: true, SyslogListen: "127.0.0.1:0"},
			Redact: config.LogRedact{QueryParams: &[]string{"custom_secret"}},
		},
	}
	m.reconfigureLogship(ctx, cfg2)
	second := m.intake
	if second == nil {
		t.Fatal("expected an intake after reload")
	}
	if second == first {
		t.Error("intake was not restarted after redact_params changed")
	}
	got := second.Options().RedactParams
	if len(got) != 1 || got[0] != "custom_secret" {
		t.Errorf("new intake's options = %v, want [custom_secret]", got)
	}

	// Toggling anonymize_ip alone must also restart.
	cfg3 := &config.Config{
		Logs: config.Logs{
			Access: config.AccessLogs{Enabled: true, SyslogListen: "127.0.0.1:0"},
			Redact: config.LogRedact{QueryParams: &[]string{"custom_secret"}, AnonymizeIP: true},
		},
	}
	m.reconfigureLogship(ctx, cfg3)
	third := m.intake
	if third == nil {
		t.Fatal("expected an intake after reload")
	}
	if third == second {
		t.Error("intake was not restarted after anonymize_ip changed")
	}
	if !third.Options().AnonymizeIP {
		t.Error("new intake's options should have AnonymizeIP=true")
	}
}
