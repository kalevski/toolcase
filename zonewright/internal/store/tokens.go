package store

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/kalevski/toolcase/zonewright/internal/hlc"
)

// TokenPayload is the token register's value. Only the SHA-256 of the
// secret is replicated; the secret itself is shown once, at creation.
type TokenPayload struct {
	Hash     string   `json:"hash,omitempty"`  // lowercase hex SHA-256 of the secret
	Scope    string   `json:"scope,omitempty"` // config.ScopeACME
	Zones    []string `json:"zones,omitempty"` // normalized; empty = no zone (unless AllZones)
	AllZones bool     `json:"all_zones,omitempty"`
	Created  string   `json:"created,omitempty"` // RFC 3339, first creation (kept across updates)
	Deleted  bool     `json:"deleted,omitempty"`
}

// Token is a live API-created token.
type Token struct {
	Name     string
	Hash     string
	Scope    string
	Zones    []string
	AllZones bool
	Created  string
}

// TokenRow is a token register as it travels in a snapshot.
type TokenRow struct {
	Name    string        `json:"name"`
	Hash    string        `json:"hash"`
	Payload []byte        `json:"payload"`
	Deleted bool          `json:"deleted"`
	HLC     hlc.Timestamp `json:"hlc"`
	Origin  string        `json:"origin"`
	Seq     int64         `json:"seq"`
}

func applyToken(tx *sql.Tx, op *Op) error {
	var curH int64
	var curO string
	err := tx.QueryRow(`SELECT hlc, origin FROM tokens WHERE name = ?`, op.Name).Scan(&curH, &curO)
	if err == nil && !wins(op.HLC, op.Origin, hlc.Timestamp(curH), curO) {
		return nil
	}
	var p TokenPayload
	if err := json.Unmarshal(op.Payload, &p); err != nil {
		return fmt.Errorf("op %s: %w", op.ID(), err)
	}
	deleted, hash := 0, p.Hash
	if p.Deleted {
		deleted, hash = 1, ""
	}
	_, err = tx.Exec(`INSERT INTO tokens(name, hash, payload, deleted, hlc, origin, seq) VALUES(?,?,?,?,?,?,?)
		ON CONFLICT(name) DO UPDATE SET hash=excluded.hash, payload=excluded.payload, deleted=excluded.deleted,
		hlc=excluded.hlc, origin=excluded.origin, seq=excluded.seq`,
		op.Name, hash, []byte(op.Payload), deleted, int64(op.HLC), op.Origin, op.Seq)
	return err
}

func scanToken(name string, payload []byte) (Token, error) {
	var p TokenPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return Token{}, fmt.Errorf("token %s: %w", name, err)
	}
	return Token{Name: name, Hash: p.Hash, Scope: p.Scope, Zones: p.Zones, AllZones: p.AllZones, Created: p.Created}, nil
}

// Tokens returns every live API-created token, sorted by name.
func (s *Store) Tokens() ([]Token, error) {
	rows, err := s.db.Query(`SELECT name, payload FROM tokens WHERE deleted = 0 ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Token
	for rows.Next() {
		var name string
		var payload []byte
		if err := rows.Scan(&name, &payload); err != nil {
			return nil, err
		}
		t, err := scanToken(name, payload)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// Token returns one live API-created token by name.
func (s *Store) Token(name string) (Token, bool, error) {
	return s.tokenWhere(`name = ?`, name)
}

// TokenByHash returns the live token whose secret hashes to hash.
func (s *Store) TokenByHash(hash string) (Token, bool, error) {
	if hash == "" {
		return Token{}, false, nil
	}
	return s.tokenWhere(`hash = ?`, hash)
}

func (s *Store) tokenWhere(where string, arg string) (Token, bool, error) {
	var name string
	var payload []byte
	err := s.db.QueryRow(`SELECT name, payload FROM tokens WHERE deleted = 0 AND `+where, arg).Scan(&name, &payload)
	if errors.Is(err, sql.ErrNoRows) {
		return Token{}, false, nil
	}
	if err != nil {
		return Token{}, false, err
	}
	t, err := scanToken(name, payload)
	return t, err == nil, err
}

func snapshotTokens(q querier) ([]TokenRow, error) {
	rows, err := q.Query(`SELECT name, hash, payload, deleted, hlc, origin, seq FROM tokens`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []TokenRow
	for rows.Next() {
		var t TokenRow
		var d int
		var h int64
		if err := rows.Scan(&t.Name, &t.Hash, &t.Payload, &d, &h, &t.Origin, &t.Seq); err != nil {
			return nil, err
		}
		t.Deleted, t.HLC = d == 1, hlc.Timestamp(h)
		out = append(out, t)
	}
	return out, rows.Err()
}

// mergeTokenRow folds one snapshot token register in with the winner rule.
func mergeTokenRow(tx *sql.Tx, t TokenRow) error {
	var curH int64
	var curO string
	err := tx.QueryRow(`SELECT hlc, origin FROM tokens WHERE name = ?`, t.Name).Scan(&curH, &curO)
	if err == nil && !wins(t.HLC, t.Origin, hlc.Timestamp(curH), curO) {
		return nil
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	d, hash := 0, t.Hash
	if t.Deleted {
		d, hash = 1, ""
	}
	_, err = tx.Exec(`INSERT OR REPLACE INTO tokens(name, hash, payload, deleted, hlc, origin, seq) VALUES(?,?,?,?,?,?,?)`,
		t.Name, hash, t.Payload, d, int64(t.HLC), t.Origin, t.Seq)
	return err
}

// compactTokens drops deleted tokens whose tombstone op is gone from the log.
func compactTokens(tx *sql.Tx, gone func(origin string, seq int64) bool) error {
	rows, err := tx.Query(`SELECT name, origin, seq FROM tokens WHERE deleted = 1`)
	if err != nil {
		return err
	}
	var dead []string
	for rows.Next() {
		var name, origin string
		var seq int64
		if err := rows.Scan(&name, &origin, &seq); err != nil {
			rows.Close()
			return err
		}
		if gone(origin, seq) {
			dead = append(dead, name)
		}
	}
	rows.Close()
	for _, name := range dead {
		if _, err := tx.Exec(`DELETE FROM tokens WHERE name = ?`, name); err != nil {
			return err
		}
	}
	return nil
}
