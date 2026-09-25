package manager

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/bindctl"
	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/state"
	"github.com/kalevski/toolcase/zonewright/internal/store"
)

// named is down for the first apply; the retry must reload even though
// nothing on disk changed since, and then clear the pending flag.
func TestRetryReloadsAfterNamedComesUp(t *testing.T) {
	dir := t.TempDir()
	cfg := &config.Config{DataDir: dir, Zones: []config.Zone{{Name: "example.com"}}}
	cfg.Defaults.Nameservers = []string{"ns1.example.net"}
	cfg.Bind.CheckZoneCmd, cfg.Bind.CheckConfCmd, cfg.Bind.ReloadCmd = []string{}, []string{}, []string{"reload"}
	config.ApplyDefaults(cfg)
	if err := config.Validate(cfg); err != nil {
		t.Fatal(err)
	}

	var up atomic.Bool
	var reloads atomic.Int32
	run := func(context.Context, []string) (string, error) {
		reloads.Add(1)
		if !up.Load() {
			return "", errors.New("connection refused")
		}
		return "", nil
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	repl, err := store.Open(filepath.Join(dir, "zw.db"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer repl.Close()
	m := New(cfg, state.NewMemoryStore(), repl, bindctl.NewWithRunner(log, run, time.Now), log)

	if res := m.Apply(context.Background()); res.ReloadError == "" || !m.PendingRetry() {
		t.Fatalf("first apply should leave a pending reload: %+v", res)
	}
	up.Store(true)
	m.retry(context.Background())
	if m.PendingRetry() {
		t.Fatal("retry should clear the pending reload")
	}
	if last, _ := m.LastApply(); !last.Reloaded || last.ReloadError != "" {
		t.Fatalf("last apply: %+v", last)
	}
	if reloads.Load() != 2 {
		t.Fatalf("reloads = %d, want 2", reloads.Load())
	}
}
