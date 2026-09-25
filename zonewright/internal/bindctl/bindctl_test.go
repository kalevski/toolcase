package bindctl

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/state"
	"github.com/kalevski/toolcase/zonewright/internal/zonefile"
)

// fakeBind records commands and fails named-checkzone for zones in reject.
type fakeBind struct {
	mu       sync.Mutex
	calls    []string
	reject   map[string]bool
	reloadOK bool
}

func (f *fakeBind) run(_ context.Context, argv []string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls = append(f.calls, argv[0])
	switch argv[0] {
	case "checkzone":
		if f.reject[argv[1]] {
			return "zone " + argv[1] + ": bad record", errors.New("exit status 1")
		}
	case "reload":
		if !f.reloadOK {
			return "rndc: connect failed", errors.New("exit status 1")
		}
	}
	return "", nil
}

func (f *fakeBind) count(cmd string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	n := 0
	for _, c := range f.calls {
		if c == cmd {
			n++
		}
	}
	return n
}

var testNow = time.Date(2026, 9, 25, 12, 0, 0, 0, time.UTC)

func setup(t *testing.T, zones ...config.Zone) (*config.Config, *Engine, *fakeBind, *state.Store) {
	t.Helper()
	dir := t.TempDir()
	cfg := &config.Config{DataDir: dir, Zones: zones}
	cfg.Defaults.Nameservers = []string{"ns1.example.net"}
	cfg.Bind.CheckZoneCmd = []string{"checkzone"}
	cfg.Bind.CheckConfCmd = []string{"checkconf"}
	cfg.Bind.ReloadCmd = []string{"reload"}
	config.ApplyDefaults(cfg)
	if err := config.Validate(cfg); err != nil {
		t.Fatal(err)
	}
	fb := &fakeBind{reject: map[string]bool{}, reloadOK: true}
	store, err := state.NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	eng := NewWithRunner(slog.New(slog.NewTextHandler(io.Discard, nil)), fb.run, func() time.Time { return testNow })
	return cfg, eng, fb, store
}

func zone(name string, ips ...string) config.Zone {
	z := config.Zone{Name: name}
	for _, ip := range ips {
		z.Records = append(z.Records, config.Record{Name: "www", Type: "A", Value: ip})
	}
	return z
}

func TestApplyPublishesAndIsIdempotent(t *testing.T) {
	cfg, eng, fb, store := setup(t, zone("example.com", "192.0.2.1"))
	res, err := eng.Apply(context.Background(), cfg, store)
	if err != nil {
		t.Fatal(err)
	}
	zr := res.Zone("example.com")
	if zr.State != StateActive || zr.Serial != 2026092500 || !res.Reloaded {
		t.Fatalf("first apply: %+v %+v", zr, res)
	}
	body, _ := os.ReadFile(zonefile.Path(cfg, "example.com"))
	if !strings.Contains(string(body), "www\t3600\tIN\tA\t192.0.2.1") {
		t.Fatalf("zone file:\n%s", body)
	}
	conf, _ := os.ReadFile(cfg.Bind.ConfFile)
	if !strings.Contains(string(conf), `zone "example.com"`) {
		t.Fatalf("conf:\n%s", conf)
	}

	// Second apply with no change: no check, no reload, same serial.
	res, _ = eng.Apply(context.Background(), cfg, store)
	if res.Changed || res.Reloaded || res.Zone("example.com").Serial != 2026092500 {
		t.Fatalf("no-op apply changed something: %+v", res)
	}
	if fb.count("checkzone") != 1 || fb.count("reload") != 1 {
		t.Fatalf("calls: %v", fb.calls)
	}
}

func TestApplyBumpsSerialOnChange(t *testing.T) {
	cfg, eng, _, store := setup(t, zone("example.com", "192.0.2.1"))
	_, _ = eng.Apply(context.Background(), cfg, store)
	cfg.Zones[0].Records[0].Value = "192.0.2.2"
	res, _ := eng.Apply(context.Background(), cfg, store)
	if got := res.Zone("example.com").Serial; got != 2026092501 {
		t.Fatalf("serial = %d, want 2026092501", got)
	}
}

// A zone that fails named-checkzone keeps serving its last good file; a new
// one that fails is left out of the conf. Neither blocks other zones.
func TestApplyQuarantine(t *testing.T) {
	cfg, eng, fb, store := setup(t, zone("good.com", "192.0.2.1"), zone("old.com", "192.0.2.1"))
	_, _ = eng.Apply(context.Background(), cfg, store)

	cfg.Zones[1].Records[0].Value = "192.0.2.9"
	cfg.Zones = append(cfg.Zones, zone("new.com", "192.0.2.1"))
	fb.reject["old.com"] = true
	fb.reject["new.com"] = true
	res, _ := eng.Apply(context.Background(), cfg, store)

	if s := res.Zone("good.com").State; s != StateActive {
		t.Errorf("good.com: %s", s)
	}
	old := res.Zone("old.com")
	if old.State != StateStale || old.Serial != 2026092500 || !strings.Contains(old.Reason, "bad record") {
		t.Errorf("old.com: %+v", old)
	}
	if body, _ := os.ReadFile(zonefile.Path(cfg, "old.com")); !strings.Contains(string(body), "192.0.2.1") {
		t.Errorf("old.com lost its last known-good file:\n%s", body)
	}
	if s := res.Zone("new.com").State; s != StateDisabled {
		t.Errorf("new.com: %s", s)
	}
	conf, _ := os.ReadFile(cfg.Bind.ConfFile)
	if strings.Contains(string(conf), "new.com") || !strings.Contains(string(conf), "old.com") {
		t.Errorf("conf should keep old.com and omit new.com:\n%s", conf)
	}
	if _, err := os.Stat(zonefile.Path(cfg, "new.com")); err == nil {
		t.Error("rejected new zone must not be written")
	}
	leftovers, _ := filepath.Glob(filepath.Join(cfg.Bind.ZoneDir, ".stage-*"))
	if len(leftovers) != 0 {
		t.Errorf("stage files left behind: %v", leftovers)
	}
}

func TestApplyRemovesOrphans(t *testing.T) {
	cfg, eng, _, store := setup(t, zone("a.com", "192.0.2.1"), zone("b.com", "192.0.2.1"))
	_, _ = eng.Apply(context.Background(), cfg, store)
	cfg.Zones = cfg.Zones[:1]
	res, _ := eng.Apply(context.Background(), cfg, store)
	if !res.Reloaded {
		t.Fatal("removing a zone must reload")
	}
	if _, err := os.Stat(zonefile.Path(cfg, "b.com")); !os.IsNotExist(err) {
		t.Fatal("orphan zone file not removed")
	}
	if _, ok := store.Get("b.com"); ok {
		t.Fatal("orphan state not removed")
	}
}

func TestApplyReportsReloadError(t *testing.T) {
	cfg, eng, fb, store := setup(t, zone("example.com", "192.0.2.1"))
	fb.reloadOK = false
	res, _ := eng.Apply(context.Background(), cfg, store)
	if res.Reloaded || !strings.Contains(res.ReloadError, "connect failed") {
		t.Fatalf("%+v", res)
	}
	if res.Zone("example.com").State != StateActive {
		t.Fatal("files are still published when named is down")
	}
}

// Losing state.json must not move a live zone's serial backwards.
func TestApplyRecoversSerialFromLiveFile(t *testing.T) {
	cfg, eng, _, store := setup(t, zone("example.com", "192.0.2.1"))
	_, _ = eng.Apply(context.Background(), cfg, store)
	cfg.Zones[0].Records[0].Value = "192.0.2.2"
	_, _ = eng.Apply(context.Background(), cfg, store) // serial ...01

	fresh := state.NewMemoryStore()
	cfg.Zones[0].Records[0].Value = "192.0.2.3"
	res, _ := eng.Apply(context.Background(), cfg, fresh)
	if got := res.Zone("example.com").Serial; got != 2026092502 {
		t.Fatalf("serial = %d, want 2026092502 (continuing from the live file)", got)
	}
}

// A hand-edited live file is re-published under a fresh serial.
func TestApplyRepairsDrift(t *testing.T) {
	cfg, eng, _, store := setup(t, zone("example.com", "192.0.2.1"))
	_, _ = eng.Apply(context.Background(), cfg, store)
	path := zonefile.Path(cfg, "example.com")
	if err := os.WriteFile(path, []byte("garbage"), 0o640); err != nil {
		t.Fatal(err)
	}
	res, _ := eng.Apply(context.Background(), cfg, store)
	if !res.Changed || res.Zone("example.com").Serial != 2026092501 {
		t.Fatalf("%+v", res)
	}
	if body, _ := os.ReadFile(path); !strings.Contains(string(body), "192.0.2.1") {
		t.Fatal("drift not repaired")
	}
}
