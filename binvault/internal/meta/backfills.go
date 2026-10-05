package meta

import (
	"context"
	"database/sql"
	"time"
)

// Backfill states (spec §6.8).
const (
	BackfillRunning   = "running"
	BackfillCompleted = "completed"
	BackfillCancelled = "cancelled"
	BackfillFailed    = "failed"
)

// Backfill runs an after pipeline over the objects that already exist. Cursor
// is the last key walked, persisted so that a restart resumes the walk.
type Backfill struct {
	ID             string
	Bucket         string
	Pipeline       string
	Prefix         string
	ModifiedAfter  *time.Time
	ModifiedBefore *time.Time
	State          string
	Scanned        int64
	Enqueued       int64
	Cursor         string
	Error          string
	CreatedAt      time.Time
	FinishedAt     *time.Time
}

const backfillCols = `id, bucket, pipeline, prefix, modified_after, modified_before, state, scanned, enqueued, cursor, error, created_at, finished_at`

func scanBackfill(s rowScanner) (*Backfill, error) {
	var b Backfill
	var after, before, finished sql.NullInt64
	var created int64
	if err := s.Scan(&b.ID, &b.Bucket, &b.Pipeline, &b.Prefix, &after, &before, &b.State, &b.Scanned, &b.Enqueued,
		&b.Cursor, &b.Error, &created, &finished); err != nil {
		return nil, err
	}
	b.CreatedAt = fromMS(created)
	if after.Valid {
		v := fromMS(after.Int64)
		b.ModifiedAfter = &v
	}
	if before.Valid {
		v := fromMS(before.Int64)
		b.ModifiedBefore = &v
	}
	if finished.Valid {
		v := fromMS(finished.Int64)
		b.FinishedAt = &v
	}
	return &b, nil
}

// GetBackfill loads a backfill (ErrNotFound if absent).
func (q Q) GetBackfill(ctx context.Context, id string) (*Backfill, error) {
	b, err := scanBackfill(q.q.QueryRowContext(ctx, `SELECT `+backfillCols+` FROM backfills WHERE id=?`, id))
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	return b, err
}

// ListBackfills lists backfills newest first (by id), before the exclusive
// id bound ("" = from the newest).
func (q Q) ListBackfills(ctx context.Context, before string, limit int) ([]*Backfill, error) {
	query := `SELECT ` + backfillCols + ` FROM backfills`
	var args []any
	if before != "" {
		query += ` WHERE id < ?`
		args = append(args, before)
	}
	query += ` ORDER BY id DESC LIMIT ?`
	args = append(args, limit)
	return q.queryBackfills(ctx, query, args...)
}

// RunningBackfills lists the backfills still walking (resumed at start-up).
func (q Q) RunningBackfills(ctx context.Context) ([]*Backfill, error) {
	return q.queryBackfills(ctx, `SELECT `+backfillCols+` FROM backfills WHERE state='running' ORDER BY id`)
}

func (q Q) queryBackfills(ctx context.Context, query string, args ...any) ([]*Backfill, error) {
	rows, err := q.q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Backfill
	for rows.Next() {
		b, err := scanBackfill(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// CreateBackfill inserts a backfill.
func (t *Tx) CreateBackfill(ctx context.Context, b *Backfill) error {
	if b.CreatedAt.IsZero() {
		b.CreatedAt = t.now
	}
	if b.State == "" {
		b.State = BackfillRunning
	}
	_, err := t.q.ExecContext(ctx, `INSERT INTO backfills (`+backfillCols+`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		b.ID, b.Bucket, b.Pipeline, b.Prefix, msPtr(b.ModifiedAfter), msPtr(b.ModifiedBefore), b.State, b.Scanned,
		b.Enqueued, b.Cursor, b.Error, ms(b.CreatedAt), msPtr(b.FinishedAt))
	return err
}

// SaveBackfill writes a backfill's progress: counters, cursor, state, error.
// A backfill that already left the running state is not touched (a cancel
// that raced with the walker wins); ok reports whether it was still running.
func (t *Tx) SaveBackfill(ctx context.Context, b *Backfill) (ok bool, err error) {
	res, err := t.q.ExecContext(ctx, `UPDATE backfills SET state=?, scanned=?, enqueued=?, cursor=?, error=?, finished_at=?
WHERE id=? AND state='running'`, b.State, b.Scanned, b.Enqueued, b.Cursor, b.Error, msPtr(b.FinishedAt), b.ID)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n == 1, err
}

// CancelBackfill stops a running backfill; it reports whether it was running.
func (t *Tx) CancelBackfill(ctx context.Context, id string, now time.Time) (bool, error) {
	res, err := t.q.ExecContext(ctx, `UPDATE backfills SET state='cancelled', finished_at=? WHERE id=? AND state='running'`, ms(now), id)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n == 1, err
}

// CancelBackfillsIn stops the running backfills of one pipeline in one bucket.
func (t *Tx) CancelBackfillsIn(ctx context.Context, bucket, pipeline string, now time.Time) error {
	_, err := t.q.ExecContext(ctx, `UPDATE backfills SET state='cancelled', finished_at=? WHERE state='running' AND bucket=? AND pipeline=?`, ms(now), bucket, pipeline)
	return err
}

// CancelBackfillsOf stops the running backfills of a bucket or a pipeline
// (when either goes away).
func (t *Tx) CancelBackfillsOf(ctx context.Context, bucket, pipeline string, now time.Time) error {
	_, err := t.q.ExecContext(ctx, `UPDATE backfills SET state='cancelled', finished_at=? WHERE state='running'
AND (? != '' AND bucket=? OR ? != '' AND pipeline=?)`, ms(now), bucket, bucket, pipeline, pipeline)
	return err
}
