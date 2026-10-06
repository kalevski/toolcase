package manager

import (
	"context"
	"io"
	"log/slog"
	"path/filepath"
	"testing"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/bindctl"
	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/state"
	"github.com/kalevski/toolcase/zonewright/internal/store"
)

func newCacheManager(t *testing.T) *Manager {
	t.Helper()
	dir := t.TempDir()
	cfg := &config.Config{DataDir: dir}
	cfg.Defaults.Nameservers = []string{"ns1.example.net"}
	cfg.Bind.CheckZoneCmd, cfg.Bind.CheckConfCmd, cfg.Bind.ReloadCmd = []string{}, []string{}, []string{}
	cfg.Bind.ZoneDir, cfg.Bind.ConfFile = filepath.Join(dir, "zones"), filepath.Join(dir, "named.zones.conf")
	config.ApplyDefaults(cfg)
	if err := config.Validate(cfg); err != nil {
		t.Fatal(err)
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	repl, err := store.Open(filepath.Join(dir, "zw.db"), nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { repl.Close() })
	run := func(context.Context, []string) (string, error) { return "", nil }
	return New(cfg, state.NewMemoryStore(), repl, bindctl.NewWithRunner(log, run, time.Now), log)
}

func put(t *testing.T, m *Manager, name string, recs ...config.Record) {
	t.Helper()
	z := config.Zone{Name: name, Records: recs}
	if _, err := m.Mutate(context.Background(), name, func(Current) (*config.Zone, error) { return &z, nil }); err != nil {
		t.Fatal(err)
	}
}

func zoneOf(eff *config.Config, name string) *config.Zone {
	if i := eff.FindZone(name); i >= 0 {
		return &eff.Zones[i]
	}
	return nil
}

// The cached effective config must follow every way the store or the file
// config can change: local writes, deletes, remote ops and a config swap.
func TestEffectiveCacheInvalidation(t *testing.T) {
	m := newCacheManager(t)
	a := config.Record{Name: "www", Type: "A", Value: "192.0.2.1"}
	put(t, m, "a.test", a)
	put(t, m, "b.test", a)

	eff, _ := m.Effective()
	if eff2, _ := m.Effective(); eff2 != eff {
		t.Fatal("unchanged state should reuse the cached effective config")
	}
	za, zb := zoneOf(eff, "a.test"), zoneOf(eff, "b.test")
	if za == nil || zb == nil || len(za.Records) != 1 || za.Serial == 0 {
		t.Fatalf("zones: %+v %+v", za, zb)
	}
	serialA := za.Serial

	// A write to a.test changes a.test (records, serial) and leaves b.test as it was.
	put(t, m, "a.test", a, config.Record{Name: "api", Type: "A", Value: "192.0.2.2"})
	eff, _ = m.Effective()
	if za = zoneOf(eff, "a.test"); len(za.Records) != 2 || za.Serial <= serialA {
		t.Fatalf("a.test after write: %d records, serial %d (was %d)", len(za.Records), za.Serial, serialA)
	}
	if got := zoneOf(eff, "b.test"); len(got.Records) != 1 || got.Serial != zb.Serial {
		t.Fatalf("b.test changed: %+v", got)
	}
	if got := m.Serial("a.test"); got != za.Serial {
		t.Fatalf("Serial() = %d, effective serial %d", got, za.Serial)
	}

	// Deleting a zone removes it.
	if _, err := m.Mutate(context.Background(), "b.test", func(Current) (*config.Zone, error) { return nil, nil }); err != nil {
		t.Fatal(err)
	}
	if eff, _ = m.Effective(); zoneOf(eff, "b.test") != nil {
		t.Fatal("deleted zone is still effective")
	}

	// A replicated zone shadowed by a newly loaded local zone is left out and reported.
	local := *m.Config()
	local.Zones = []config.Zone{{Name: "a.test", Records: []config.Record{a}}}
	m.SetConfig(&local)
	eff, conflicts := m.Effective()
	if z := zoneOf(eff, "a.test"); z == nil || z.File == config.ReplicatedFile {
		t.Fatalf("local zone should win: %+v", z)
	}
	if len(conflicts) != 1 || conflicts[0].Kind != "shadowed" {
		t.Fatalf("conflicts: %+v", conflicts)
	}
	m.SetConfig(&config.Config{DataDir: local.DataDir, Defaults: local.Defaults, Bind: local.Bind})
	if eff, conflicts = m.Effective(); len(conflicts) != 0 || zoneOf(eff, "a.test").File != config.ReplicatedFile {
		t.Fatalf("shadow should be gone: %+v", conflicts)
	}

	// Ops arriving from a peer count as changes too.
	peer, err := store.Open(filepath.Join(t.TempDir(), "peer.db"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer peer.Close()
	ops, err := peer.LocalWrite([]store.Draft{
		{Kind: store.KindZoneCreate, Zone: "c.test", Payload: store.CreatePayload{}},
		{Kind: store.KindRRset, Zone: "c.test", Generation: store.NewGeneration, Name: "www", Type: "A", Payload: store.RRsetPayload{Records: []config.Record{a}}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := m.repl.ApplyRemote(ops, time.Hour, ValidateOp); err != nil {
		t.Fatal(err)
	}
	if eff, _ = m.Effective(); zoneOf(eff, "c.test") == nil {
		t.Fatal("replicated zone missing after ApplyRemote")
	}
}
