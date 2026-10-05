package store

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

// RLState is one rate-limit counter.
type RLState struct {
	Count        int
	WindowStart  time.Time
	BlockedUntil time.Time
}

// RLGet returns the counter for (bucket, key); the zero state if none.
func (s *Store) RLGet(ctx context.Context, bucket, key string) (RLState, error) {
	var c int
	var ws, bu int64
	err := s.r.QueryRowContext(ctx, `SELECT count, window_start, blocked_until FROM ratelimit WHERE bucket = ? AND key = ?`, bucket, key).Scan(&c, &ws, &bu)
	if errors.Is(err, sql.ErrNoRows) {
		return RLState{}, nil
	}
	if err != nil {
		return RLState{}, err
	}
	return RLState{Count: c, WindowStart: time.Unix(ws, 0), BlockedUntil: time.Unix(bu, 0)}, nil
}

// RLIncr adds one to the counter (starting a new window when the old one is
// over) and sets blocked_until via the callback, which sees the new state.
func (s *Store) RLIncr(ctx context.Context, bucket, key string, now time.Time, window time.Duration, block func(count int) time.Duration) (RLState, error) {
	tx, err := s.w.BeginTx(ctx, nil)
	if err != nil {
		return RLState{}, err
	}
	defer tx.Rollback()
	var c int
	var ws, bu int64
	err = tx.QueryRowContext(ctx, `SELECT count, window_start, blocked_until FROM ratelimit WHERE bucket = ? AND key = ?`, bucket, key).Scan(&c, &ws, &bu)
	if errors.Is(err, sql.ErrNoRows) {
		c, ws, bu = 0, now.Unix(), 0
	} else if err != nil {
		return RLState{}, err
	}
	if now.Unix() >= ws+int64(window.Seconds()) {
		c, ws, bu = 0, now.Unix(), 0
	}
	c++
	if d := block(c); d > 0 {
		bu = now.Add(d).Unix()
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO ratelimit (bucket, key, count, window_start, blocked_until) VALUES (?,?,?,?,?)
		ON CONFLICT(bucket, key) DO UPDATE SET count = excluded.count, window_start = excluded.window_start, blocked_until = excluded.blocked_until`,
		bucket, key, c, ws, bu); err != nil {
		return RLState{}, err
	}
	if err := tx.Commit(); err != nil {
		return RLState{}, err
	}
	return RLState{Count: c, WindowStart: time.Unix(ws, 0), BlockedUntil: time.Unix(bu, 0)}, nil
}

// RLReset forgets a counter.
func (s *Store) RLReset(ctx context.Context, bucket, key string) error {
	_, err := s.w.ExecContext(ctx, `DELETE FROM ratelimit WHERE bucket = ? AND key = ?`, bucket, key)
	return err
}

// RLSweep deletes counters whose window ended before cutoff and are not blocked.
func (s *Store) RLSweep(ctx context.Context, cutoff time.Time) error {
	_, err := s.w.ExecContext(ctx, `DELETE FROM ratelimit WHERE window_start < ? AND blocked_until < ?`, cutoff.Unix(), cutoff.Unix())
	return err
}
