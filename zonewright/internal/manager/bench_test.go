package manager

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/bindctl"
	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/state"
	"github.com/kalevski/toolcase/zonewright/internal/store"
)

// benchManager seeds a manager with many replicated zones (a few of them
// large) the way an API client would: 60 zones of 100 records, 2 of 3000.
// External commands are stubbed, so the numbers are zonewright's own cost.
var (
	benchOnce sync.Once
	benchMgr  *Manager
	benchSeq  int
)

func benchSetup(b *testing.B) *Manager {
	benchOnce.Do(func() {
		dir, _ := filepath.Abs(b.TempDir())
		cfg := &config.Config{DataDir: dir}
		cfg.Defaults.Nameservers = []string{"ns1.example.net"}
		cfg.Bind.CheckZoneCmd, cfg.Bind.CheckConfCmd, cfg.Bind.ReloadCmd = []string{"check"}, []string{"check"}, []string{"reload"}
		cfg.Bind.ZoneDir = filepath.Join(dir, "zones")
		cfg.Bind.ConfFile = filepath.Join(dir, "named.zones.conf")
		config.ApplyDefaults(cfg)
		if err := config.Validate(cfg); err != nil {
			b.Fatal(err)
		}
		log := slog.New(slog.NewTextHandler(io.Discard, nil))
		repl, err := store.Open(filepath.Join(dir, "zw.db"), nil)
		if err != nil {
			b.Fatal(err)
		}
		run := func(context.Context, []string) (string, error) { return "", nil }
		benchMgr = New(cfg, state.NewMemoryStore(), repl, bindctl.NewWithRunner(log, run, time.Now), log)
		for i := 0; i < 62; i++ {
			n := 100
			if i < 2 {
				n = 3000
			}
			z := config.Zone{Name: fmt.Sprintf("zone%03d.test", i)}
			for j := 0; j < n; j++ {
				if j%2 == 0 {
					z.Records = append(z.Records, config.Record{Name: fmt.Sprintf("h%d", j), Type: "A", Value: fmt.Sprintf("10.0.%d.%d", j>>8&255, j&255)})
				} else {
					z.Records = append(z.Records, config.Record{Name: fmt.Sprintf("t%d", j), Type: "TXT", Value: fmt.Sprintf("v=hello %d", j)})
				}
			}
			if _, err := benchMgr.Mutate(context.Background(), z.Name, func(Current) (*config.Zone, error) { return &z, nil }); err != nil {
				b.Fatal(err)
			}
		}
	})
	return benchMgr
}

func benchAdd(b *testing.B, zone string) {
	m := benchSetup(b)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		benchSeq++
		_, err := m.Mutate(context.Background(), zone, func(cur Current) (*config.Zone, error) {
			z := cur.Zone
			z.Records = append(z.Records, config.Record{Name: fmt.Sprintf("w%d", benchSeq), Type: "A", Value: "192.0.2.1"})
			return &z, nil
		})
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkMutateSmallZone(b *testing.B) { benchAdd(b, "zone010.test") }
func BenchmarkMutateBigZone(b *testing.B)   { benchAdd(b, "zone000.test") }

// The read side: every API GET resolves the effective config first.
func BenchmarkEffective(b *testing.B) {
	m := benchSetup(b)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		m.Effective()
	}
}

func BenchmarkETagBigZone(b *testing.B) {
	m := benchSetup(b)
	eff, _ := m.Effective()
	z := &eff.Zones[eff.FindZone("zone001.test")]
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		m.ETag(z)
	}
}
