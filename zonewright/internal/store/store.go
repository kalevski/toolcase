// Package store is zonewright's replicated state: an append-only log of
// deltas (ops) in SQLite plus materialized "winner" tables, as specified in
// REPLICATION.md §4–§7 and §11.
//
// The replicated state is a set of last-writer-wins registers:
//
//	zone     (name)                          exists? + generation + serial base
//	settings (zone, generation)              ttl, soa, nameservers, acls
//	rrset    (zone, generation, name, type)  records[] or deleted
//	token    (name)                          API-created scoped token (hash, scope, zones) or deleted
//
// Each register keeps the value written by the op with the highest
// (hlc, origin). That comparison is a pure function of the op, so applying
// the same set of ops in any order, with duplicates, yields identical tables
// on every node — the convergence guarantee.
package store

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"

	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/hlc"
)

// Op kinds.
const (
	KindZoneCreate = "zone_create"
	KindZoneDelete = "zone_delete"
	KindSettings   = "settings"
	KindRRset      = "rrset"
	// KindToken ops carry no zone: Zone and Generation are empty, Name is
	// the token name. They do not count towards any zone's serial.
	KindToken = "token"
)

// NewGeneration, as a Draft's Generation, refers to the zone_create earlier
// in the same LocalWrite batch.
const NewGeneration = "\x00new"

// ErrSnapshotRequired means the requested ops were compacted away.
var ErrSnapshotRequired = errors.New("ops already compacted: snapshot required")

// Op is one delta. Identity is (Origin, Seq); ops are immutable.
type Op struct {
	Origin     string          `json:"origin"`
	Seq        int64           `json:"seq"`
	HLC        hlc.Timestamp   `json:"hlc"`
	Kind       string          `json:"kind"`
	Zone       string          `json:"zone"`
	Generation string          `json:"generation,omitempty"`
	Name       string          `json:"name,omitempty"`
	Type       string          `json:"type,omitempty"`
	Payload    json.RawMessage `json:"payload"`
}

// ID is the op's global identity, "origin:seq".
func (o *Op) ID() string { return OpID(o.Origin, o.Seq) }

// OpID formats an op identity.
func OpID(origin string, seq int64) string { return origin + ":" + strconv.FormatInt(seq, 10) }

// Draft is a local change before it becomes an Op.
type Draft struct {
	Kind       string
	Zone       string
	Generation string // current generation, or NewGeneration
	Name, Type string
	Payload    any
}

// CreatePayload is the zone_create payload.
type CreatePayload struct {
	Base uint32 `json:"base"`
}

// RRsetPayload is the rrset payload. Deleted is a tombstone.
type RRsetPayload struct {
	Records []config.Record `json:"records,omitempty"`
	Deleted bool            `json:"deleted,omitempty"`
}

// Settings is the replicated per-zone configuration.
type Settings struct {
	TTL           config.TTL `json:"ttl,omitempty"`
	SOA           config.SOA `json:"soa,omitzero"`
	Nameservers   []string   `json:"nameservers,omitempty"`
	AllowTransfer []string   `json:"allow_transfer,omitempty"`
	AlsoNotify    []string   `json:"also_notify,omitempty"`
}

// SettingsOf extracts the replicated settings from a zone.
func SettingsOf(z *config.Zone) Settings {
	return Settings{TTL: z.TTL, SOA: z.SOA, Nameservers: z.Nameservers, AllowTransfer: z.AllowTransfer, AlsoNotify: z.AlsoNotify}
}

// Zone is a replicated zone as currently visible.
type Zone struct {
	Name       string
	Generation string
	Serial     uint32
	Settings   Settings
	Records    []config.Record
	// Repairs lists deterministic conflict repairs applied while building
	// this view (REPLICATION.md §6).
	Repairs []string
}

// Config converts the view into a config.Zone for validation and rendering.
func (z *Zone) Config() config.Zone {
	return config.CloneZone(config.Zone{
		Name: z.Name, TTL: z.Settings.TTL, SOA: z.Settings.SOA,
		Nameservers: z.Settings.Nameservers, AllowTransfer: z.Settings.AllowTransfer,
		AlsoNotify: z.Settings.AlsoNotify, Records: z.Records,
	})
}

// Store is the SQLite-backed replicated state. Safe for concurrent use.
type Store struct {
	db     *sql.DB
	mu     sync.Mutex // serializes writers
	nodeID string
	clock  *hlc.Clock
	now    func() time.Time
}

const schema = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ops (
  origin TEXT NOT NULL, seq INTEGER NOT NULL, hlc INTEGER NOT NULL,
  kind TEXT NOT NULL, zone TEXT NOT NULL, generation TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT '', payload BLOB NOT NULL,
  PRIMARY KEY (origin, seq));
CREATE INDEX IF NOT EXISTS ops_hlc ON ops (hlc);
CREATE TABLE IF NOT EXISTS vv (origin TEXT PRIMARY KEY, seq INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS floor (origin TEXT PRIMARY KEY, seq INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS zones (
  name TEXT PRIMARY KEY, exists_flag INTEGER NOT NULL, generation TEXT NOT NULL, base INTEGER NOT NULL,
  hlc INTEGER NOT NULL, origin TEXT NOT NULL, seq INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings (
  zone TEXT NOT NULL, generation TEXT NOT NULL, payload BLOB NOT NULL,
  hlc INTEGER NOT NULL, origin TEXT NOT NULL, seq INTEGER NOT NULL,
  PRIMARY KEY (zone, generation));
CREATE TABLE IF NOT EXISTS rrsets (
  zone TEXT NOT NULL, generation TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL,
  payload BLOB NOT NULL, deleted INTEGER NOT NULL,
  hlc INTEGER NOT NULL, origin TEXT NOT NULL, seq INTEGER NOT NULL,
  PRIMARY KEY (zone, generation, name, type));
CREATE TABLE IF NOT EXISTS tokens (
  name TEXT PRIMARY KEY, hash TEXT NOT NULL, payload BLOB NOT NULL, deleted INTEGER NOT NULL,
  hlc INTEGER NOT NULL, origin TEXT NOT NULL, seq INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS tokens_hash ON tokens (hash);
CREATE TABLE IF NOT EXISTS counters (
  zone TEXT NOT NULL, generation TEXT NOT NULL, count INTEGER NOT NULL,
  PRIMARY KEY (zone, generation));
`

// Open opens (creating if needed) the database at path. A new database gets
// a freshly generated node id — every deployment has its own (§8.1).
func Open(path string, now func() time.Time) (*Store, error) {
	if now == nil {
		now = time.Now
	}
	db, err := sql.Open("sqlite", "file:"+path+"?_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1) // one connection: SQLite has one writer anyway
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("init schema: %w", err)
	}
	s := &Store{db: db, now: now}
	id, err := s.GetMeta("node_id")
	if err != nil {
		db.Close()
		return nil, err
	}
	if id == "" {
		b := make([]byte, 16)
		if _, err := rand.Read(b); err != nil {
			db.Close()
			return nil, err
		}
		id = "n-" + hex.EncodeToString(b)
		if err := s.SetMeta("node_id", id); err != nil {
			db.Close()
			return nil, err
		}
	}
	s.nodeID = id
	last, _ := s.GetMeta("hlc")
	n, _ := strconv.ParseUint(last, 10, 64)
	s.clock = hlc.New(hlc.Timestamp(n), now)
	return s, nil
}

// Close closes the database.
func (s *Store) Close() error { return s.db.Close() }

// NodeID is this deployment's generated identity.
func (s *Store) NodeID() string { return s.nodeID }

// Clock returns the node's HLC.
func (s *Store) Clock() *hlc.Clock { return s.clock }

// GetMeta reads a meta key ("" when absent).
func (s *Store) GetMeta(key string) (string, error) {
	var v string
	err := s.db.QueryRow(`SELECT value FROM meta WHERE key = ?`, key).Scan(&v)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return v, err
}

// SetMeta writes a meta key.
func (s *Store) SetMeta(key, value string) error {
	_, err := s.db.Exec(`INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value)
	return err
}

// VV returns the version vector: highest contiguous seq applied per origin.
func (s *Store) VV() (map[string]int64, error) {
	return readSeqMap(s.db, `SELECT origin, seq FROM vv`)
}

// Floors returns, per origin, the highest seq no longer held in the log.
func (s *Store) Floors() (map[string]int64, error) {
	return readSeqMap(s.db, `SELECT origin, seq FROM floor`)
}

type querier interface {
	Query(query string, args ...any) (*sql.Rows, error)
	QueryRow(query string, args ...any) *sql.Row
	Exec(query string, args ...any) (sql.Result, error)
}

func readSeqMap(q querier, query string) (map[string]int64, error) {
	rows, err := q.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int64{}
	for rows.Next() {
		var o string
		var n int64
		if err := rows.Scan(&o, &n); err != nil {
			return nil, err
		}
		out[o] = n
	}
	return out, rows.Err()
}

// wins reports whether (h1, o1) beats the stored (h2, o2).
func wins(h1 hlc.Timestamp, o1 string, h2 hlc.Timestamp, o2 string) bool {
	if h1 != h2 {
		return h1 > h2
	}
	return o1 > o2
}

// LocalWrite turns drafts into ops (assigning seq and HLC), appends them to
// the log and applies them, atomically. It returns the new ops.
func (s *Store) LocalWrite(drafts []Draft) ([]Op, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var seq int64
	_ = tx.QueryRow(`SELECT seq FROM vv WHERE origin = ?`, s.nodeID).Scan(&seq)
	newGen := map[string]string{}
	var out []Op
	for _, d := range drafts {
		seq++
		op := Op{Origin: s.nodeID, Seq: seq, HLC: s.clock.Now(), Kind: d.Kind, Zone: d.Zone, Name: d.Name, Type: d.Type}
		switch {
		case d.Kind == KindZoneCreate:
			op.Generation = op.ID()
			newGen[d.Zone] = op.Generation
			cp, _ := d.Payload.(CreatePayload)
			if cp.Base == 0 {
				cp.Base = s.nextBase(tx, d.Zone)
			}
			d.Payload = cp
		case d.Generation == NewGeneration:
			op.Generation = newGen[d.Zone]
			if op.Generation == "" {
				return nil, fmt.Errorf("draft for %s references a new generation without a zone_create", d.Zone)
			}
		default:
			op.Generation = d.Generation
		}
		raw, err := json.Marshal(d.Payload)
		if err != nil {
			return nil, err
		}
		op.Payload = raw
		if _, err := insertAndApply(tx, &op); err != nil {
			return nil, err
		}
		out = append(out, op)
	}
	if err := setMetaTx(tx, "hlc", strconv.FormatUint(uint64(s.clock.Last()), 10)); err != nil {
		return nil, err
	}
	return out, tx.Commit()
}

// nextBase is the serial base for a (re)created zone: today's YYYYMMDD00, or
// one past the zone's last published serial if that is higher, so a deleted
// and re-created zone never publishes a lower serial.
func (s *Store) nextBase(q querier, zone string) uint32 {
	y, m, d := s.now().UTC().Date()
	base := uint32(y*1000000 + int(m)*10000 + d*100)
	var gen string
	var b int64
	if err := q.QueryRow(`SELECT generation, base FROM zones WHERE name = ?`, zone).Scan(&gen, &b); err == nil && gen != "" {
		var n int64
		_ = q.QueryRow(`SELECT count FROM counters WHERE zone = ? AND generation = ?`, zone, gen).Scan(&n)
		if last := uint32(b + n); last >= base {
			base = last + 1
		}
	}
	return base
}

func setMetaTx(tx *sql.Tx, key, value string) error {
	_, err := tx.Exec(`INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value)
	return err
}

// insertAndApply appends op to the log (no-op if already present), advances
// the version vector, bumps the serial counter and updates the winner
// register. Returns false when the op was a duplicate.
func insertAndApply(tx *sql.Tx, op *Op) (bool, error) {
	res, err := tx.Exec(`INSERT OR IGNORE INTO ops(origin, seq, hlc, kind, zone, generation, name, type, payload) VALUES(?,?,?,?,?,?,?,?,?)`,
		op.Origin, op.Seq, int64(op.HLC), op.Kind, op.Zone, op.Generation, op.Name, op.Type, []byte(op.Payload))
	if err != nil {
		return false, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return false, nil
	}
	if _, err := tx.Exec(`INSERT INTO vv(origin, seq) VALUES(?, ?) ON CONFLICT(origin) DO UPDATE SET seq = MAX(seq, excluded.seq)`, op.Origin, op.Seq); err != nil {
		return false, err
	}
	if op.Kind != KindToken {
		if _, err := tx.Exec(`INSERT INTO counters(zone, generation, count) VALUES(?, ?, 1) ON CONFLICT(zone, generation) DO UPDATE SET count = count + 1`, op.Zone, op.Generation); err != nil {
			return false, err
		}
	}
	return true, applyRegister(tx, op)
}

func applyRegister(tx *sql.Tx, op *Op) error {
	var curH int64
	var curO string
	switch op.Kind {
	case KindZoneCreate, KindZoneDelete:
		err := tx.QueryRow(`SELECT hlc, origin FROM zones WHERE name = ?`, op.Zone).Scan(&curH, &curO)
		if err == nil && !wins(op.HLC, op.Origin, hlc.Timestamp(curH), curO) {
			return nil
		}
		exists, gen, base := 0, "", int64(0)
		if op.Kind == KindZoneCreate {
			var cp CreatePayload
			if err := json.Unmarshal(op.Payload, &cp); err != nil {
				return fmt.Errorf("op %s: %w", op.ID(), err)
			}
			exists, gen, base = 1, op.Generation, int64(cp.Base)
		} else {
			// A delete keeps the last generation + base so a re-create can
			// continue the serial sequence.
			_ = tx.QueryRow(`SELECT generation, base FROM zones WHERE name = ?`, op.Zone).Scan(&gen, &base)
		}
		_, err = tx.Exec(`INSERT INTO zones(name, exists_flag, generation, base, hlc, origin, seq) VALUES(?,?,?,?,?,?,?)
			ON CONFLICT(name) DO UPDATE SET exists_flag=excluded.exists_flag, generation=excluded.generation, base=excluded.base,
			hlc=excluded.hlc, origin=excluded.origin, seq=excluded.seq`,
			op.Zone, exists, gen, base, int64(op.HLC), op.Origin, op.Seq)
		return err
	case KindSettings:
		err := tx.QueryRow(`SELECT hlc, origin FROM settings WHERE zone = ? AND generation = ?`, op.Zone, op.Generation).Scan(&curH, &curO)
		if err == nil && !wins(op.HLC, op.Origin, hlc.Timestamp(curH), curO) {
			return nil
		}
		_, err = tx.Exec(`INSERT INTO settings(zone, generation, payload, hlc, origin, seq) VALUES(?,?,?,?,?,?)
			ON CONFLICT(zone, generation) DO UPDATE SET payload=excluded.payload, hlc=excluded.hlc, origin=excluded.origin, seq=excluded.seq`,
			op.Zone, op.Generation, []byte(op.Payload), int64(op.HLC), op.Origin, op.Seq)
		return err
	case KindRRset:
		err := tx.QueryRow(`SELECT hlc, origin FROM rrsets WHERE zone = ? AND generation = ? AND name = ? AND type = ?`,
			op.Zone, op.Generation, op.Name, op.Type).Scan(&curH, &curO)
		if err == nil && !wins(op.HLC, op.Origin, hlc.Timestamp(curH), curO) {
			return nil
		}
		var p RRsetPayload
		if err := json.Unmarshal(op.Payload, &p); err != nil {
			return fmt.Errorf("op %s: %w", op.ID(), err)
		}
		deleted := 0
		if p.Deleted || len(p.Records) == 0 {
			deleted = 1
		}
		_, err = tx.Exec(`INSERT INTO rrsets(zone, generation, name, type, payload, deleted, hlc, origin, seq) VALUES(?,?,?,?,?,?,?,?,?)
			ON CONFLICT(zone, generation, name, type) DO UPDATE SET payload=excluded.payload, deleted=excluded.deleted,
			hlc=excluded.hlc, origin=excluded.origin, seq=excluded.seq`,
			op.Zone, op.Generation, op.Name, op.Type, []byte(op.Payload), deleted, int64(op.HLC), op.Origin, op.Seq)
		return err
	case KindToken:
		return applyToken(tx, op)
	default:
		return fmt.Errorf("op %s: unknown kind %q", op.ID(), op.Kind)
	}
}

// RemoteResult summarizes an ApplyRemote call.
type RemoteResult struct {
	Applied int
	Touched []string // zones whose state may have changed
	Held    int      // ops held back by the clock guard
}

// ApplyRemote applies ops received from a peer. Ops must arrive in seq order
// per origin; an op that would leave a gap stops that origin for this batch
// (the next pull resumes). An op stamped more than maxFuture ahead of the
// local wall clock is held — a broken clock must not win every conflict
// (§8.4). validate re-checks each op's content; a failing op is an error.
func (s *Store) ApplyRemote(ops []Op, maxFuture time.Duration, validate func(*Op) error) (RemoteResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var res RemoteResult
	tx, err := s.db.Begin()
	if err != nil {
		return res, err
	}
	defer tx.Rollback()

	vv, err := readSeqMap(tx, `SELECT origin, seq FROM vv`)
	if err != nil {
		return res, err
	}
	limit := hlc.FromTime(s.now().Add(maxFuture))
	stopped := map[string]bool{}
	touched := map[string]bool{}
	for i := range ops {
		op := &ops[i]
		if stopped[op.Origin] || op.Seq <= vv[op.Origin] {
			continue
		}
		if op.Seq != vv[op.Origin]+1 {
			stopped[op.Origin] = true
			continue
		}
		if op.HLC > limit {
			stopped[op.Origin] = true
			res.Held++
			continue
		}
		if validate != nil {
			if err := validate(op); err != nil {
				return RemoteResult{}, fmt.Errorf("op %s rejected: %w", op.ID(), err)
			}
		}
		fresh, err := insertAndApply(tx, op)
		if err != nil {
			return RemoteResult{}, err
		}
		vv[op.Origin] = op.Seq
		if fresh {
			res.Applied++
			if op.Zone != "" {
				touched[op.Zone] = true
			}
			s.clock.Observe(op.HLC)
		}
	}
	if err := setMetaTx(tx, "hlc", strconv.FormatUint(uint64(s.clock.Last()), 10)); err != nil {
		return RemoteResult{}, err
	}
	if err := tx.Commit(); err != nil {
		return RemoteResult{}, err
	}
	for z := range touched {
		res.Touched = append(res.Touched, z)
	}
	sort.Strings(res.Touched)
	return res, nil
}

// OpsSince returns ops a peer with version vector `since` has not seen, in
// (origin, seq) order, at most limit. more reports whether ops remain.
// Returns ErrSnapshotRequired when some needed op was compacted away.
func (s *Store) OpsSince(since map[string]int64, limit int) (ops []Op, more bool, err error) {
	vv, err := s.VV()
	if err != nil {
		return nil, false, err
	}
	floors, err := s.Floors()
	if err != nil {
		return nil, false, err
	}
	origins := make([]string, 0, len(vv))
	for o := range vv {
		origins = append(origins, o)
	}
	sort.Strings(origins)
	for _, o := range origins {
		if vv[o] <= since[o] {
			continue
		}
		if since[o] < floors[o] {
			return nil, false, ErrSnapshotRequired
		}
		if len(ops) >= limit {
			return ops, true, nil
		}
		rows, err := s.db.Query(`SELECT origin, seq, hlc, kind, zone, generation, name, type, payload FROM ops
			WHERE origin = ? AND seq > ? ORDER BY seq LIMIT ?`, o, since[o], limit-len(ops)+1)
		if err != nil {
			return nil, false, err
		}
		for rows.Next() {
			if len(ops) >= limit {
				more = true
				break
			}
			var op Op
			var h int64
			var payload []byte
			if err := rows.Scan(&op.Origin, &op.Seq, &h, &op.Kind, &op.Zone, &op.Generation, &op.Name, &op.Type, &payload); err != nil {
				rows.Close()
				return nil, false, err
			}
			op.HLC, op.Payload = hlc.Timestamp(h), payload
			ops = append(ops, op)
		}
		rows.Close()
		if more {
			return ops, true, nil
		}
	}
	return ops, false, nil
}

// Zones returns every visible replicated zone, sorted by name.
func (s *Store) Zones() ([]Zone, error) {
	rows, err := s.db.Query(`SELECT name FROM zones WHERE exists_flag = 1 ORDER BY name`)
	if err != nil {
		return nil, err
	}
	var names []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			rows.Close()
			return nil, err
		}
		names = append(names, n)
	}
	rows.Close()
	out := make([]Zone, 0, len(names))
	for _, n := range names {
		z, ok, err := s.Zone(n)
		if err != nil {
			return nil, err
		}
		if ok {
			out = append(out, z)
		}
	}
	return out, nil
}

type rrsetRow struct {
	name, typ string
	records   []config.Record
	h         hlc.Timestamp
	origin    string
}

// Zone returns one visible replicated zone.
func (s *Store) Zone(name string) (Zone, bool, error) {
	z := Zone{Name: name}
	var exists int
	var base int64
	err := s.db.QueryRow(`SELECT exists_flag, generation, base FROM zones WHERE name = ?`, name).Scan(&exists, &z.Generation, &base)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && exists == 0) {
		return Zone{}, false, nil
	}
	if err != nil {
		return Zone{}, false, err
	}
	var count int64
	_ = s.db.QueryRow(`SELECT count FROM counters WHERE zone = ? AND generation = ?`, name, z.Generation).Scan(&count)
	z.Serial = uint32(base + count)

	var sp []byte
	err = s.db.QueryRow(`SELECT payload FROM settings WHERE zone = ? AND generation = ?`, name, z.Generation).Scan(&sp)
	if err == nil {
		if err := json.Unmarshal(sp, &z.Settings); err != nil {
			return Zone{}, false, err
		}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return Zone{}, false, err
	}

	rows, err := s.db.Query(`SELECT name, type, payload, hlc, origin FROM rrsets
		WHERE zone = ? AND generation = ? AND deleted = 0`, name, z.Generation)
	if err != nil {
		return Zone{}, false, err
	}
	var sets []rrsetRow
	for rows.Next() {
		var r rrsetRow
		var payload []byte
		var h int64
		if err := rows.Scan(&r.name, &r.typ, &payload, &h, &r.origin); err != nil {
			rows.Close()
			return Zone{}, false, err
		}
		var p RRsetPayload
		if err := json.Unmarshal(payload, &p); err != nil {
			rows.Close()
			return Zone{}, false, err
		}
		r.records, r.h = p.Records, hlc.Timestamp(h)
		sets = append(sets, r)
	}
	rows.Close()

	sets, z.Repairs = repairCNAMEs(sets)
	sort.Slice(sets, func(i, j int) bool {
		if sets[i].name != sets[j].name {
			return ownerLess(sets[i].name, sets[j].name)
		}
		return typeRank(sets[i].typ) < typeRank(sets[j].typ)
	})
	for _, r := range sets {
		z.Records = append(z.Records, r.records...)
	}
	return z, true, nil
}

// repairCNAMEs applies the deterministic §6 repair: at a name holding a CNAME
// and other RRsets (possible only when they were written concurrently on
// different nodes), the newest RRset wins — if it is the CNAME the others are
// hidden, otherwise the CNAME is.
func repairCNAMEs(sets []rrsetRow) ([]rrsetRow, []string) {
	byName := map[string][]int{}
	for i, r := range sets {
		byName[r.name] = append(byName[r.name], i)
	}
	hide := map[int]bool{}
	var repairs []string
	for name, idx := range byName {
		if len(idx) < 2 {
			continue
		}
		cname, newest := -1, idx[0]
		for _, i := range idx {
			if sets[i].typ == config.TypeCNAME {
				cname = i
			}
			if wins(sets[i].h, sets[i].origin, sets[newest].h, sets[newest].origin) {
				newest = i
			}
		}
		if cname < 0 {
			continue
		}
		if newest == cname {
			for _, i := range idx {
				if i != cname {
					hide[i] = true
				}
			}
			repairs = append(repairs, fmt.Sprintf("%s: concurrent CNAME and other records — the newer CNAME wins, other records hidden", name))
		} else {
			hide[cname] = true
			repairs = append(repairs, fmt.Sprintf("%s: concurrent CNAME and other records — the newer records win, CNAME hidden", name))
		}
	}
	if len(hide) == 0 {
		return sets, nil
	}
	out := sets[:0:0]
	for i, r := range sets {
		if !hide[i] {
			out = append(out, r)
		}
	}
	sort.Strings(repairs)
	return out, repairs
}

func ownerLess(a, b string) bool {
	if a == "@" || b == "@" {
		return a == "@" && b != "@"
	}
	return a < b
}

func typeRank(t string) int {
	for i, x := range config.RecordTypes {
		if x == t {
			return i
		}
	}
	return len(config.RecordTypes)
}

// Stats is a summary for /cluster/status.
type Stats struct {
	Ops    int64 `json:"ops"`
	Zones  int64 `json:"zones"`
	Oldest int64 `json:"oldest_op_hlc,omitempty"`
}

// Stats counts the log and zones.
func (s *Store) Stats() Stats {
	var st Stats
	_ = s.db.QueryRow(`SELECT COUNT(*), COALESCE(MIN(hlc), 0) FROM ops`).Scan(&st.Ops, &st.Oldest)
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM zones WHERE exists_flag = 1`).Scan(&st.Zones)
	return st
}

// Backup writes a consistent online copy of the database to path.
func (s *Store) Backup(path string) error {
	if strings.ContainsRune(path, '\'') {
		return fmt.Errorf("backup path must not contain quotes")
	}
	_, err := s.db.Exec(`VACUUM INTO '` + path + `'`)
	return err
}
