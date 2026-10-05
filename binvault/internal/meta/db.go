// Package meta is the SQLite metadata layer (spec §3.2): one serialised writer
// that groups concurrent commits into one transaction and one fsync, and a pool
// of readers. All SQL lives in this package.
package meta

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
	"sync"
	"sync/atomic"
	"time"

	_ "modernc.org/sqlite"
)

// Options configure Open.
type Options struct {
	// Synchronous is the SQLite synchronous level: "FULL" (default) or "NORMAL"
	// (used when BINVAULT_FSYNC=false).
	Synchronous string
	// Readers is the size of the reader pool (default 2*GOMAXPROCS, min 4).
	Readers int
	// Now overrides the clock (tests).
	Now func() time.Time
}

// DB is the metadata store.
type DB struct {
	path string
	base string // DSN prefix, reused for the short-lived backup connection
	ro   bool
	w    *sql.DB
	r    *sql.DB
	now  func() time.Time

	gate   atomic.Pointer[gateHolder]
	reqs   chan *txReq
	stop   chan struct{}
	done   chan struct{}
	closed sync.Once
}

type txReq struct {
	ctx  context.Context
	fn   func(*Tx) error
	done chan error
}

// Querier is the subset of *sql.DB / *sql.Tx the query helpers need.
type Querier interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// Q carries the read helpers; it is embedded in Tx and returned by DB.Read.
type Q struct{ q Querier }

// Tx is a write transaction (one request's savepoint inside a group commit).
type Tx struct {
	Q
	now   time.Time
	after []func()
}

// Now is the transaction's timestamp (one clock reading per request).
func (t *Tx) Now() time.Time { return t.now }

// AfterCommit registers fn to run once the enclosing commit succeeded.
func (t *Tx) AfterCommit(fn func()) { t.after = append(t.after, fn) }

// Open opens (creating if needed) the database at path and applies migrations.
func Open(ctx context.Context, path string, opt Options) (*DB, error) {
	if opt.Synchronous == "" {
		opt.Synchronous = "FULL"
	}
	if opt.Readers <= 0 {
		opt.Readers = runtime.GOMAXPROCS(0) * 2
		if opt.Readers < 4 {
			opt.Readers = 4
		}
	}
	if opt.Now == nil {
		opt.Now = time.Now
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return nil, err
	}
	base := "file:" + escapePath(path) + "?_pragma=busy_timeout(10000)&_pragma=journal_mode(WAL)" +
		"&_pragma=synchronous(" + opt.Synchronous + ")&_pragma=foreign_keys(1)&_pragma=temp_store(MEMORY)"
	w, err := sql.Open("sqlite", base+"&_txlock=immediate")
	if err != nil {
		return nil, err
	}
	w.SetMaxOpenConns(1)
	w.SetConnMaxLifetime(0)
	if err := w.PingContext(ctx); err != nil {
		w.Close()
		return nil, fmt.Errorf("meta: open %s: %w", path, err)
	}
	r, err := sql.Open("sqlite", base+"&_pragma=query_only(1)")
	if err != nil {
		w.Close()
		return nil, err
	}
	r.SetMaxOpenConns(opt.Readers)
	d := &DB{path: path, base: base, w: w, r: r, now: opt.Now,
		reqs: make(chan *txReq, 1024), stop: make(chan struct{}), done: make(chan struct{})}
	if err := d.migrate(ctx); err != nil {
		w.Close()
		r.Close()
		return nil, err
	}
	go d.committer()
	return d, nil
}

func escapePath(p string) string {
	p = strings.ReplaceAll(p, "%", "%25")
	p = strings.ReplaceAll(p, "?", "%3f")
	p = strings.ReplaceAll(p, "#", "%23")
	return (&url.URL{Path: p}).EscapedPath()
}

// Path returns the database file path.
func (d *DB) Path() string { return d.path }

// SchemaVersion is the highest migration this binary knows.
func SchemaVersion() int { return len(migrations) }

func (d *DB) migrate(ctx context.Context) error {
	var cur int
	if err := d.w.QueryRowContext(ctx, `PRAGMA user_version`).Scan(&cur); err != nil {
		return err
	}
	if cur > len(migrations) {
		return fmt.Errorf("meta: database schema version %d is newer than this binary (%d); refusing to start", cur, len(migrations))
	}
	for i := cur; i < len(migrations); i++ {
		tx, err := d.w.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, migrations[i]); err != nil {
			tx.Rollback()
			return fmt.Errorf("meta: migration %d: %w", i+1, err)
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
func (d *DB) Version(ctx context.Context) (int, error) {
	var v int
	err := d.r.QueryRowContext(ctx, `PRAGMA user_version`).Scan(&v)
	return v, err
}

// Read returns the read helpers over the reader pool.
func (d *DB) Read() Q { return Q{d.r} }

// Raw exposes the reader pool (tests, validate).
func (d *DB) Raw() *sql.DB { return d.r }

// ErrClosed is returned by Update after Close.
var ErrClosed = errors.New("meta: database closed")

// Update runs fn in a write transaction. Concurrent Updates are grouped into
// one SQLite transaction (one fsync) with a savepoint per request, so an error
// from fn rolls back only that request. fn must be short and must not do I/O
// other than SQL. When Update returns nil the change is durable.
func (d *DB) Update(ctx context.Context, fn func(tx *Tx) error) error {
	if d.ro {
		return ErrReadOnly
	}
	req := &txReq{ctx: ctx, fn: fn, done: make(chan error, 1)}
	select {
	case d.reqs <- req:
	case <-d.stop:
		return ErrClosed
	case <-ctx.Done():
		return ctx.Err()
	}
	// Once queued the committer answers (also on Close); if it has already
	// exited, a last non-blocking look decides between "answered" and "closed".
	select {
	case err := <-req.done:
		return err
	case <-d.done:
		select {
		case err := <-req.done:
			return err
		default:
			return ErrClosed
		}
	}
}

func (d *DB) committer() {
	defer close(d.done)
	for {
		select {
		case <-d.stop:
			d.drain(ErrClosed)
			return
		case first := <-d.reqs:
			batch := []*txReq{first}
		collect:
			for len(batch) < 128 {
				select {
				case r := <-d.reqs:
					batch = append(batch, r)
				default:
					break collect
				}
			}
			d.runBatch(batch)
		}
	}
}

func (d *DB) drain(err error) {
	for {
		select {
		case r := <-d.reqs:
			r.done <- err
		default:
			return
		}
	}
}

func (d *DB) runBatch(batch []*txReq) {
	ctx := context.Background()
	sqltx, err := d.w.BeginTx(ctx, nil)
	if err != nil {
		for _, r := range batch {
			r.done <- err
		}
		return
	}
	type result struct {
		err   error
		after []func()
	}
	res := make([]result, len(batch))
	now := d.now().UTC()
	gate := d.writeGate()
	for i, r := range batch {
		if cerr := r.ctx.Err(); cerr != nil {
			res[i].err = cerr
			continue
		}
		exit := func() {}
		if b := BucketFrom(r.ctx); b != "" && gate != nil {
			e, gerr := gate(r.ctx, b)
			if gerr != nil {
				res[i].err = gerr
				continue
			}
			if e != nil {
				exit = e
			}
		}
		if _, err := sqltx.ExecContext(ctx, `SAVEPOINT req`); err != nil {
			exit()
			res[i].err = err
			continue
		}
		// statements run under a context that ignores the request's cancellation:
		// the driver interrupts a statement whose context is cancelled, and SQLite
		// then rolls back the whole shared transaction, failing every other request
		// of the batch (a client that disconnects must not poison its neighbours)
		tx := &Tx{Q: Q{noCancel{sqltx}}, now: now}
		ferr := safeCall(r.fn, tx)
		exit()
		if ferr != nil {
			sqltx.ExecContext(ctx, `ROLLBACK TO req`)
			sqltx.ExecContext(ctx, `RELEASE req`)
			res[i].err = ferr
			continue
		}
		if _, err := sqltx.ExecContext(ctx, `RELEASE req`); err != nil {
			res[i].err = err
			continue
		}
		res[i].after = tx.after
	}
	cerr := sqltx.Commit()
	for i, r := range batch {
		switch {
		case res[i].err != nil:
			r.done <- res[i].err
		case cerr != nil:
			r.done <- cerr
		default:
			for _, f := range res[i].after {
				f()
			}
			r.done <- nil
		}
	}
}

// noCancel runs every statement of a write transaction without the caller's
// cancellation (values are kept).
type noCancel struct{ tx *sql.Tx }

func (n noCancel) ExecContext(ctx context.Context, q string, args ...any) (sql.Result, error) {
	return n.tx.ExecContext(context.WithoutCancel(ctx), q, args...)
}
func (n noCancel) QueryContext(ctx context.Context, q string, args ...any) (*sql.Rows, error) {
	return n.tx.QueryContext(context.WithoutCancel(ctx), q, args...)
}
func (n noCancel) QueryRowContext(ctx context.Context, q string, args ...any) *sql.Row {
	return n.tx.QueryRowContext(context.WithoutCancel(ctx), q, args...)
}

func safeCall(fn func(*Tx) error, tx *Tx) (err error) {
	defer func() {
		if p := recover(); p != nil {
			err = fmt.Errorf("meta: panic in transaction: %v", p)
		}
	}()
	return fn(tx)
}

// Close stops the committer and closes both pools.
func (d *DB) Close() error {
	var err error
	d.closed.Do(func() {
		if d.ro {
			err = d.r.Close()
			return
		}
		close(d.stop)
		<-d.done
		// checkpoint the WAL on the way out (spec §9.4)
		d.w.Exec(`PRAGMA wal_checkpoint(TRUNCATE)`)
		err = errors.Join(d.r.Close(), d.w.Close())
	})
	return err
}

// Backup writes a consistent copy of the database to dst (VACUUM INTO). It
// uses a short-lived connection of its own: VACUUM INTO only reads the source,
// so it neither blocks the writer nor is it allowed on the query_only readers.
func (d *DB) Backup(ctx context.Context, dst string) error {
	c, err := sql.Open("sqlite", d.base)
	if err != nil {
		return err
	}
	defer c.Close()
	_, err = c.ExecContext(ctx, `VACUUM INTO ?`, dst)
	return err
}

// ErrReadOnly is returned by Update on a database opened with OpenReadOnly.
var ErrReadOnly = errors.New("meta: database opened read-only")

// OpenReadOnly opens an existing database for inspection (`validate`): no
// migrations are applied and nothing is written.
func OpenReadOnly(ctx context.Context, path string) (*DB, error) {
	dsn := "file:" + escapePath(path) + "?mode=ro&_pragma=busy_timeout(10000)&_pragma=query_only(1)"
	r, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	if err := r.PingContext(ctx); err != nil {
		r.Close()
		return nil, fmt.Errorf("meta: open %s read-only: %w", path, err)
	}
	r.SetMaxOpenConns(2)
	done := make(chan struct{})
	close(done)
	return &DB{path: path, r: r, ro: true, done: done}, nil
}

// ---- small scan helpers shared by the query files -------------------------

func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func nullInt(p *int64) any {
	if p == nil {
		return nil
	}
	return *p
}

func isNoRows(err error) bool { return errors.Is(err, sql.ErrNoRows) }
