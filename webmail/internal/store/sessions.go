package store

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

// Session is one row of the sessions table.
type Session struct {
	ID            string // sha256 hex of the cookie value
	PublicID      string
	Address       string
	Domain        string
	CreatedAt     time.Time
	LastUsedAt    time.Time
	IdleExpiresAt time.Time
	ExpiresAt     time.Time
	Remember      bool
	IP            string
	UserAgent     string
	CredSealed    []byte
	AccountID     string
	CSRF          string
}

const sessionCols = `id, public_id, address, domain, created_at, last_used_at, idle_expires_at, expires_at,
	remember, ip, user_agent, cred_sealed, account_id, csrf`

func scanSession(sc interface{ Scan(...any) error }) (*Session, error) {
	var s Session
	var created, last, idle, abs int64
	var rem int
	if err := sc.Scan(&s.ID, &s.PublicID, &s.Address, &s.Domain, &created, &last, &idle, &abs,
		&rem, &s.IP, &s.UserAgent, &s.CredSealed, &s.AccountID, &s.CSRF); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	s.CreatedAt, s.LastUsedAt = time.Unix(created, 0), time.Unix(last, 0)
	s.IdleExpiresAt, s.ExpiresAt = time.Unix(idle, 0), time.Unix(abs, 0)
	s.Remember = rem != 0
	return &s, nil
}

// CreateSession inserts a session.
func (s *Store) CreateSession(ctx context.Context, x *Session) error {
	defer s.sc.drop(x.ID)
	_, err := s.w.ExecContext(ctx, `INSERT INTO sessions (`+sessionCols+`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		x.ID, x.PublicID, x.Address, x.Domain, x.CreatedAt.Unix(), x.LastUsedAt.Unix(), x.IdleExpiresAt.Unix(),
		x.ExpiresAt.Unix(), b2i(x.Remember), x.IP, x.UserAgent, x.CredSealed, x.AccountID, x.CSRF)
	return err
}

// GetSession loads a session by id (the cookie hash). Hits come from a short
// in-memory cache (see sesscache.go); every writer below drops its entries, so
// callers must still check the expiry fields against the real clock. The
// result is a private copy. Misses (unknown id) are never cached.
func (s *Store) GetSession(ctx context.Context, id string) (*Session, error) {
	cached, epoch, ok := s.sc.get(id)
	if ok {
		return cached, nil
	}
	x, err := scanSession(s.r.QueryRowContext(ctx, `SELECT `+sessionCols+` FROM sessions WHERE id = ?`, id))
	if err != nil {
		return nil, err
	}
	s.sc.put(id, x, epoch)
	return x, nil
}

// TouchSession records use and the new idle expiry.
func (s *Store) TouchSession(ctx context.Context, id string, last, idle time.Time) error {
	defer s.sc.drop(id)
	_, err := s.w.ExecContext(ctx, `UPDATE sessions SET last_used_at = ?, idle_expires_at = ? WHERE id = ?`,
		last.Unix(), idle.Unix(), id)
	return err
}

// SetAccountID stores the JMAP account id learned from the session document.
func (s *Store) SetAccountID(ctx context.Context, id, accountID string) error {
	defer s.sc.drop(id)
	_, err := s.w.ExecContext(ctx, `UPDATE sessions SET account_id = ? WHERE id = ?`, accountID, id)
	return err
}

// DeleteSession removes a session and reports whether it existed.
func (s *Store) DeleteSession(ctx context.Context, id string) (bool, error) {
	defer s.sc.drop(id)
	r, err := s.w.ExecContext(ctx, `DELETE FROM sessions WHERE id = ?`, id)
	if err != nil {
		return false, err
	}
	n, _ := r.RowsAffected()
	return n > 0, nil
}

// ListSessions returns the live sessions of an address, newest first.
func (s *Store) ListSessions(ctx context.Context, address string, now time.Time) ([]*Session, error) {
	rows, err := s.r.QueryContext(ctx, `SELECT `+sessionCols+` FROM sessions
		WHERE address = ? AND expires_at > ? AND idle_expires_at > ? ORDER BY created_at DESC, public_id`,
		address, now.Unix(), now.Unix())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Session
	for rows.Next() {
		x, err := scanSession(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

// TakeSessionByPublicID deletes and returns one of an address's sessions.
func (s *Store) TakeSessionByPublicID(ctx context.Context, address, publicID string) (*Session, error) {
	defer s.sc.dropAll() // the id is only known after the read; rare, so drop everything
	tx, err := s.w.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	x, err := scanSession(tx.QueryRowContext(ctx, `SELECT `+sessionCols+` FROM sessions WHERE address = ? AND public_id = ?`, address, publicID))
	if err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM sessions WHERE id = ?`, x.ID); err != nil {
		return nil, err
	}
	return x, tx.Commit()
}

// TakeAllSessions deletes and returns every session of an address.
func (s *Store) TakeAllSessions(ctx context.Context, address string) ([]*Session, error) {
	defer s.sc.dropAll()
	tx, err := s.w.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	rows, err := tx.QueryContext(ctx, `SELECT `+sessionCols+` FROM sessions WHERE address = ?`, address)
	if err != nil {
		return nil, err
	}
	var out []*Session
	for rows.Next() {
		x, err := scanSession(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		out = append(out, x)
	}
	rows.Close()
	if _, err := tx.ExecContext(ctx, `DELETE FROM sessions WHERE address = ?`, address); err != nil {
		return nil, err
	}
	return out, tx.Commit()
}

// TakeExpired deletes and returns sessions past their idle or absolute expiry.
func (s *Store) TakeExpired(ctx context.Context, now time.Time) ([]*Session, error) {
	defer s.sc.dropAll()
	tx, err := s.w.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	rows, err := tx.QueryContext(ctx, `SELECT `+sessionCols+` FROM sessions WHERE expires_at <= ? OR idle_expires_at <= ?`, now.Unix(), now.Unix())
	if err != nil {
		return nil, err
	}
	var out []*Session
	for rows.Next() {
		x, err := scanSession(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		out = append(out, x)
	}
	rows.Close()
	if len(out) > 0 {
		if _, err := tx.ExecContext(ctx, `DELETE FROM sessions WHERE expires_at <= ? OR idle_expires_at <= ?`, now.Unix(), now.Unix()); err != nil {
			return nil, err
		}
	}
	return out, tx.Commit()
}

// CountSessions is the number of stored sessions (metrics).
func (s *Store) CountSessions(ctx context.Context) (int, error) {
	var n int
	err := s.r.QueryRowContext(ctx, `SELECT COUNT(*) FROM sessions`).Scan(&n)
	return n, err
}

func b2i(b bool) int {
	if b {
		return 1
	}
	return 0
}

// ---- preferences ------------------------------------------------------------

// GetPrefs returns the stored JSON for an address ("" if none).
func (s *Store) GetPrefs(ctx context.Context, address string) (string, error) {
	var j string
	err := s.r.QueryRowContext(ctx, `SELECT json FROM prefs WHERE address = ?`, address).Scan(&j)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return j, err
}

// PutPrefs replaces the stored JSON for an address.
func (s *Store) PutPrefs(ctx context.Context, address, js string, now time.Time) error {
	_, err := s.w.ExecContext(ctx, `INSERT INTO prefs (address, json, updated_at) VALUES (?,?,?)
		ON CONFLICT(address) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`, address, js, now.Unix())
	return err
}
