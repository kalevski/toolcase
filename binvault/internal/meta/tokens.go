package meta

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"
	"time"
)

const tokenCols = `access_key_id, bucket, name, secret, grants, limits, expires_at, created_at, last_used_at, revision`

func scanToken(s rowScanner) (*Token, error) {
	var t Token
	var grants, limits string
	var exp, created, used sql.NullInt64
	if err := s.Scan(&t.AccessKeyID, &t.Bucket, &t.Name, &t.Secret, &grants, &limits, &exp, &created, &used, &t.Revision); err != nil {
		return nil, err
	}
	_ = json.Unmarshal([]byte(grants), &t.Grants)
	_ = json.Unmarshal([]byte(limits), &t.Limits)
	if exp.Valid {
		v := fromMS(exp.Int64)
		t.ExpiresAt = &v
	}
	t.CreatedAt = fromMS(created.Int64)
	if used.Valid {
		v := fromMS(used.Int64)
		t.LastUsedAt = &v
	}
	return &t, nil
}

// GetToken loads a token by access key id (ErrNotFound if absent).
func (q Q) GetToken(ctx context.Context, id string) (*Token, error) {
	t, err := scanToken(q.q.QueryRowContext(ctx, `SELECT `+tokenCols+` FROM tokens WHERE access_key_id=?`, id))
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	return t, err
}

// ListTokens lists a bucket's tokens with id > after.
func (q Q) ListTokens(ctx context.Context, bucket, after string, limit int) ([]*Token, error) {
	if limit <= 0 {
		limit = 1000
	}
	rows, err := q.q.QueryContext(ctx, `SELECT `+tokenCols+` FROM tokens WHERE bucket=? AND access_key_id > ? ORDER BY access_key_id LIMIT ?`, bucket, after, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Token
	for rows.Next() {
		t, err := scanToken(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// CountTokens counts a bucket's tokens.
func (q Q) CountTokens(ctx context.Context, bucket string) (int64, error) {
	var n int64
	err := q.q.QueryRowContext(ctx, `SELECT COUNT(*) FROM tokens WHERE bucket=?`, bucket).Scan(&n)
	return n, err
}

// AllTokens streams every token (used by rekey/validate).
func (q Q) AllTokens(ctx context.Context) ([]*Token, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT `+tokenCols+` FROM tokens ORDER BY access_key_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Token
	for rows.Next() {
		t, err := scanToken(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// CreateToken inserts a token (ErrExists on id collision).
func (t *Tx) CreateToken(ctx context.Context, tok *Token) error {
	if tok.Revision == 0 {
		tok.Revision = 1
	}
	if tok.CreatedAt.IsZero() {
		tok.CreatedAt = t.now
	}
	_, err := t.q.ExecContext(ctx, `INSERT INTO tokens (`+tokenCols+`) VALUES (?,?,?,?,?,?,?,?,?,?)`,
		tok.AccessKeyID, tok.Bucket, tok.Name, tok.Secret, jsonText(tok.Grants, "[]"), jsonText(tok.Limits, "{}"),
		msPtr(tok.ExpiresAt), ms(tok.CreatedAt), msPtr(tok.LastUsedAt), tok.Revision)
	if err != nil && strings.Contains(err.Error(), "UNIQUE") {
		return ErrExists
	}
	return err
}

// UpdateToken rewrites name, grants, limits and expiry; ifRevision>0 must match.
func (t *Tx) UpdateToken(ctx context.Context, tok *Token, ifRevision int64) error {
	res, err := t.q.ExecContext(ctx, `UPDATE tokens SET name=?, grants=?, limits=?, expires_at=?, revision=revision+1
WHERE access_key_id=? AND (?=0 OR revision=?)`, tok.Name, jsonText(tok.Grants, "[]"), jsonText(tok.Limits, "{}"),
		msPtr(tok.ExpiresAt), tok.AccessKeyID, ifRevision, ifRevision)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		if _, gerr := t.GetToken(ctx, tok.AccessKeyID); gerr != nil {
			return gerr
		}
		return ErrConflict
	}
	tok.Revision++
	return nil
}

// SetTokenSecret replaces the sealed secret (rekey).
func (t *Tx) SetTokenSecret(ctx context.Context, id string, sealed []byte) error {
	_, err := t.q.ExecContext(ctx, `UPDATE tokens SET secret=? WHERE access_key_id=?`, sealed, id)
	return err
}

// DeleteToken removes a token (revocation).
func (t *Tx) DeleteToken(ctx context.Context, id string) error {
	res, err := t.q.ExecContext(ctx, `DELETE FROM tokens WHERE access_key_id=?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// TouchTokens flushes last_used_at for several tokens at once.
func (t *Tx) TouchTokens(ctx context.Context, used map[string]time.Time) error {
	for id, at := range used {
		if _, err := t.q.ExecContext(ctx, `UPDATE tokens SET last_used_at=? WHERE access_key_id=?`, ms(at), id); err != nil {
			return err
		}
	}
	return nil
}
