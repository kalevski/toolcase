package store

import (
	"database/sql"
	"fmt"

	"github.com/kalevski/toolcase/zonewright/internal/hlc"
)

// Register rows as they travel in a snapshot. Each carries the identity of
// its winning op so the receiver can merge with the same winner rule.
type (
	ZoneRow struct {
		Name       string        `json:"name"`
		Exists     bool          `json:"exists"`
		Generation string        `json:"generation"`
		Base       int64         `json:"base"`
		HLC        hlc.Timestamp `json:"hlc"`
		Origin     string        `json:"origin"`
		Seq        int64         `json:"seq"`
	}
	SettingsRow struct {
		Zone       string        `json:"zone"`
		Generation string        `json:"generation"`
		Payload    []byte        `json:"payload"`
		HLC        hlc.Timestamp `json:"hlc"`
		Origin     string        `json:"origin"`
		Seq        int64         `json:"seq"`
	}
	RRsetRow struct {
		Zone       string        `json:"zone"`
		Generation string        `json:"generation"`
		Name       string        `json:"name"`
		Type       string        `json:"type"`
		Payload    []byte        `json:"payload"`
		Deleted    bool          `json:"deleted"`
		HLC        hlc.Timestamp `json:"hlc"`
		Origin     string        `json:"origin"`
		Seq        int64         `json:"seq"`
	}
	CounterRow struct {
		Zone       string `json:"zone"`
		Generation string `json:"generation"`
		Count      int64  `json:"count"`
	}
)

// Snapshot is the full materialized state plus the version vector it
// reflects (REPLICATION.md §8.3).
type Snapshot struct {
	NodeID   string           `json:"node_id"`
	VV       map[string]int64 `json:"vv"`
	Zones    []ZoneRow        `json:"zones"`
	Settings []SettingsRow    `json:"settings"`
	RRsets   []RRsetRow       `json:"rrsets"`
	Counters []CounterRow     `json:"counters"`
	Tokens   []TokenRow       `json:"tokens,omitempty"`
}

// Snapshot exports the state consistently (one read transaction).
func (s *Store) Snapshot() (*Snapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	snap := &Snapshot{NodeID: s.nodeID}
	if snap.VV, err = readSeqMap(tx, `SELECT origin, seq FROM vv`); err != nil {
		return nil, err
	}
	scan := func(q string, fn func(*sql.Rows) error) error {
		rows, err := tx.Query(q)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			if err := fn(rows); err != nil {
				return err
			}
		}
		return rows.Err()
	}
	if err := scan(`SELECT name, exists_flag, generation, base, hlc, origin, seq FROM zones`, func(r *sql.Rows) error {
		var z ZoneRow
		var e int
		var h int64
		if err := r.Scan(&z.Name, &e, &z.Generation, &z.Base, &h, &z.Origin, &z.Seq); err != nil {
			return err
		}
		z.Exists, z.HLC = e == 1, hlc.Timestamp(h)
		snap.Zones = append(snap.Zones, z)
		return nil
	}); err != nil {
		return nil, err
	}
	if err := scan(`SELECT zone, generation, payload, hlc, origin, seq FROM settings`, func(r *sql.Rows) error {
		var x SettingsRow
		var h int64
		if err := r.Scan(&x.Zone, &x.Generation, &x.Payload, &h, &x.Origin, &x.Seq); err != nil {
			return err
		}
		x.HLC = hlc.Timestamp(h)
		snap.Settings = append(snap.Settings, x)
		return nil
	}); err != nil {
		return nil, err
	}
	if err := scan(`SELECT zone, generation, name, type, payload, deleted, hlc, origin, seq FROM rrsets`, func(r *sql.Rows) error {
		var x RRsetRow
		var d int
		var h int64
		if err := r.Scan(&x.Zone, &x.Generation, &x.Name, &x.Type, &x.Payload, &d, &h, &x.Origin, &x.Seq); err != nil {
			return err
		}
		x.Deleted, x.HLC = d == 1, hlc.Timestamp(h)
		snap.RRsets = append(snap.RRsets, x)
		return nil
	}); err != nil {
		return nil, err
	}
	if err := scan(`SELECT zone, generation, count FROM counters`, func(r *sql.Rows) error {
		var c CounterRow
		if err := r.Scan(&c.Zone, &c.Generation, &c.Count); err != nil {
			return err
		}
		snap.Counters = append(snap.Counters, c)
		return nil
	}); err != nil {
		return nil, err
	}
	if snap.Tokens, err = snapshotTokens(tx); err != nil {
		return nil, err
	}
	return snap, nil
}

// MergeSnapshot folds a peer's snapshot into local state with the same
// winner rule ops use, so local changes the peer has not seen survive. Serial
// counters become the snapshot's count plus the local ops the snapshot does
// not cover. Where the snapshot is ahead of the local log, the local floor
// rises: those ops can no longer be served to other peers individually.
func (s *Store) MergeSnapshot(snap *Snapshot) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	touched := map[string]bool{}
	maxH := hlc.Timestamp(0)
	lww := func(table, where string, args []any, h hlc.Timestamp, origin string) (bool, error) {
		var curH int64
		var curO string
		err := tx.QueryRow(`SELECT hlc, origin FROM `+table+` WHERE `+where, args...).Scan(&curH, &curO)
		if err == nil {
			return wins(h, origin, hlc.Timestamp(curH), curO), nil
		}
		if err == sql.ErrNoRows {
			return true, nil
		}
		return false, err
	}
	for _, z := range snap.Zones {
		ok, err := lww("zones", "name = ?", []any{z.Name}, z.HLC, z.Origin)
		if err != nil {
			return nil, err
		}
		if ok {
			e := 0
			if z.Exists {
				e = 1
			}
			if _, err := tx.Exec(`INSERT OR REPLACE INTO zones(name, exists_flag, generation, base, hlc, origin, seq) VALUES(?,?,?,?,?,?,?)`,
				z.Name, e, z.Generation, z.Base, int64(z.HLC), z.Origin, z.Seq); err != nil {
				return nil, err
			}
			touched[z.Name] = true
		}
		maxH = max(maxH, z.HLC)
	}
	for _, x := range snap.Settings {
		ok, err := lww("settings", "zone = ? AND generation = ?", []any{x.Zone, x.Generation}, x.HLC, x.Origin)
		if err != nil {
			return nil, err
		}
		if ok {
			if _, err := tx.Exec(`INSERT OR REPLACE INTO settings(zone, generation, payload, hlc, origin, seq) VALUES(?,?,?,?,?,?)`,
				x.Zone, x.Generation, x.Payload, int64(x.HLC), x.Origin, x.Seq); err != nil {
				return nil, err
			}
			touched[x.Zone] = true
		}
		maxH = max(maxH, x.HLC)
	}
	for _, x := range snap.RRsets {
		ok, err := lww("rrsets", "zone = ? AND generation = ? AND name = ? AND type = ?", []any{x.Zone, x.Generation, x.Name, x.Type}, x.HLC, x.Origin)
		if err != nil {
			return nil, err
		}
		if ok {
			d := 0
			if x.Deleted {
				d = 1
			}
			if _, err := tx.Exec(`INSERT OR REPLACE INTO rrsets(zone, generation, name, type, payload, deleted, hlc, origin, seq) VALUES(?,?,?,?,?,?,?,?,?)`,
				x.Zone, x.Generation, x.Name, x.Type, x.Payload, d, int64(x.HLC), x.Origin, x.Seq); err != nil {
				return nil, err
			}
			touched[x.Zone] = true
		}
		maxH = max(maxH, x.HLC)
	}
	for _, t := range snap.Tokens {
		if err := mergeTokenRow(tx, t); err != nil {
			return nil, err
		}
		maxH = max(maxH, t.HLC)
	}
	for _, c := range snap.Counters {
		// Local ops the snapshot does not cover yet (seq above its vv for
		// their origin) still count on top of the snapshot's number.
		rows, err := tx.Query(`SELECT origin, seq FROM ops WHERE zone = ? AND generation = ?`, c.Zone, c.Generation)
		if err != nil {
			return nil, err
		}
		above := int64(0)
		for rows.Next() {
			var o string
			var sq int64
			if err := rows.Scan(&o, &sq); err != nil {
				rows.Close()
				return nil, err
			}
			if sq > snap.VV[o] {
				above++
			}
		}
		rows.Close()
		if _, err := tx.Exec(`INSERT OR REPLACE INTO counters(zone, generation, count) VALUES(?,?,?)`, c.Zone, c.Generation, c.Count+above); err != nil {
			return nil, err
		}
	}
	localVV, err := readSeqMap(tx, `SELECT origin, seq FROM vv`)
	if err != nil {
		return nil, err
	}
	for o, sq := range snap.VV {
		if sq <= localVV[o] {
			continue
		}
		if _, err := tx.Exec(`INSERT OR REPLACE INTO vv(origin, seq) VALUES(?, ?)`, o, sq); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(`INSERT INTO floor(origin, seq) VALUES(?, ?) ON CONFLICT(origin) DO UPDATE SET seq = MAX(seq, excluded.seq)`, o, sq); err != nil {
			return nil, err
		}
	}
	s.clock.Observe(maxH)
	if err := setMetaTx(tx, "hlc", fmt.Sprint(uint64(s.clock.Last()))); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	out := make([]string, 0, len(touched))
	for z := range touched {
		out = append(out, z)
	}
	return out, nil
}

// Compact deletes ops older than cutoff that every peer has acknowledged
// (safe[origin] = the lowest seq of that origin all active peers hold), then
// purges tombstones and dead generations whose winning op is gone from the
// log (REPLICATION.md §11). Returns the number of ops deleted.
func (s *Store) Compact(cutoff hlc.Timestamp, safe map[string]int64) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	tx, err := s.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	var deleted int64
	for origin, upTo := range safe {
		var top sql.NullInt64
		if err := tx.QueryRow(`SELECT MAX(seq) FROM ops WHERE origin = ? AND seq <= ? AND hlc < ?`, origin, upTo, int64(cutoff)).Scan(&top); err != nil {
			return 0, err
		}
		if !top.Valid {
			continue
		}
		res, err := tx.Exec(`DELETE FROM ops WHERE origin = ? AND seq <= ?`, origin, top.Int64)
		if err != nil {
			return 0, err
		}
		n, _ := res.RowsAffected()
		deleted += n
		if _, err := tx.Exec(`INSERT INTO floor(origin, seq) VALUES(?, ?) ON CONFLICT(origin) DO UPDATE SET seq = MAX(seq, excluded.seq)`, origin, top.Int64); err != nil {
			return 0, err
		}
	}
	floors, err := readSeqMap(tx, `SELECT origin, seq FROM floor`)
	if err != nil {
		return 0, err
	}
	gone := func(origin string, seq int64) bool { return seq <= floors[origin] }

	// Deleted RRsets whose tombstone op is compacted.
	type key struct{ zone, gen, name, typ, origin string }
	var dead []key
	var seqs []int64
	rows, err := tx.Query(`SELECT zone, generation, name, type, origin, seq FROM rrsets WHERE deleted = 1`)
	if err != nil {
		return 0, err
	}
	for rows.Next() {
		var k key
		var sq int64
		if err := rows.Scan(&k.zone, &k.gen, &k.name, &k.typ, &k.origin, &sq); err != nil {
			rows.Close()
			return 0, err
		}
		dead, seqs = append(dead, k), append(seqs, sq)
	}
	rows.Close()
	for i, k := range dead {
		if gone(k.origin, seqs[i]) {
			if _, err := tx.Exec(`DELETE FROM rrsets WHERE zone=? AND generation=? AND name=? AND type=?`, k.zone, k.gen, k.name, k.typ); err != nil {
				return 0, err
			}
		}
	}

	if err := compactTokens(tx, gone); err != nil {
		return 0, err
	}

	// Zones: a compacted delete drops the zone entirely; a compacted create
	// drops every other (dead) generation.
	type zkey struct {
		name, gen, origin string
		exists            bool
		seq               int64
	}
	var zs []zkey
	rows, err = tx.Query(`SELECT name, generation, origin, exists_flag, seq FROM zones`)
	if err != nil {
		return 0, err
	}
	for rows.Next() {
		var z zkey
		var e int
		if err := rows.Scan(&z.name, &z.gen, &z.origin, &e, &z.seq); err != nil {
			rows.Close()
			return 0, err
		}
		z.exists = e == 1
		zs = append(zs, z)
	}
	rows.Close()
	for _, z := range zs {
		if !gone(z.origin, z.seq) {
			continue
		}
		if !z.exists {
			for _, t := range []string{"zones WHERE name = ?", "settings WHERE zone = ?", "rrsets WHERE zone = ?", "counters WHERE zone = ?"} {
				if _, err := tx.Exec(`DELETE FROM `+t, z.name); err != nil {
					return 0, err
				}
			}
			continue
		}
		for _, t := range []string{"settings", "rrsets", "counters"} {
			if _, err := tx.Exec(`DELETE FROM `+t+` WHERE zone = ? AND generation != ?`, z.name, z.gen); err != nil {
				return 0, err
			}
		}
	}
	return deleted, tx.Commit()
}
