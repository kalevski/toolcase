package meta

import (
	"context"
	"database/sql"
	"strconv"
)

// This file holds the storage side of the cluster catalog (spec §8.5): the op
// log, its version vector and floor, and the replicated registers. It carries
// no policy. Which op may be applied, held or refused, and what a register
// value means, is decided by internal/cluster; the one rule enforced here is
// the winner rule, because it must be a single atomic statement.

// CatalogOp is one catalog op as stored in the op log. HLC is the packed
// hybrid-logical-clock timestamp of internal/hlc.
type CatalogOp struct {
	Origin  string
	Seq     int64
	HLC     uint64
	V       int    // peer-protocol version the op was created under
	Kind    string // bucket | pipeline | key
	Key     string // the name inside Kind
	Prev    string // id of the register winner the author replaced ("" = none)
	Payload []byte // canonical JSON
}

// ID is the op's identity, "origin:seq".
func (o *CatalogOp) ID() string { return CatalogOpID(o.Origin, o.Seq) }

// CatalogOpID formats an op identity.
func CatalogOpID(origin string, seq int64) string { return origin + ":" + strconv.FormatInt(seq, 10) }

// CatalogReg is one replicated register: the winning value (or a tombstone) of
// a key, with the identity of the op that wrote it.
type CatalogReg struct {
	Key     string // "kind/name"
	Kind    string
	Name    string
	Deleted bool
	Payload []byte
	Aux     string // secondary index: a bucket's home node id, a key's bucket
	Prev    string
	HLC     uint64
	Origin  string
	Seq     int64
}

// WinnerID is the id of the op that wrote the register.
func (r *CatalogReg) WinnerID() string { return CatalogOpID(r.Origin, r.Seq) }

// CatalogWins reports whether (h1, o1, s1) beats (h2, o2, s2): the higher hlc
// wins, the origin breaks a tie (spec §8.5), and the seq breaks a tie between
// two ops of one origin with the same hlc. An honest origin never produces such
// a pair (its hlc grows with its seq), so the last step only makes the rule a
// total order: a buggy or compromised peer cannot make the winner depend on
// arrival order. It is a pure comparison, so every node picks the same winner
// whatever order ops arrive in. CatalogUpsertReg applies the same rule in SQL.
func CatalogWins(h1 uint64, o1 string, s1 int64, h2 uint64, o2 string, s2 int64) bool {
	if h1 != h2 {
		return h1 > h2
	}
	if o1 != o2 {
		return o1 > o2
	}
	return s1 > s2
}

// CatalogStats summarises the log and the registers (GET /cluster).
type CatalogStats struct {
	Ops         int64
	OldestOpHLC uint64
	Registers   int64 // live registers
	Tombstones  int64
	MaxHLC      uint64 // highest hlc in the log or the registers
}

// ---- reads ----------------------------------------------------------------

func readSeqMap(ctx context.Context, q Querier, query string) (map[string]int64, error) {
	rows, err := q.QueryContext(ctx, query)
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

// CatalogVV returns the version vector: the highest contiguous seq applied per
// origin.
func (q Q) CatalogVV(ctx context.Context) (map[string]int64, error) {
	return readSeqMap(ctx, q.q, `SELECT origin, seq FROM ops_vv`)
}

// CatalogFloors returns, per origin, the highest seq no longer held in the log.
func (q Q) CatalogFloors(ctx context.Context) (map[string]int64, error) {
	return readSeqMap(ctx, q.q, `SELECT origin, seq FROM ops_floor`)
}

const opCols = `origin, seq, hlc, v, kind, key, prev, payload`

func scanOp(s rowScanner) (CatalogOp, error) {
	var o CatalogOp
	var h int64
	err := s.Scan(&o.Origin, &o.Seq, &h, &o.V, &o.Kind, &o.Key, &o.Prev, &o.Payload)
	o.HLC = uint64(h)
	return o, err
}

// CatalogOpRange returns up to limit ops of one origin with seq > after, in seq
// order.
func (q Q) CatalogOpRange(ctx context.Context, origin string, after int64, limit int) ([]CatalogOp, error) {
	if limit <= 0 {
		limit = 1000
	}
	rows, err := q.q.QueryContext(ctx, `SELECT `+opCols+` FROM ops WHERE origin=? AND seq>? ORDER BY seq LIMIT ?`, origin, after, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CatalogOp
	for rows.Next() {
		o, err := scanOp(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

// CatalogGetOp loads one op (ErrNotFound if it was never held or is compacted).
func (q Q) CatalogGetOp(ctx context.Context, origin string, seq int64) (*CatalogOp, error) {
	o, err := scanOp(q.q.QueryRowContext(ctx, `SELECT `+opCols+` FROM ops WHERE origin=? AND seq=?`, origin, seq))
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// CatalogOpsByKind returns every held op of a kind, oldest first per origin
// (`validate` and `rekey` walk the sealed values inside them).
func (q Q) CatalogOpsByKind(ctx context.Context, kind string) ([]CatalogOp, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT `+opCols+` FROM ops WHERE kind=? ORDER BY origin, seq`, kind)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CatalogOp
	for rows.Next() {
		o, err := scanOp(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

const regCols = `key, kind, name, deleted, payload, aux, prev, hlc, origin, seq`

func scanReg(s rowScanner) (CatalogReg, error) {
	var r CatalogReg
	var del int
	var h int64
	err := s.Scan(&r.Key, &r.Kind, &r.Name, &del, &r.Payload, &r.Aux, &r.Prev, &h, &r.Origin, &r.Seq)
	r.Deleted, r.HLC = del != 0, uint64(h)
	return r, err
}

// CatalogGetReg loads one register by its full key, tombstones included
// (ErrNotFound when the key has never been written or its tombstone was purged).
func (q Q) CatalogGetReg(ctx context.Context, key string) (*CatalogReg, error) {
	r, err := scanReg(q.q.QueryRowContext(ctx, `SELECT `+regCols+` FROM catalog WHERE key=?`, key))
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// CatalogListRegs lists the registers of one kind with name > after, ordered by
// name. Tombstones are included only when withDeleted is set.
func (q Q) CatalogListRegs(ctx context.Context, kind, after string, limit int, withDeleted bool) ([]CatalogReg, error) {
	if limit <= 0 {
		limit = 1000
	}
	query := `SELECT ` + regCols + ` FROM catalog WHERE kind=? AND name>?`
	if !withDeleted {
		query += ` AND deleted=0`
	}
	rows, err := q.q.QueryContext(ctx, query+` ORDER BY name LIMIT ?`, kind, after, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CatalogReg
	for rows.Next() {
		r, err := scanReg(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// CatalogPageRegs returns up to limit registers (tombstones included) whose
// full key is greater than after, ordered by key: the snapshot export pages
// through the catalog with it, so a large catalog is never held in memory.
func (q Q) CatalogPageRegs(ctx context.Context, after string, limit int) ([]CatalogReg, error) {
	if limit <= 0 {
		limit = 1000
	}
	rows, err := q.q.QueryContext(ctx, `SELECT `+regCols+` FROM catalog WHERE key>? ORDER BY key LIMIT ?`, after, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CatalogReg
	for rows.Next() {
		r, err := scanReg(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// CatalogAllRegs returns every register, tombstones included, ordered by key
// (the convergence tests; the snapshot export uses CatalogPageRegs).
func (q Q) CatalogAllRegs(ctx context.Context) ([]CatalogReg, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT `+regCols+` FROM catalog ORDER BY key`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CatalogReg
	for rows.Next() {
		r, err := scanReg(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// CatalogTombstones returns every tombstone.
func (q Q) CatalogTombstones(ctx context.Context) ([]CatalogReg, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT `+regCols+` FROM catalog WHERE deleted=1 ORDER BY key`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CatalogReg
	for rows.Next() {
		r, err := scanReg(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// CatalogRegsByAux lists the live registers of a kind whose aux value is aux
// (for buckets: the buckets homed on a node), ordered by name.
func (q Q) CatalogRegsByAux(ctx context.Context, kind, aux string) ([]CatalogReg, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT `+regCols+` FROM catalog WHERE kind=? AND aux=? AND deleted=0 ORDER BY name`, kind, aux)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CatalogReg
	for rows.Next() {
		r, err := scanReg(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// CatalogCountByAux counts the live registers of a kind whose aux value is aux.
func (q Q) CatalogCountByAux(ctx context.Context, kind, aux string) (int64, error) {
	var n int64
	err := q.q.QueryRowContext(ctx, `SELECT COUNT(*) FROM catalog WHERE kind=? AND aux=? AND deleted=0`, kind, aux).Scan(&n)
	return n, err
}

// CatalogCount counts the live registers of a kind.
func (q Q) CatalogCount(ctx context.Context, kind string) (int64, error) {
	var n int64
	err := q.q.QueryRowContext(ctx, `SELECT COUNT(*) FROM catalog WHERE kind=? AND deleted=0`, kind).Scan(&n)
	return n, err
}

// CatalogMaxHLC returns the highest hlc held in the log or in the registers
// (0 when empty); a node's clock must start above it.
func (q Q) CatalogMaxHLC(ctx context.Context) (uint64, error) {
	var a, b sql.NullInt64
	if err := q.q.QueryRowContext(ctx, `SELECT MAX(hlc) FROM ops`).Scan(&a); err != nil {
		return 0, err
	}
	if err := q.q.QueryRowContext(ctx, `SELECT MAX(hlc) FROM catalog`).Scan(&b); err != nil {
		return 0, err
	}
	return uint64(max(a.Int64, b.Int64)), nil
}

// CatalogStats counts the log and the registers.
func (q Q) CatalogStats(ctx context.Context) (CatalogStats, error) {
	var st CatalogStats
	var oldest sql.NullInt64
	if err := q.q.QueryRowContext(ctx, `SELECT COUNT(*), MIN(hlc) FROM ops`).Scan(&st.Ops, &oldest); err != nil {
		return st, err
	}
	st.OldestOpHLC = uint64(oldest.Int64)
	if err := q.q.QueryRowContext(ctx, `SELECT COALESCE(SUM(deleted=0),0), COALESCE(SUM(deleted=1),0) FROM catalog`).Scan(&st.Registers, &st.Tombstones); err != nil {
		return st, err
	}
	var err error
	st.MaxHLC, err = q.CatalogMaxHLC(ctx)
	return st, err
}

// ReadSnapshot runs fn over one read transaction: every read inside sees the
// same committed state (the snapshot export and the ops pages need the version
// vector, the floors and the data to agree). It never blocks the writer.
func (d *DB) ReadSnapshot(ctx context.Context, fn func(q Q) error) error {
	tx, err := d.r.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return err
	}
	defer tx.Rollback()
	return fn(Q{tx})
}

// ---- writes ---------------------------------------------------------------

// CatalogAppendOp stores an op in the log and raises the version vector of its
// origin to its seq. It reports false (and changes nothing) when the op is
// already held, so applying an op twice is a no-op. The caller guarantees seq
// contiguity: the vector means "applied up to here".
func (t *Tx) CatalogAppendOp(ctx context.Context, op *CatalogOp) (bool, error) {
	res, err := t.q.ExecContext(ctx, `INSERT OR IGNORE INTO ops (`+opCols+`) VALUES (?,?,?,?,?,?,?,?)`,
		op.Origin, op.Seq, int64(op.HLC), op.V, op.Kind, op.Key, op.Prev, op.Payload)
	if err != nil {
		return false, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return false, nil
	}
	return true, t.CatalogRaiseVV(ctx, op.Origin, op.Seq)
}

// CatalogRaiseVV raises the version vector entry of origin to seq (never lowers it).
func (t *Tx) CatalogRaiseVV(ctx context.Context, origin string, seq int64) error {
	_, err := t.q.ExecContext(ctx, `INSERT INTO ops_vv (origin, seq) VALUES (?, ?)
ON CONFLICT(origin) DO UPDATE SET seq = MAX(seq, excluded.seq)`, origin, seq)
	return err
}

// CatalogRaiseFloor raises the floor of origin to seq (never lowers it).
func (t *Tx) CatalogRaiseFloor(ctx context.Context, origin string, seq int64) error {
	_, err := t.q.ExecContext(ctx, `INSERT INTO ops_floor (origin, seq) VALUES (?, ?)
ON CONFLICT(origin) DO UPDATE SET seq = MAX(seq, excluded.seq)`, origin, seq)
	return err
}

// CatalogUpsertReg writes a register if its (hlc, origin, seq) beats the stored
// one (or the register is new) and reports whether it did. The comparison is
// CatalogWins, in one statement, so it holds under any arrival order.
func (t *Tx) CatalogUpsertReg(ctx context.Context, r *CatalogReg) (bool, error) {
	res, err := t.q.ExecContext(ctx, `INSERT INTO catalog (`+regCols+`) VALUES (?,?,?,?,?,?,?,?,?,?)
ON CONFLICT(key) DO UPDATE SET kind=excluded.kind, name=excluded.name, deleted=excluded.deleted,
  payload=excluded.payload, aux=excluded.aux, prev=excluded.prev, hlc=excluded.hlc,
  origin=excluded.origin, seq=excluded.seq
WHERE excluded.hlc > catalog.hlc
   OR (excluded.hlc = catalog.hlc AND excluded.origin > catalog.origin)
   OR (excluded.hlc = catalog.hlc AND excluded.origin = catalog.origin AND excluded.seq > catalog.seq)`,
		r.Key, r.Kind, r.Name, boolInt(r.Deleted), r.Payload, r.Aux, r.Prev, int64(r.HLC), r.Origin, r.Seq)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// CatalogCompactOps deletes the ops of one origin with seq <= upTo and hlc <
// before (a prefix: an origin's hlc grows with its seq) and raises the floor to
// the last deleted seq. It returns how many ops it deleted.
func (t *Tx) CatalogCompactOps(ctx context.Context, origin string, upTo int64, before uint64) (int64, error) {
	var top sql.NullInt64
	if err := t.q.QueryRowContext(ctx, `SELECT MAX(seq) FROM ops WHERE origin=? AND seq<=? AND hlc<?`,
		origin, upTo, int64(before)).Scan(&top); err != nil {
		return 0, err
	}
	if !top.Valid {
		return 0, nil
	}
	res, err := t.q.ExecContext(ctx, `DELETE FROM ops WHERE origin=? AND seq<=?`, origin, top.Int64)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return n, t.CatalogRaiseFloor(ctx, origin, top.Int64)
}

// CatalogPurgeTombstone removes a tombstone, but only the one written by the
// given op: a register that has been overwritten since is left alone.
func (t *Tx) CatalogPurgeTombstone(ctx context.Context, key, origin string, seq int64) (bool, error) {
	res, err := t.q.ExecContext(ctx, `DELETE FROM catalog WHERE key=? AND deleted=1 AND origin=? AND seq=?`, key, origin, seq)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// CatalogSetOpPayload replaces the payload of a held op. It exists for
// `binvault rekey`, which re-seals the sealed values inside catalog ops (§4.7);
// the replacement must carry the same plaintext.
func (t *Tx) CatalogSetOpPayload(ctx context.Context, origin string, seq int64, payload []byte) error {
	_, err := t.q.ExecContext(ctx, `UPDATE ops SET payload=? WHERE origin=? AND seq=?`, payload, origin, seq)
	return err
}

// CatalogSetRegPayload replaces the payload of a register (see
// CatalogSetOpPayload).
func (t *Tx) CatalogSetRegPayload(ctx context.Context, key string, payload []byte) error {
	_, err := t.q.ExecContext(ctx, `UPDATE catalog SET payload=? WHERE key=?`, payload, key)
	return err
}
