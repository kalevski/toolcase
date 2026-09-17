package manager

import (
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// TestReloadDoesNotWaitForCertbot pins the property the atomic client pointer
// exists for. acmeMu is held for the whole of a certbot run — up to
// RenewTimeout, three minutes on DNS-01 — and every fragment write ends in a
// reload, so a Reload that takes that lock freezes the daemon's entire write
// surface for the length of an issuance. The control plane, which times out
// well before that, reports the daemon as unreachable.
func TestReloadDoesNotWaitForCertbot(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	m := &Manager{
		log:   slog.New(slog.NewTextHandler(io.Discard, nil)),
		cfg:   &config.Config{DataDir: dir},
		loops: map[string]*siteLoop{},
	}

	// A certbot run is in flight for as long as this test holds the lock.
	m.acmeMu.Lock()
	defer m.acmeMu.Unlock()

	done := make(chan struct{})
	go func() {
		defer close(done)
		m.Reload(&config.Config{DataDir: dir, Acme: config.Acme{Enabled: true}})
		if !m.AcmeEnabled() {
			t.Error("reload did not swap the acme client in")
		}
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Reload blocked on the certbot run lock")
	}
}

// TestAcmeEnabledDoesNotWaitForCertbot covers the other half: the admin
// handlers call AcmeEnabled as a precondition, so taking the run lock there
// made a second issue/renew/delete hang for the length of the first one rather
// than answering.
func TestAcmeEnabledDoesNotWaitForCertbot(t *testing.T) {
	t.Parallel()

	m := &Manager{log: slog.New(slog.NewTextHandler(io.Discard, nil))}
	m.acmeMu.Lock()
	defer m.acmeMu.Unlock()

	answered := make(chan bool, 1)
	go func() { answered <- m.AcmeEnabled() }()

	select {
	case enabled := <-answered:
		if enabled {
			t.Error("acme reported enabled with no client stored")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("AcmeEnabled blocked on the certbot run lock")
	}
}
