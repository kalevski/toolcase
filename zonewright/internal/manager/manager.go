// Package manager owns the running config and drives the apply engine: once
// at startup, on every reload (SIGHUP or POST /reload), after every local or
// replicated change, and on a retry tick while named has not yet accepted
// the latest apply (e.g. the daemon came up before named did).
//
// Zones come from two places: the config files (local, read-only over the
// API) and the replicated SQLite store (written over the API, synchronized
// between servers). The manager merges them into one effective config.
package manager

import (
	"context"
	"log/slog"
	"sort"
	"sync"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/bindctl"
	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/state"
	"github.com/kalevski/toolcase/zonewright/internal/store"
)

// retryInterval is how often a failed reload is retried.
const retryInterval = 30 * time.Second

// Conflict describes a replicated zone that is not served as stored
// (REPLICATION.md §6).
type Conflict struct {
	Zone   string `json:"zone"`
	Kind   string `json:"kind"` // shadowed | repaired | invalid
	Detail string `json:"detail"`
}

// Manager serializes applies over one live config.
type Manager struct {
	log    *slog.Logger
	state  *state.Store // serials of local (config-file) zones
	repl   *store.Store // replicated zones
	engine *bindctl.Engine

	mu  sync.RWMutex
	cfg *config.Config

	applyMu    sync.Mutex
	last       bindctl.ApplyResult
	hasApplied bool
	needRetry  bool
	conflicts  []Conflict

	// writeMu serializes local writes (read-modify-write over the store).
	writeMu sync.Mutex
	// hooks set by the cluster layer (nil on a single node).
	hooksMu     sync.RWMutex
	onWrite     func(ops []store.Op)
	writesReady func() bool
}

// New builds a manager. Nothing is applied until Run or Apply.
func New(cfg *config.Config, st *state.Store, repl *store.Store, engine *bindctl.Engine, log *slog.Logger) *Manager {
	return &Manager{log: log, state: st, repl: repl, engine: engine, cfg: cfg}
}

// SetClusterHooks wires the cluster layer: onWrite is called with every
// batch of local ops (to nudge peers); ready gates local writes during the
// startup fence.
func (m *Manager) SetClusterHooks(onWrite func([]store.Op), ready func() bool) {
	m.hooksMu.Lock()
	defer m.hooksMu.Unlock()
	m.onWrite, m.writesReady = onWrite, ready
}

// Store returns the replicated store.
func (m *Manager) Store() *store.Store { return m.repl }

// Engine returns the apply engine.
func (m *Manager) Engine() *bindctl.Engine { return m.engine }

// Config returns the running file config. Callers must treat it as read-only.
func (m *Manager) Config() *config.Config {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.cfg
}

// Effective returns the file config with replicated zones merged in, plus
// the conflicts found while merging. A replicated zone shadowed by a local
// zone of the same name is left out; one whose merged state fails
// validation is kept with Invalid set so the engine serves its last good
// file.
func (m *Manager) Effective() (*config.Config, []Conflict) {
	cfg := m.Config()
	eff := *cfg
	eff.Zones = append([]config.Zone(nil), cfg.Zones...)
	var conflicts []Conflict
	zones, err := m.repl.Zones()
	if err != nil {
		m.log.Error("read replicated zones", "error", err)
		return &eff, nil
	}
	for i := range zones {
		rz := &zones[i]
		if cfg.FindZone(rz.Name) >= 0 {
			conflicts = append(conflicts, Conflict{rz.Name, "shadowed", "a zone with this name is declared in a config file; the local zone is served"})
			continue
		}
		for _, r := range rz.Repairs {
			conflicts = append(conflicts, Conflict{rz.Name, "repaired", r})
		}
		z := rz.Config()
		z.File, z.Serial = config.ReplicatedFile, rz.Serial
		if err := config.ValidateZone(&eff, &z); err != nil {
			z.Invalid = "merged state is invalid: " + err.Error()
			conflicts = append(conflicts, Conflict{rz.Name, "invalid", err.Error()})
		}
		eff.Zones = append(eff.Zones, z)
	}
	sort.SliceStable(conflicts, func(i, j int) bool { return conflicts[i].Zone < conflicts[j].Zone })
	return &eff, conflicts
}

// SetConfig swaps the file config without applying.
func (m *Manager) SetConfig(cfg *config.Config) {
	m.mu.Lock()
	m.cfg = cfg
	m.mu.Unlock()
}

// Reload swaps in a new (already validated) file config and applies it.
func (m *Manager) Reload(ctx context.Context, cfg *config.Config) bindctl.ApplyResult {
	m.mu.Lock()
	m.cfg = cfg
	m.mu.Unlock()
	return m.Apply(ctx)
}

// Apply converges disk + named on the effective config.
func (m *Manager) Apply(ctx context.Context) bindctl.ApplyResult {
	m.applyMu.Lock()
	defer m.applyMu.Unlock()
	eff, conflicts := m.Effective()
	res, err := m.engine.Apply(ctx, eff, m.state)
	if err != nil {
		m.log.Error("apply failed", "error", err)
		res.ConfError = err.Error()
	}
	for _, zr := range res.Zones {
		if zr.State != bindctl.StateActive && eff.Zones[eff.FindZone(zr.Zone)].File == config.ReplicatedFile {
			if !hasConflict(conflicts, zr.Zone) {
				conflicts = append(conflicts, Conflict{zr.Zone, "invalid", zr.Reason})
			}
		}
	}
	m.last, m.hasApplied, m.conflicts = res, true, conflicts
	switch {
	case res.ReloadError != "" || err != nil:
		m.needRetry = true
	case res.Reloaded:
		m.needRetry = false
	}
	return res
}

func hasConflict(cs []Conflict, zone string) bool {
	for _, c := range cs {
		if c.Zone == zone {
			return true
		}
	}
	return false
}

// LastApply returns the most recent apply result.
func (m *Manager) LastApply() (bindctl.ApplyResult, bool) {
	m.applyMu.Lock()
	defer m.applyMu.Unlock()
	return m.last, m.hasApplied
}

// Conflicts returns the conflicts found by the last apply.
func (m *Manager) Conflicts() []Conflict {
	m.applyMu.Lock()
	defer m.applyMu.Unlock()
	return append([]Conflict(nil), m.conflicts...)
}

// PendingRetry reports whether named has not accepted the latest apply.
func (m *Manager) PendingRetry() bool {
	m.applyMu.Lock()
	defer m.applyMu.Unlock()
	return m.needRetry
}

// Serial returns the published serial of a zone (0 when never published).
func (m *Manager) Serial(zone string) uint32 {
	if z, ok, _ := m.repl.Zone(zone); ok && m.Config().FindZone(zone) < 0 {
		return z.Serial
	}
	st, _ := m.state.Get(zone)
	return st.Serial
}

// Run applies once, then retries failed reloads until ctx is cancelled.
func (m *Manager) Run(ctx context.Context) {
	m.Apply(ctx)
	t := time.NewTicker(retryInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if m.PendingRetry() {
				m.log.Info("retrying named reload")
				m.retry(ctx)
			}
		}
	}
}

// retry re-applies and, if nothing changed on disk (so the engine skipped
// the reload), forces one — the files are right, named just has not seen them.
func (m *Manager) retry(ctx context.Context) {
	res := m.Apply(ctx)
	if res.Changed {
		return
	}
	m.applyMu.Lock()
	defer m.applyMu.Unlock()
	if err := m.engine.Reload(ctx, m.Config()); err != nil {
		m.last.ReloadError = err.Error()
		m.log.Warn("named reload retry failed", "error", err)
		return
	}
	m.last.Reloaded, m.last.ReloadError = true, ""
	m.needRetry = false
}
