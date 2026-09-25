package manager

import (
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/bindctl"
	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/state"
	"github.com/kalevski/toolcase/zonewright/internal/store"
)

func TestMigrateFragments(t *testing.T) {
	dir := t.TempDir()
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(os.MkdirAll(filepath.Join(dir, "zones.d"), 0o750))
	must(os.WriteFile(filepath.Join(dir, "config.yml"), []byte("data_dir: "+dir+"\ndefaults: {nameservers: [ns1.example.net]}\ninclude: [zones.d/*.yml]\n"), 0o640))
	// Written by the old API (deterministic name) → migrated.
	must(os.WriteFile(filepath.Join(dir, "zones.d", "example.com.yml"), []byte("zones:\n  - name: example.com\n    records:\n      - {name: www, type: A, value: 192.0.2.1}\n"), 0o640))
	// Hand-written under another file name → stays local.
	must(os.WriteFile(filepath.Join(dir, "zones.d", "hand.yml"), []byte("zones:\n  - name: hand.org\n"), 0o640))

	serials, _ := state.NewStore(dir)
	serials.Put("example.com", state.ZoneState{Serial: 2026092407})
	must(serials.Save())

	res, err := config.Load(filepath.Join(dir, "config.yml"))
	must(err)
	repl, err := store.Open(filepath.Join(dir, "zw.db"), nil)
	must(err)
	defer repl.Close()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	m := New(res.Config, serials, repl, bindctl.NewWithRunner(log, nil, time.Now), log)

	migrated, err := m.MigrateFragments(true, serials)
	must(err)
	if len(migrated) != 1 || migrated[0] != "example.com" {
		t.Fatalf("migrated %v", migrated)
	}
	z, ok, _ := repl.Zone("example.com")
	if !ok || len(z.Records) != 1 || z.Serial <= 2026092407 {
		t.Fatalf("migrated zone: %+v", z)
	}
	if _, err := os.Stat(filepath.Join(dir, "zones.d", "example.com.yml.migrated")); err != nil {
		t.Fatal("fragment not renamed")
	}
	if _, ok, _ := repl.Zone("hand.org"); ok {
		t.Fatal("a hand-written zone file must stay local")
	}
	// Runs once only.
	again, err := m.MigrateFragments(true, serials)
	if err != nil || len(again) != 0 {
		t.Fatalf("second run: %v %v", again, err)
	}
	// After a config reload the zone is served from the store, not the file.
	res, err = config.Load(filepath.Join(dir, "config.yml"))
	must(err)
	m.SetConfig(res.Config)
	eff, conflicts := m.Effective()
	if i := eff.FindZone("example.com"); i < 0 || eff.Zones[i].File != config.ReplicatedFile || len(conflicts) != 0 {
		t.Fatalf("effective config: %+v %+v", eff.Zones, conflicts)
	}
}

// A fresh install (no legacy state.json) never imports zone files.
func TestMigrateSkipsFreshInstall(t *testing.T) {
	dir := t.TempDir()
	repl, _ := store.Open(filepath.Join(dir, "zw.db"), nil)
	defer repl.Close()
	cfg := &config.Config{DataDir: dir, Include: []string{"zones.d/*.yml"}, Path: filepath.Join(dir, "config.yml"),
		Zones: []config.Zone{{Name: "example.com", File: filepath.Join(dir, "zones.d", "example.com.yml")}}}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	m := New(cfg, state.NewMemoryStore(), repl, bindctl.NewWithRunner(log, nil, time.Now), log)
	if got, err := m.MigrateFragments(false, state.NewMemoryStore()); err != nil || len(got) != 0 {
		t.Fatalf("%v %v", got, err)
	}
}
