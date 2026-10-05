package meta

import (
	"context"
	"database/sql"
	"strings"
	"time"
)

// Roles of a move row (spec §8.8): the old home of the bucket is the source
// ("out"), the new home the target ("in").
const (
	MoveOut = "out"
	MoveIn  = "in"
)

// States of a move row. The source goes
//
//	queued → preparing → copying → frozen → cutover → moved → done
//
// and ends in failed or cancelled before the cutover; `resuming` is the end of a
// cutover whose target was retired (the source takes the bucket back at epoch+2).
// The target goes receiving → verified → activated, or ends abandoned. `cutover`
// (source), `activated` and `abandoned` (target) are the durable decisions of §8.8
// step 5; `moved` says the target answered OK and the bucket now belongs to it,
// with the source's cleanup still to do.
const (
	MoveQueued    = "queued"
	MovePreparing = "preparing"
	MoveCopying   = "copying"
	MoveFrozen    = "frozen"
	MoveCutover   = "cutover"
	MoveMoved     = "moved"
	MoveResuming  = "resuming"
	MoveDone      = "done"
	MoveFailed    = "failed"
	MoveCancelled = "cancelled"

	MoveReceiving = "receiving"
	MoveVerified  = "verified"
	MoveActivated = "activated"
	MoveAbandoned = "abandoned"
)

// Move is one row of the moves table.
type Move struct {
	ID         string
	Role       string // MoveOut | MoveIn
	Bucket     string
	Generation string
	// Peer is the id of the other node: the target of an outgoing move, the source
	// of an incoming one.
	Peer string
	// State is one of the Move* states above.
	State string
	// Epoch is the epoch the move installs: the bucket's epoch + 1.
	Epoch int64
	Error string
	// MaxBPS is the rate limit of the blob streams (bytes per second, 0 = none).
	MaxBPS        int64
	BytesTotal    int64
	BytesCopied   int64
	ObjectsCopied int64
	CreatedAt     time.Time
	StartedAt     *time.Time
	FinishedAt    *time.Time
}

// Final reports whether the move has ended (nothing more will happen to it).
func (m *Move) Final() bool { return IsFinalMoveState(m.State) }

// IsFinalMoveState reports whether a state is an end state.
func IsFinalMoveState(s string) bool {
	switch s {
	case MoveDone, MoveFailed, MoveCancelled, MoveActivated, MoveAbandoned:
		return true
	}
	return false
}

const moveCols = `id, role, bucket, generation, peer, state, epoch, error, max_bps, bytes_total, bytes_copied,
objects_copied, created_at, started_at, finished_at`

func scanMove(s rowScanner) (*Move, error) {
	var m Move
	var created int64
	var started, finished sql.NullInt64
	if err := s.Scan(&m.ID, &m.Role, &m.Bucket, &m.Generation, &m.Peer, &m.State, &m.Epoch, &m.Error, &m.MaxBPS,
		&m.BytesTotal, &m.BytesCopied, &m.ObjectsCopied, &created, &started, &finished); err != nil {
		return nil, err
	}
	m.CreatedAt = fromMS(created)
	if started.Valid {
		v := fromMS(started.Int64)
		m.StartedAt = &v
	}
	if finished.Valid {
		v := fromMS(finished.Int64)
		m.FinishedAt = &v
	}
	return &m, nil
}

// InsertMove adds a move row (ErrExists when the id is taken).
func (t *Tx) InsertMove(ctx context.Context, m *Move) error {
	if m.CreatedAt.IsZero() {
		m.CreatedAt = t.now
	}
	_, err := t.q.ExecContext(ctx, `INSERT INTO moves (`+moveCols+`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		m.ID, m.Role, m.Bucket, m.Generation, m.Peer, m.State, m.Epoch, m.Error, m.MaxBPS, m.BytesTotal, m.BytesCopied,
		m.ObjectsCopied, ms(m.CreatedAt), msPtr(m.StartedAt), msPtr(m.FinishedAt))
	if err != nil && strings.Contains(err.Error(), "UNIQUE") {
		return ErrExists
	}
	return err
}

// SaveMove writes every mutable column of m (state, error, counters, times).
func (t *Tx) SaveMove(ctx context.Context, m *Move) error {
	res, err := t.q.ExecContext(ctx, `UPDATE moves SET state=?, error=?, bytes_total=?, bytes_copied=?, objects_copied=?,
started_at=?, finished_at=? WHERE id=?`,
		m.State, m.Error, m.BytesTotal, m.BytesCopied, m.ObjectsCopied, msPtr(m.StartedAt), msPtr(m.FinishedAt), m.ID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// MoveTransition changes the state of a move only if it is still one of from (a
// decision is taken once: a late caller finds the state already changed). It
// reports whether it changed the row. A final state sets finished_at.
func (t *Tx) MoveTransition(ctx context.Context, id string, from []string, to, errText string) (bool, error) {
	q := `UPDATE moves SET state=?, error=CASE WHEN ?<>'' THEN ? ELSE error END,
finished_at=CASE WHEN ? IN ('done','failed','cancelled','activated','abandoned') THEN COALESCE(finished_at, ?) ELSE finished_at END
WHERE id=?`
	args := []any{to, errText, errText, to, ms(t.now), id}
	if len(from) > 0 {
		q += ` AND state IN (` + placeholders(len(from)) + `)`
		for _, f := range from {
			args = append(args, f)
		}
	}
	res, err := t.q.ExecContext(ctx, q, args...)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n == 1, nil
}

// GetMove loads a move row (ErrNotFound if absent).
func (q Q) GetMove(ctx context.Context, id string) (*Move, error) {
	m, err := scanMove(q.q.QueryRowContext(ctx, `SELECT `+moveCols+` FROM moves WHERE id=?`, id))
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	return m, err
}

// MoveFilter selects move rows for ListMoves.
type MoveFilter struct {
	Role   string   // "" = both
	Bucket string   // "" = any
	States []string // nil = any
	// Open selects the moves that have not ended.
	Open bool
	// Before and After page by id: ids below Before (newest first), or above After
	// (oldest first, with Asc).
	Before, After string
	Asc           bool
	Limit         int
}

// ListMoves lists move rows, newest first (oldest first with Asc).
func (q Q) ListMoves(ctx context.Context, f MoveFilter) ([]*Move, error) {
	var where []string
	var args []any
	add := func(cond string, a ...any) {
		where = append(where, cond)
		args = append(args, a...)
	}
	if f.Role != "" {
		add("role=?", f.Role)
	}
	if f.Bucket != "" {
		add("bucket=?", f.Bucket)
	}
	if len(f.States) > 0 {
		add("state IN ("+placeholders(len(f.States))+")", stringsToAny(f.States)...)
	}
	if f.Open {
		add("state NOT IN ('done','failed','cancelled','activated','abandoned')")
	}
	if f.Before != "" {
		add("id<?", f.Before)
	}
	if f.After != "" {
		add("id>?", f.After)
	}
	query := `SELECT ` + moveCols + ` FROM moves`
	if len(where) > 0 {
		query += ` WHERE ` + strings.Join(where, " AND ")
	}
	if f.Asc {
		query += ` ORDER BY id`
	} else {
		query += ` ORDER BY id DESC`
	}
	limit := f.Limit
	if limit <= 0 {
		limit = 500
	}
	query += ` LIMIT ?`
	args = append(args, limit)
	rows, err := q.q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Move
	for rows.Next() {
		m, err := scanMove(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// CountMoves counts the move rows per role and state.
func (q Q) CountMoves(ctx context.Context) (map[[2]string]int64, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT role, state, COUNT(*) FROM moves GROUP BY role, state`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[[2]string]int64{}
	for rows.Next() {
		var role, state string
		var n int64
		if err := rows.Scan(&role, &state, &n); err != nil {
			return nil, err
		}
		out[[2]string{role, state}] = n
	}
	return out, rows.Err()
}

// SetBucketEpoch sets the epoch of the local copy of a bucket (spec §8.8) — only
// if the row is the incarnation with that generation. It reports whether a row
// changed.
func (t *Tx) SetBucketEpoch(ctx context.Context, name, generation string, epoch int64) (bool, error) {
	res, err := t.q.ExecContext(ctx, `UPDATE buckets SET epoch=? WHERE name=? AND generation=?`, epoch, name, generation)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n == 1, nil
}

// ---- blob files received for a move ---------------------------------------------

// InsertPlacedBlob records a blob file the target of a move received (§8.8 step 2):
// a row with no reference and no `zero_since`, so that the garbage collector leaves
// it alone and the orphan sweeper counts the file as known until the rows of the
// bucket arrive and take it over (ImportBucket) or the move is abandoned
// (BucketBlobIDs, DeleteBlobRows). It is idempotent, and it takes a row that is
// waiting for the collector back.
func (t *Tx) InsertPlacedBlob(ctx context.Context, b *Blob) error {
	if b.CreatedAt.IsZero() {
		b.CreatedAt = t.now
	}
	_, err := t.q.ExecContext(ctx, `INSERT INTO blobs (`+blobCols+`) VALUES (?,?,?,?,?,0,NULL,?)
ON CONFLICT(blob_id) DO UPDATE SET zero_since = CASE WHEN refs <= 0 THEN NULL ELSE zero_since END`,
		b.BlobID, b.Bucket, b.Size, b.PlainSize, boolInt(b.SSE), ms(b.CreatedAt))
	return err
}

// BucketBlobs lists the blob rows of a bucket with id > after, in id order.
func (q Q) BucketBlobs(ctx context.Context, bucket, after string, limit int) ([]*Blob, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT `+blobCols+` FROM blobs WHERE bucket=? AND blob_id>? ORDER BY blob_id LIMIT ?`, bucket, after, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Blob
	for rows.Next() {
		b, err := scanBlob(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// DeleteBlobRows removes blob rows by id (the files are gone or never mattered).
func (t *Tx) DeleteBlobRows(ctx context.Context, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := t.q.ExecContext(ctx, `DELETE FROM blobs WHERE blob_id IN (`+placeholders(len(ids))+`)`, stringsToAny(ids)...)
	return err
}

// BucketBlobStats counts the blob rows of a bucket and their stored bytes.
func (q Q) BucketBlobStats(ctx context.Context, bucket string) (n, bytes int64, err error) {
	err = q.q.QueryRowContext(ctx, `SELECT COUNT(*), COALESCE(SUM(size),0) FROM blobs WHERE bucket=?`, bucket).Scan(&n, &bytes)
	return
}

func stringsToAny(s []string) []any {
	out := make([]any, len(s))
	for i, v := range s {
		out[i] = v
	}
	return out
}
