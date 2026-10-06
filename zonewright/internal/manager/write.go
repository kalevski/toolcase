package manager

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"reflect"
	"slices"
	"strings"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/bindctl"
	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/state"
	"github.com/kalevski/toolcase/zonewright/internal/store"
	"github.com/kalevski/toolcase/zonewright/internal/zonefile"
)

// WriteError is a write refused with an HTTP status.
type WriteError struct {
	Code int
	Msg  string
}

func (e *WriteError) Error() string { return e.Msg }

// Errorf builds a WriteError.
func Errorf(code int, format string, a ...any) *WriteError {
	return &WriteError{code, fmt.Sprintf(format, a...)}
}

// Current is what a mutation function sees: the zone as stored (a private
// copy it may modify), whether it exists, and its ETag.
type Current struct {
	Zone   config.Zone
	Exists bool
	ETag   string
}

// Outcome is the result of a committed write.
type Outcome struct {
	Status string // created | updated | deleted | unchanged
	Ops    []store.Op
	Apply  bindctl.ApplyResult
	Serial uint32
}

// Mutate is the single write path for replicated zones. fn receives the
// current zone and returns the desired one (nil = delete). The change is
// validated, pre-checked with named-checkzone, turned into the minimal set
// of deltas, committed to the replicated log, applied and announced to the
// peers. Nothing is committed when any check fails — a committed delta
// replicates and can no longer be rolled back.
func (m *Manager) Mutate(ctx context.Context, zone string, fn func(cur Current) (*config.Zone, error)) (Outcome, error) {
	m.writeMu.Lock()
	defer m.writeMu.Unlock()

	m.hooksMu.RLock()
	ready, onWrite := m.writesReady, m.onWrite
	m.hooksMu.RUnlock()
	if ready != nil && !ready() {
		return Outcome{}, Errorf(http.StatusServiceUnavailable, "starting up: waiting for peers before accepting writes (startup fence)")
	}

	name, err := config.NormalizeZoneName(zone)
	if err != nil {
		return Outcome{}, Errorf(http.StatusBadRequest, "%v", err)
	}
	cfg := m.Config()
	if i := cfg.FindZone(name); i >= 0 {
		return Outcome{}, Errorf(http.StatusConflict, "zone %s is declared in %s and is read-only over the API", name, cfg.Zones[i].File)
	}

	cur := Current{Zone: config.Zone{Name: name}}
	var gen string
	var curSerial uint32
	if rz, ok, err := m.repl.Zone(name); err != nil {
		return Outcome{}, err
	} else if ok {
		cur.Zone, cur.Exists, gen, curSerial = rz.Config(), true, rz.Generation, rz.Serial
		cur.ETag = m.ETag(&cur.Zone)
	}
	before := config.CloneZone(cur.Zone)

	desired, err := fn(cur)
	if err != nil {
		return Outcome{}, err
	}
	if desired == nil && !cur.Exists {
		return Outcome{}, Errorf(http.StatusNotFound, "zone %s not found", name)
	}

	eff, _ := m.Effective()
	if desired != nil {
		d := config.CloneZone(*desired)
		d.Name = name
		if err := config.ValidateZone(eff, &d); err != nil {
			return Outcome{}, Errorf(http.StatusBadRequest, "zone rejected: %v", err)
		}
		desired = &d
	}

	drafts := Diff(name, before, cur.Exists, gen, desired)
	if len(drafts) == 0 {
		return Outcome{Status: "unchanged", Serial: curSerial}, nil
	}

	if desired != nil {
		probe := *desired
		if err := m.engine.CheckZone(ctx, eff, &probe, curSerial+uint32(len(drafts))); err != nil {
			return Outcome{}, Errorf(http.StatusUnprocessableEntity, "BIND rejected the zone, nothing was changed: %v", err)
		}
	}

	ops, err := m.repl.LocalWrite(drafts)
	if err != nil {
		return Outcome{}, fmt.Errorf("commit: %w", err)
	}
	res := m.Apply(ctx)
	if onWrite != nil {
		onWrite(ops)
	}

	out := Outcome{Ops: ops, Apply: res}
	switch {
	case desired == nil:
		out.Status = "deleted"
	case !cur.Exists:
		out.Status = "created"
	default:
		out.Status = "updated"
	}
	if zr := res.Zone(name); zr != nil {
		out.Serial = zr.Serial
	}
	return out, nil
}

// ETag is a strong validator of a zone's served content (serial excluded).
func (m *Manager) ETag(z *config.Zone) string {
	eff, _ := m.Effective()
	return `"` + zonefile.ContentHash(eff, z)[:20] + `"`
}

type rrKey struct{ name, typ string }

// groupRRsets splits records into RRsets, keeping first-appearance order.
func groupRRsets(recs []config.Record) ([]rrKey, map[rrKey][]config.Record) {
	var order []rrKey
	groups := map[rrKey][]config.Record{}
	for _, r := range recs {
		k := rrKey{r.Name, r.Type}
		if _, ok := groups[k]; !ok {
			order = append(order, k)
		}
		groups[k] = append(groups[k], r)
	}
	return order, groups
}

// Diff computes the minimal drafts turning cur into desired (nil = delete).
func Diff(zone string, cur config.Zone, exists bool, gen string, desired *config.Zone) []store.Draft {
	if desired == nil {
		if !exists {
			return nil
		}
		return []store.Draft{{Kind: store.KindZoneDelete, Zone: zone, Generation: gen, Payload: struct{}{}}}
	}
	var drafts []store.Draft
	settingsGen := gen
	if !exists {
		drafts = append(drafts, store.Draft{Kind: store.KindZoneCreate, Zone: zone, Payload: store.CreatePayload{}})
		settingsGen = store.NewGeneration
	}
	want := store.SettingsOf(desired)
	have := store.Settings{}
	if exists {
		have = store.SettingsOf(&cur)
	}
	if !jsonEqual(want, have) {
		drafts = append(drafts, store.Draft{Kind: store.KindSettings, Zone: zone, Generation: settingsGen, Payload: want})
	}
	order, groups := groupRRsets(desired.Records)
	_, curGroups := groupRRsets(cur.Records)
	if !exists {
		curGroups = nil
	}
	for _, k := range order {
		if old, ok := curGroups[k]; ok && jsonEqual(old, groups[k]) {
			continue
		}
		drafts = append(drafts, store.Draft{Kind: store.KindRRset, Zone: zone, Generation: settingsGen, Name: k.name, Type: k.typ,
			Payload: store.RRsetPayload{Records: groups[k]}})
	}
	curOrder, _ := groupRRsets(cur.Records)
	for _, k := range curOrder {
		if !exists {
			break
		}
		if _, still := groups[k]; !still {
			drafts = append(drafts, store.Draft{Kind: store.KindRRset, Zone: zone, Generation: gen, Name: k.name, Type: k.typ,
				Payload: store.RRsetPayload{Deleted: true}})
		}
	}
	return drafts
}

func jsonEqual(a, b any) bool {
	ja, _ := json.Marshal(a)
	jb, _ := json.Marshal(b)
	return string(ja) == string(jb)
}

// ApplyRemote applies ops pulled from a peer and re-applies BIND when any
// zone changed. Every op is re-validated: a peer's data is never trusted to
// be canonical (REPLICATION.md §8.4).
func (m *Manager) ApplyRemote(ctx context.Context, ops []store.Op, maxFuture time.Duration) (store.RemoteResult, error) {
	res, err := m.repl.ApplyRemote(ops, maxFuture, ValidateOp)
	if err != nil {
		return res, err
	}
	if len(res.Touched) > 0 {
		m.Apply(ctx)
	}
	return res, nil
}

// MergeSnapshot merges a peer snapshot and re-applies.
func (m *Manager) MergeSnapshot(ctx context.Context, snap *store.Snapshot) error {
	for i := range snap.RRsets {
		op := store.Op{Kind: store.KindRRset, Zone: snap.RRsets[i].Zone, Name: snap.RRsets[i].Name, Type: snap.RRsets[i].Type, Payload: snap.RRsets[i].Payload}
		if err := ValidateOp(&op); err != nil {
			return fmt.Errorf("snapshot rejected: %w", err)
		}
	}
	for i := range snap.Settings {
		op := store.Op{Kind: store.KindSettings, Zone: snap.Settings[i].Zone, Payload: snap.Settings[i].Payload}
		if err := ValidateOp(&op); err != nil {
			return fmt.Errorf("snapshot rejected: %w", err)
		}
	}
	for _, z := range snap.Zones {
		if n, err := config.NormalizeZoneName(z.Name); err != nil || n != z.Name {
			return fmt.Errorf("snapshot rejected: zone name %q", z.Name)
		}
	}
	for _, t := range snap.Tokens {
		var p store.TokenPayload
		if err := strictJSON(t.Payload, &p); err != nil {
			return fmt.Errorf("snapshot rejected: token %s: %w", t.Name, err)
		}
		if err := ValidateToken(t.Name, p); err != nil || p.Deleted != t.Deleted || (!t.Deleted && p.Hash != t.Hash) {
			return fmt.Errorf("snapshot rejected: token %s is not canonical", t.Name)
		}
	}
	touched, err := m.repl.MergeSnapshot(snap)
	if err != nil {
		return err
	}
	if len(touched) > 0 {
		m.Apply(ctx)
	}
	return nil
}

// WriteToken commits one change to an API-created token (create, update,
// rotate or, with p.Deleted, delete) through the replicated log and nudges
// the peers. Callers validate p first; ValidateToken is the same check a
// peer runs on the resulting op.
func (m *Manager) WriteToken(name string, p store.TokenPayload) ([]store.Op, error) {
	m.writeMu.Lock()
	defer m.writeMu.Unlock()
	m.hooksMu.RLock()
	ready, onWrite := m.writesReady, m.onWrite
	m.hooksMu.RUnlock()
	if ready != nil && !ready() {
		return nil, Errorf(http.StatusServiceUnavailable, "starting up: waiting for peers before accepting writes (startup fence)")
	}
	if err := ValidateToken(name, p); err != nil {
		return nil, Errorf(http.StatusBadRequest, "%v", err)
	}
	ops, err := m.repl.LocalWrite([]store.Draft{{Kind: store.KindToken, Name: name, Payload: p}})
	if err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	if onWrite != nil {
		onWrite(ops)
	}
	return ops, nil
}

// ValidateToken checks a token register value is well-formed and canonical.
func ValidateToken(name string, p store.TokenPayload) error {
	if !config.ValidTokenName(name) {
		return fmt.Errorf("token name %q must match [a-z0-9-]+ (at most 64 characters)", name)
	}
	if p.Deleted {
		if p.Hash != "" || p.Scope != "" || len(p.Zones) > 0 || p.AllZones || p.Created != "" {
			return errors.New("a deleted token carries no fields")
		}
		return nil
	}
	if len(p.Hash) != 64 || strings.Trim(p.Hash, "0123456789abcdef") != "" {
		return errors.New("token hash must be 64 lowercase hex characters")
	}
	if p.Scope != config.ScopeACME {
		return fmt.Errorf("scope %q is not supported (only %q)", p.Scope, config.ScopeACME)
	}
	if p.AllZones && len(p.Zones) > 0 {
		return errors.New("a token has zones or all_zones, not both")
	}
	zones, err := config.NormalizeTokenZones(p.Zones)
	if err != nil {
		return err
	}
	if !slices.Equal(zones, p.Zones) {
		return errors.New("token zones are not canonical")
	}
	if _, err := time.Parse(time.RFC3339, p.Created); err != nil {
		return fmt.Errorf("token created time: %v", err)
	}
	return nil
}

// ValidateOp checks that an op received from a peer is well-formed AND
// already canonical: normalizing it must not change it. Rewriting a peer's
// op instead would make nodes store different content for the same op id.
func ValidateOp(op *store.Op) error {
	if op.Kind == store.KindToken {
		if op.Zone != "" || op.Generation != "" || op.Type != "" {
			return errors.New("a token op carries no zone, generation or type")
		}
		var p store.TokenPayload
		if err := strictJSON(op.Payload, &p); err != nil {
			return err
		}
		return ValidateToken(op.Name, p)
	}
	name, err := config.NormalizeZoneName(op.Zone)
	if err != nil || name != op.Zone {
		return fmt.Errorf("zone name %q is not canonical", op.Zone)
	}
	switch op.Kind {
	case store.KindZoneCreate:
		var p store.CreatePayload
		return strictJSON(op.Payload, &p)
	case store.KindZoneDelete:
		return nil
	case store.KindSettings:
		var p store.Settings
		if err := strictJSON(op.Payload, &p); err != nil {
			return err
		}
		z := config.Zone{Name: op.Zone, TTL: p.TTL, SOA: p.SOA, Nameservers: append([]string(nil), p.Nameservers...),
			AllowTransfer: append([]string(nil), p.AllowTransfer...), AlsoNotify: append([]string(nil), p.AlsoNotify...)}
		if err := config.NormalizeSettings(&z); err != nil {
			return err
		}
		if !jsonEqual(store.SettingsOf(&z), p) {
			return errors.New("settings are not canonical")
		}
		return nil
	case store.KindRRset:
		var p store.RRsetPayload
		if err := strictJSON(op.Payload, &p); err != nil {
			return err
		}
		if len(p.Records) > 10000 {
			return errors.New("rrset too large")
		}
		for i := range p.Records {
			r := p.Records[i]
			norm := r
			if err := config.NormalizeRecord(&norm, op.Zone); err != nil {
				return fmt.Errorf("record %d: %w", i, err)
			}
			if !reflect.DeepEqual(norm, r) || r.Name != op.Name || r.Type != op.Type {
				return fmt.Errorf("record %d is not canonical or not part of the %s %s RRset", i, op.Name, op.Type)
			}
		}
		return nil
	default:
		return fmt.Errorf("unknown op kind %q", op.Kind)
	}
}

func strictJSON(raw []byte, out any) error {
	dec := json.NewDecoder(bytesReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(out); err != nil {
		return fmt.Errorf("payload: %w", err)
	}
	return nil
}

// MigrateFragments imports the zones.d/<zone>.yml fragments written by the
// pre-SQLite admin API into the replicated store, once (REPLICATION.md §10).
// It only runs when a pre-SQLite deployment is detected (legacyState: a
// state.json existed before this start), so hand-written zone files on a
// fresh install stay local as documented. Serials continue from the old
// state so they never move backwards. Returns the migrated zone names; the
// caller must reload the file config afterwards.
func (m *Manager) MigrateFragments(legacyState bool, serials *state.Store) ([]string, error) {
	if done, _ := m.repl.GetMeta("migrated_fragments"); done != "" {
		return nil, nil
	}
	var migrated []string
	if legacyState {
		cfg := m.Config()
		for _, z := range cfg.Zones {
			path, ok := config.FragmentPath(cfg, z.Name)
			if !ok || z.File != path {
				continue
			}
			if _, exists, _ := m.repl.Zone(z.Name); exists {
				continue
			}
			drafts := Diff(z.Name, config.Zone{}, false, "", &z)
			st, _ := serials.Get(z.Name)
			drafts[0].Payload = store.CreatePayload{Base: st.Serial}
			if _, err := m.repl.LocalWrite(drafts); err != nil {
				return migrated, fmt.Errorf("migrate %s: %w", z.Name, err)
			}
			if err := os.Rename(path, path+".migrated"); err != nil {
				return migrated, fmt.Errorf("migrate %s: %w", z.Name, err)
			}
			migrated = append(migrated, z.Name)
		}
	}
	return migrated, m.repl.SetMeta("migrated_fragments", time.Now().UTC().Format(time.RFC3339))
}

// ETagOf is ETag for a zone taken from eff (a result of Effective), memoized
// per zone: a replicated zone's ETag stays valid while its store change stamp
// is the one its cached view was built from, a file-declared zone's while the
// file config is. Values are identical to ETag's. When eff is no longer the
// current effective config the answer is computed without the cache.
func (m *Manager) ETagOf(eff *config.Config, z *config.Zone) string {
	m.effMu.Lock()
	c := m.effc
	if c == nil || c.eff != eff {
		m.effMu.Unlock()
		return `"` + zonefile.ContentHash(eff, z)[:20] + `"`
	}
	var ez *effZone
	if z.File == config.ReplicatedFile {
		ez = c.zones[z.Name]
	}
	var hit string
	if ez != nil {
		hit = ez.etag
	} else {
		hit = c.local[z.Name]
	}
	m.effMu.Unlock()
	if hit != "" {
		return hit
	}
	etag := `"` + zonefile.ContentHash(eff, z)[:20] + `"`
	m.effMu.Lock()
	if m.effc == c { // still the same generation: ez/local are still current
		if ez != nil {
			ez.etag = etag
		} else {
			c.local[z.Name] = etag
		}
	}
	m.effMu.Unlock()
	return etag
}
