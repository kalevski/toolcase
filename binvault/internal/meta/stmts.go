package meta

import (
	"context"
	"database/sql"
	"sync"
)

// maxStmts bounds the prepared-statement cache. The query texts are a small fixed set
// (a few dozen, plus the variants the list builder assembles), so the bound is only a
// guard against a caller that formats a value into the SQL: past it, queries are
// prepared per call as before.
const maxStmts = 512

// stmtDB is the reader pool with its statements prepared once. A *sql.Stmt on a *sql.DB
// is re-prepared lazily on each pooled connection, so repeated hot queries (GetBucket,
// GetLatest, ...) skip SQLite's parser instead of parsing the same text on every request.
type stmtDB struct {
	db    *sql.DB
	mu    sync.RWMutex
	stmts map[string]*sql.Stmt
}

func newStmtDB(db *sql.DB) *stmtDB { return &stmtDB{db: db, stmts: map[string]*sql.Stmt{}} }

// stmt returns the cached statement for query, preparing it on first use; nil when the
// cache is full (the caller falls back to the plain *sql.DB).
func (s *stmtDB) stmt(ctx context.Context, query string) (*sql.Stmt, error) {
	s.mu.RLock()
	st := s.stmts[query]
	s.mu.RUnlock()
	if st != nil {
		return st, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if st = s.stmts[query]; st != nil {
		return st, nil
	}
	if len(s.stmts) >= maxStmts {
		return nil, nil
	}
	// not the request's context: the statement outlives the request
	st, err := s.db.PrepareContext(context.WithoutCancel(ctx), query)
	if err != nil {
		return nil, err
	}
	s.stmts[query] = st
	return st, nil
}

func (s *stmtDB) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return s.db.ExecContext(ctx, query, args...)
}

func (s *stmtDB) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	st, err := s.stmt(ctx, query)
	if err != nil || st == nil {
		return s.db.QueryContext(ctx, query, args...)
	}
	return st.QueryContext(ctx, args...)
}

func (s *stmtDB) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	st, err := s.stmt(ctx, query)
	if err != nil || st == nil {
		return s.db.QueryRowContext(ctx, query, args...)
	}
	return st.QueryRowContext(ctx, args...)
}

// close closes the cached statements; the pool itself is closed by the caller.
func (s *stmtDB) close() {
	s.mu.Lock()
	for _, st := range s.stmts {
		st.Close()
	}
	s.stmts = map[string]*sql.Stmt{}
	s.mu.Unlock()
}
