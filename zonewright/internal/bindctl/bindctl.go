// Package bindctl is the apply engine: it turns validated config into the
// files named reads and asks named to load them, with a "last known-good
// wins" contract mirroring nginxpilot's managed mode:
//
//  1. Each zone is rendered, staged next to its live file and checked with
//     named-checkzone. A zone that fails keeps serving its previous file
//     (state "stale"); one that has never passed is left out of the conf
//     (state "disabled"). Neither blocks the other zones.
//  2. Passing zones are swapped in with rename(2) — named never reads a
//     half-written file — and their serial is bumped only when content moved.
//  3. The named.conf fragment is rendered from the servable zones, checked
//     with named-checkconf and swapped in the same way.
//  4. Files of zones no longer configured are removed.
//  5. If anything on disk changed, `rndc reload` runs once.
package bindctl

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/state"
	"github.com/kalevski/toolcase/zonewright/internal/zonefile"
)

// serialRe finds the serial line Render writes, for recovering a serial from
// a live file when state.json was lost.
var serialRe = regexp.MustCompile(`(?m)^\s+(\d+)\s+; serial$`)

// cmdTimeout bounds each named-checkzone / named-checkconf / rndc run.
const cmdTimeout = 30 * time.Second

// Zone states reported in ApplyResult.
const (
	StateActive   = "active"   // the configured content is live
	StateStale    = "stale"    // the new content failed its check; the previous file is still served
	StateDisabled = "disabled" // no valid file exists; the zone is not loaded
)

// ZoneResult is the outcome of one zone in one apply.
type ZoneResult struct {
	Zone    string `json:"zone"`
	State   string `json:"state"`
	Serial  uint32 `json:"serial,omitempty"`
	Changed bool   `json:"changed"`
	Reason  string `json:"reason,omitempty"`
}

// ApplyResult is the outcome of one apply.
type ApplyResult struct {
	At          time.Time    `json:"at"`
	Zones       []ZoneResult `json:"zones"`
	Changed     bool         `json:"changed"`
	Reloaded    bool         `json:"reloaded"`
	ReloadError string       `json:"reload_error,omitempty"`
	ConfError   string       `json:"conf_error,omitempty"`
}

// Zone returns the result for one zone, or nil.
func (r *ApplyResult) Zone(name string) *ZoneResult {
	for i := range r.Zones {
		if r.Zones[i].Zone == name {
			return &r.Zones[i]
		}
	}
	return nil
}

// Runner executes an external command; swapped in tests.
type Runner func(ctx context.Context, argv []string) (output string, err error)

// ExecRunner runs argv with os/exec and returns combined output.
func ExecRunner(ctx context.Context, argv []string) (string, error) {
	cmd := exec.CommandContext(ctx, argv[0], argv[1:]...)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	err := cmd.Run()
	return strings.TrimSpace(out.String()), err
}

// Engine applies config to disk and named.
type Engine struct {
	log *slog.Logger
	run Runner
	now func() time.Time
}

// New builds an engine that shells out for real.
func New(log *slog.Logger) *Engine {
	return &Engine{log: log, run: ExecRunner, now: time.Now}
}

// NewWithRunner builds an engine with a custom command runner (tests).
func NewWithRunner(log *slog.Logger, run Runner, now func() time.Time) *Engine {
	return &Engine{log: log, run: run, now: now}
}

// Apply converges disk + named on cfg. It returns an error only for failures
// that stopped the apply as a whole (unwritable dirs); per-zone check
// failures and reload errors are reported in the result.
func (e *Engine) Apply(ctx context.Context, cfg *config.Config, store *state.Store) (ApplyResult, error) {
	res := ApplyResult{At: e.now().UTC()}
	if err := os.MkdirAll(cfg.Bind.ZoneDir, 0o750); err != nil {
		return res, fmt.Errorf("create zone_dir: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(cfg.Bind.ConfFile), 0o750); err != nil {
		return res, fmt.Errorf("create conf_file dir: %w", err)
	}

	sweepStaged(cfg)

	var include []zonefile.IncludeZone
	configured := map[string]bool{}
	for i := range cfg.Zones {
		z := &cfg.Zones[i]
		configured[z.Name] = true
		zr := e.applyZone(ctx, cfg, z, store)
		if zr.Changed {
			res.Changed = true
		}
		if zr.State != StateDisabled {
			include = append(include, zonefile.IncludeEntry(cfg, z))
		}
		res.Zones = append(res.Zones, zr)
	}

	confChanged, err := e.applyConf(ctx, cfg, include)
	if err != nil {
		// The previous conf stays live. Zone files already swapped are still
		// fine to serve — named keeps the zone set it last loaded.
		res.ConfError = err.Error()
		e.log.Error("named conf rejected; previous conf kept", "error", err)
	}
	if confChanged {
		res.Changed = true
	}

	// Orphans are only removed once the conf no longer names them.
	if err == nil {
		if e.removeOrphans(cfg, configured, store) {
			res.Changed = true
		}
	}

	if serr := store.Save(); serr != nil {
		e.log.Error("state save failed", "error", serr)
	}

	if res.Changed && len(cfg.Bind.ReloadCmd) > 0 {
		if rerr := e.Reload(ctx, cfg); rerr != nil {
			res.ReloadError = rerr.Error()
		} else {
			res.Reloaded = true
		}
	}
	return res, nil
}

// CheckZone renders z with serial into a scratch file and runs
// check_zone_cmd on it, without touching the live files. Used to vet a
// change before it is committed to the replicated log, where it could no
// longer be rolled back.
func (e *Engine) CheckZone(ctx context.Context, cfg *config.Config, z *config.Zone, serial uint32) error {
	if len(cfg.Bind.CheckZoneCmd) == 0 {
		return nil
	}
	if err := os.MkdirAll(cfg.Bind.ZoneDir, 0o750); err != nil {
		return err
	}
	staged, err := writeTemp(cfg.Bind.ZoneDir, ".stage-check-"+z.Name+"-*", []byte(zonefile.Render(cfg, z, serial)))
	if err != nil {
		return err
	}
	defer os.Remove(staged)
	argv := append(append([]string{}, cfg.Bind.CheckZoneCmd...), z.Name, staged)
	cctx, cancel := context.WithTimeout(ctx, cmdTimeout)
	defer cancel()
	if out, err := e.run(cctx, argv); err != nil {
		return fmt.Errorf("named-checkzone: %v: %s", err, strings.ReplaceAll(out, staged, zonefile.FileName(z.Name)))
	}
	return nil
}

// Reload runs bind.reload_cmd once (no-op when it is disabled).
func (e *Engine) Reload(ctx context.Context, cfg *config.Config) error {
	if len(cfg.Bind.ReloadCmd) == 0 {
		return nil
	}
	cctx, cancel := context.WithTimeout(ctx, cmdTimeout)
	defer cancel()
	out, err := e.run(cctx, cfg.Bind.ReloadCmd)
	if err != nil {
		err = fmt.Errorf("%s: %v %s", strings.Join(cfg.Bind.ReloadCmd, " "), err, out)
		e.log.Error("named reload failed", "error", err)
		return err
	}
	e.log.Info("named reloaded", "output", out)
	return nil
}

func (e *Engine) applyZone(ctx context.Context, cfg *config.Config, z *config.Zone, store *state.Store) ZoneResult {
	zr := ZoneResult{Zone: z.Name}
	live := zonefile.Path(cfg, z.Name)
	_, statErr := os.Stat(live)
	liveExists := statErr == nil
	prev, hasPrev := store.Get(z.Name)
	if !hasPrev && liveExists {
		// No state but a live file (state.json lost or restored separately):
		// continue from the file's serial so it never moves backwards.
		prev.Serial = liveSerial(live)
	}

	fail := func(reason string) ZoneResult {
		zr.Reason = reason
		if liveExists {
			zr.State = StateStale
			zr.Serial = prev.Serial
		} else {
			zr.State = StateDisabled
		}
		e.log.Warn("zone rejected", "zone", z.Name, "state", zr.State, "reason", reason)
		return zr
	}

	if z.Invalid != "" {
		return fail(z.Invalid)
	}

	hash := zonefile.ContentHash(cfg, z)
	serial := prev.Serial
	if !hasPrev || prev.Hash != hash || !liveExists {
		serial = state.NextSerial(prev.Serial, e.now())
	}
	if z.Serial != 0 {
		// Replicated zone: the serial is part of the replicated state, so
		// every node publishes the same one (REPLICATION.md §7).
		serial = z.Serial
	}
	content := []byte(zonefile.Render(cfg, z, serial))

	if z.Serial != 0 && liveExists {
		if cur, err := os.ReadFile(live); err == nil && bytes.Equal(cur, content) {
			zr.State, zr.Serial = StateActive, serial
			return zr
		}
	} else if liveExists && hasPrev && prev.Hash == hash {
		if cur, err := os.ReadFile(live); err == nil && bytes.Equal(cur, content) {
			zr.State, zr.Serial = StateActive, serial
			return zr // unchanged: skip the check and the swap
		}
		// Live file drifted (hand edit, restore from backup): re-publish it
		// under a fresh serial so secondaries notice.
		serial = state.NextSerial(prev.Serial, e.now())
		content = []byte(zonefile.Render(cfg, z, serial))
	}

	staged, err := writeTemp(cfg.Bind.ZoneDir, ".stage-"+z.Name+"-*", content)
	if err != nil {
		return fail("stage zone file: " + err.Error())
	}
	defer os.Remove(staged)

	if len(cfg.Bind.CheckZoneCmd) > 0 {
		argv := append(append([]string{}, cfg.Bind.CheckZoneCmd...), z.Name, staged)
		cctx, cancel := context.WithTimeout(ctx, cmdTimeout)
		out, err := e.run(cctx, argv)
		cancel()
		if err != nil {
			return fail(fmt.Sprintf("named-checkzone: %v: %s", err, strings.ReplaceAll(out, staged, zonefile.FileName(z.Name))))
		}
	}

	if err := swap(staged, live); err != nil {
		return fail("swap zone file: " + err.Error())
	}
	store.Put(z.Name, state.ZoneState{Serial: serial, Hash: hash, UpdatedAt: e.now().UTC()})
	zr.State, zr.Serial, zr.Changed = StateActive, serial, true
	e.log.Info("zone published", "zone", z.Name, "serial", serial)
	return zr
}

func (e *Engine) applyConf(ctx context.Context, cfg *config.Config, zones []zonefile.IncludeZone) (bool, error) {
	content := []byte(zonefile.Include(zones))
	if cur, err := os.ReadFile(cfg.Bind.ConfFile); err == nil && bytes.Equal(cur, content) {
		return false, nil
	}
	dir := filepath.Dir(cfg.Bind.ConfFile)
	staged, err := writeTemp(dir, ".stage-conf-*", content)
	if err != nil {
		return false, err
	}
	defer os.Remove(staged)
	if len(cfg.Bind.CheckConfCmd) > 0 {
		argv := append(append([]string{}, cfg.Bind.CheckConfCmd...), staged)
		cctx, cancel := context.WithTimeout(ctx, cmdTimeout)
		out, err := e.run(cctx, argv)
		cancel()
		if err != nil {
			return false, fmt.Errorf("named-checkconf: %v: %s", err, out)
		}
	}
	if err := swap(staged, cfg.Bind.ConfFile); err != nil {
		return false, err
	}
	return true, nil
}

// removeOrphans deletes <zone>.db files (and state) for zones that are no
// longer configured. Only files matching the zonewright naming are touched.
func (e *Engine) removeOrphans(cfg *config.Config, configured map[string]bool, store *state.Store) bool {
	changed := false
	entries, err := os.ReadDir(cfg.Bind.ZoneDir)
	if err != nil {
		return false
	}
	for _, ent := range entries {
		name := ent.Name()
		zone, ok := strings.CutSuffix(name, ".db")
		if !ok || ent.IsDir() || strings.HasPrefix(name, ".") || configured[zone] {
			continue
		}
		if err := os.Remove(filepath.Join(cfg.Bind.ZoneDir, name)); err != nil && !errors.Is(err, os.ErrNotExist) {
			e.log.Warn("remove orphan zone file failed", "file", name, "error", err)
			continue
		}
		e.log.Info("zone removed", "zone", zone)
		changed = true
	}
	for _, zone := range store.Zones() {
		if !configured[zone] {
			store.Delete(zone)
		}
	}
	return changed
}

// liveSerial extracts the SOA serial from a file zonewright rendered (0 when
// it cannot be found).
func liveSerial(path string) uint32 {
	raw, err := os.ReadFile(path)
	if err != nil {
		return 0
	}
	m := serialRe.FindSubmatch(raw)
	if m == nil {
		return 0
	}
	n, err := strconv.ParseUint(string(m[1]), 10, 32)
	if err != nil {
		return 0
	}
	return uint32(n)
}

// sweepStaged removes stage files a crashed apply left behind.
func sweepStaged(cfg *config.Config) {
	for _, dir := range []string{cfg.Bind.ZoneDir, filepath.Dir(cfg.Bind.ConfFile)} {
		matches, _ := filepath.Glob(filepath.Join(dir, ".stage-*"))
		for _, m := range matches {
			_ = os.Remove(m)
		}
	}
}

// writeTemp writes data to a new 0640 temp file in dir and fsyncs it.
func writeTemp(dir, pattern string, data []byte) (string, error) {
	f, err := os.CreateTemp(dir, pattern)
	if err != nil {
		return "", err
	}
	name := f.Name()
	if _, err := f.Write(data); err != nil {
		f.Close()
		os.Remove(name)
		return "", err
	}
	if err := f.Chmod(0o640); err != nil {
		f.Close()
		os.Remove(name)
		return "", err
	}
	if err := f.Sync(); err != nil {
		f.Close()
		os.Remove(name)
		return "", err
	}
	if err := f.Close(); err != nil {
		os.Remove(name)
		return "", err
	}
	return name, nil
}

// swap renames staged over target and fsyncs the directory.
func swap(staged, target string) error {
	if err := os.Rename(staged, target); err != nil {
		return err
	}
	if d, err := os.Open(filepath.Dir(target)); err == nil {
		_ = d.Sync()
		_ = d.Close()
	}
	return nil
}
