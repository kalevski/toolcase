// Package store is the SQLite layer (spec §3.2): sessions, per-mailbox
// preferences and rate-limit counters. One writer connection (writes are
// serialised, WAL) plus a pool of readers; append-only migrations tracked in
// PRAGMA user_version. All SQL lives in this package.
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

// migrations are append-only: never edit an entry that has shipped.
var migrations = []string{
	// 1: sessions, prefs, rate-limit counters.
	`CREATE TABLE sessions (
		id              TEXT PRIMARY KEY,      -- sha256 hex of the cookie value
		public_id       TEXT NOT NULL UNIQUE,  -- shown to the user in Settings
		address         TEXT NOT NULL,
		domain          TEXT NOT NULL,
		created_at      INTEGER NOT NULL,      -- unix seconds
		last_used_at    INTEGER NOT NULL,
		idle_expires_at INTEGER NOT NULL,
		expires_at      INTEGER NOT NULL,      -- absolute
		remember        INTEGER NOT NULL DEFAULT 0,
		ip              TEXT NOT NULL DEFAULT '',
		user_agent      TEXT NOT NULL DEFAULT '',
		platform_id     TEXT NOT NULL DEFAULT '', -- platform-side session credential id
		cred_sealed     BLOB NOT NULL,            -- AES-256-GCM(session credential)
		account_id      TEXT NOT NULL DEFAULT '',
		csrf            TEXT NOT NULL
	);
	CREATE INDEX sessions_address ON sessions(address);
	CREATE INDEX sessions_expires ON sessions(expires_at);
	CREATE TABLE prefs (
		address    TEXT PRIMARY KEY,
		json       TEXT NOT NULL,
		updated_at INTEGER NOT NULL
	);
	CREATE TABLE ratelimit (
		bucket        TEXT NOT NULL,
		key           TEXT NOT NULL,
		count         INTEGER NOT NULL,
		window_start  INTEGER NOT NULL,
		blocked_until INTEGER NOT NULL DEFAULT 0,
		PRIMARY KEY (bucket, key)
	);`,
}

// Options configure Open.
type Options struct {
	// Readers is the size of the reader pool (default max(4, 2*GOMAXPROCS)).
	Readers int
	// Now overrides the clock (tests).
	Now func() time.Time
	// SessionCacheTTL bounds how long GetSession may serve from memory
	// (default DefaultSessionCacheTTL; negative disables the cache).
	SessionCacheTTL time.Duration
}

// Store is the database handle.
type Store struct {
	path string
	w    *sql.DB
	r    *sql.DB
	now  func() time.Time
	sc   *sessionCache
}

// ErrNotFound is returned when a row does not exist.
var ErrNotFound = errors.New("store: not found")

// Open opens (creating if needed) <dir>/webmail.db and applies migrations.
func Open(ctx context.Context, dir string, opt Options) (*Store, error) {
	if opt.Readers <= 0 {
		opt.Readers = max(4, runtime.GOMAXPROCS(0)*2)
	}
	if opt.Now == nil {
		opt.Now = time.Now
	}
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, err
	}
	path := filepath.Join(dir, "webmail.db")
	base := "file:" + escapePath(path) + "?_pragma=busy_timeout(10000)&_pragma=journal_mode(WAL)" +
		"&_pragma=synchronous(NORMAL)&_pragma=foreign_keys(1)&_pragma=temp_store(MEMORY)"
	w, err := sql.Open("sqlite", base+"&_txlock=immediate")
	if err != nil {
		return nil, err
	}
	w.SetMaxOpenConns(1)
	w.SetConnMaxLifetime(0)
	if err := w.PingContext(ctx); err != nil {
		w.Close()
		return nil, fmt.Errorf("store: open %s: %w", path, err)
	}
	r, err := sql.Open("sqlite", base+"&_pragma=query_only(1)")
	if err != nil {
		w.Close()
		return nil, err
	}
	r.SetMaxOpenConns(opt.Readers)
	r.SetMaxIdleConns(opt.Readers) // the default of 2 closes and reopens a connection (and re-prepares) under concurrency
	if opt.SessionCacheTTL == 0 {
		opt.SessionCacheTTL = DefaultSessionCacheTTL
	}
	s := &Store{path: path, w: w, r: r, now: opt.Now, sc: newSessionCache(opt.SessionCacheTTL, opt.Now)}
	if err := s.migrate(ctx); err != nil {
		w.Close()
		r.Close()
		return nil, err
	}
	return s, nil
}

func escapePath(p string) string {
	p = strings.ReplaceAll(p, "%", "%25")
	p = strings.ReplaceAll(p, "?", "%3f")
	p = strings.ReplaceAll(p, "#", "%23")
	return (&url.URL{Path: p}).EscapedPath()
}

// Path is the database file path.
func (s *Store) Path() string { return s.path }

// SchemaVersion is the highest migration this binary knows.
func SchemaVersion() int { return len(migrations) }

func (s *Store) migrate(ctx context.Context) error {
	var cur int
	if err := s.w.QueryRowContext(ctx, `PRAGMA user_version`).Scan(&cur); err != nil {
		return err
	}
	if cur > len(migrations) {
		return fmt.Errorf("store: database schema version %d is newer than this binary (%d); refusing to start", cur, len(migrations))
	}
	for i := cur; i < len(migrations); i++ {
		tx, err := s.w.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, migrations[i]); err != nil {
			tx.Rollback()
			return fmt.Errorf("store: migration %d: %w", i+1, err)
		}
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`PRAGMA user_version = %d`, i+1)); err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

// Version reports the database's current schema version.
func (s *Store) Version(ctx context.Context) (int, error) {
	var v int
	err := s.r.QueryRowContext(ctx, `PRAGMA user_version`).Scan(&v)
	return v, err
}

// Ping checks that the database answers.
func (s *Store) Ping(ctx context.Context) error { return s.r.PingContext(ctx) }

// Close closes both pools.
func (s *Store) Close() error {
	e1 := s.r.Close()
	e2 := s.w.Close()
	if e1 != nil {
		return e1
	}
	return e2
}

// Now is the store clock.
func (s *Store) Now() time.Time { return s.now() }
