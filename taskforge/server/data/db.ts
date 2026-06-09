// SQLite system-of-record (§persistence). Single owner of the `node:sqlite`
// `DatabaseSync` handle, cached on `globalThis` so Next dev hot-reload reuses one
// connection (mirrors the engine singleton in execution-manager.ts).
//
// `node:sqlite` is a built-in module available on Node >= 22.5 (stable/flag-free
// on Node 24). We load it via `process.getBuiltinModule` (Node 22.3+) so this
// module can be imported on older runtimes without crashing at import time —
// it fails fast with an actionable message only when the DB is first touched.

import 'server-only'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
// Type-only import: erased at compile time, so it never triggers a runtime
// `require('node:sqlite')` on a Node version that lacks the module.
import type { DatabaseSync, StatementSync } from 'node:sqlite'
import { config } from '@/server/config'

interface DbWrap {
    db: DatabaseSync
    /** Prepared-statement cache, keyed by SQL text (prepare once, reuse). */
    stmts: Map<string, StatementSync>
}

declare global {
    var __taskforgeDb: DbWrap | undefined
}

/** Load `node:sqlite` synchronously, or throw a clear, actionable error. */
function loadDatabaseSync(): typeof DatabaseSync {
    const getBuiltin = (process as NodeJS.Process & {
        getBuiltinModule?: (id: string) => unknown
    }).getBuiltinModule
    if (typeof getBuiltin === 'function') {
        const mod = getBuiltin('node:sqlite') as { DatabaseSync?: typeof DatabaseSync } | undefined
        if (mod?.DatabaseSync) return mod.DatabaseSync
    }
    throw new Error(
        `[taskforge] The built-in 'node:sqlite' module is unavailable on this runtime ` +
            `(Node ${process.version}). TaskForge requires Node >= 22.5 (Node 24 recommended). ` +
            `Upgrade your Node version (the Dockerfile already pins node:24-slim).`,
    )
}

function open(): DbWrap {
    const DatabaseSyncCtor = loadDatabaseSync()
    mkdirSync(path.dirname(config.dbPath), { recursive: true })
    const db = new DatabaseSyncCtor(config.dbPath)
    // WAL: concurrent readers + one writer, durable, good for our single process.
    db.exec('PRAGMA journal_mode = WAL;')
    db.exec('PRAGMA foreign_keys = ON;')
    db.exec('PRAGMA busy_timeout = 5000;')
    migrate(db)
    return { db, stmts: new Map() }
}

function wrap(): DbWrap {
    if (!globalThis.__taskforgeDb) globalThis.__taskforgeDb = open()
    return globalThis.__taskforgeDb
}

// ── migrations ─────────────────────────────────────────────────────────────
// Ordered, append-only list of schema SQL. Each entry's index+1 is its version;
// never reorder or rewrite an applied migration — add a new one.

const MIGRATIONS: string[] = [
    // v1 — initial schema
    `
    CREATE TABLE project (
        name        TEXT PRIMARY KEY,
        git_url     TEXT,
        branch      TEXT,
        created_at  TEXT NOT NULL
    );

    CREATE TABLE task (
        project       TEXT NOT NULL,
        id            TEXT NOT NULL,
        title         TEXT NOT NULL,
        severity      TEXT,
        facet_project TEXT,
        status        TEXT NOT NULL DEFAULT 'open',
        last_error    TEXT,
        synced_mtime  INTEGER,
        updated_at    TEXT NOT NULL,
        PRIMARY KEY (project, id)
    );
    CREATE INDEX idx_task_status ON task(project, status);

    CREATE TABLE telemetry (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        project    TEXT NOT NULL,
        task       TEXT NOT NULL,
        status     TEXT NOT NULL,
        elapsed    REAL NOT NULL,
        model      TEXT NOT NULL,
        commit_sha TEXT,
        error      TEXT,
        created_at TEXT NOT NULL
    );
    CREATE INDEX idx_telemetry_latest ON telemetry(project, task, id DESC);

    CREATE TABLE warm_session (
        project    TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        ts         INTEGER NOT NULL
    );

    CREATE TABLE run_event (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        project    TEXT NOT NULL,
        type       TEXT NOT NULL,
        task       TEXT,
        payload    TEXT,
        created_at TEXT NOT NULL
    );
    CREATE INDEX idx_run_event_project ON run_event(project, id);

    CREATE TABLE app_user (
        github_id  INTEGER PRIMARY KEY,
        login      TEXT NOT NULL,
        name       TEXT NOT NULL,
        avatar_url TEXT,
        role       TEXT NOT NULL,
        added_at   TEXT NOT NULL
    );

    CREATE TABLE usage_snapshot (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        fetched_at  TEXT NOT NULL,
        note        TEXT,
        raw         TEXT NOT NULL,
        max_percent INTEGER NOT NULL,
        entries     TEXT NOT NULL
    );

    CREATE TABLE meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    `,
]

function migrate(db: DatabaseSync): void {
    db.exec(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );`,
    )
    const rows = db.prepare('SELECT version FROM schema_migrations').all() as unknown as {
        version: number
    }[]
    const applied = new Set(rows.map((r) => r.version))
    const insert = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
    for (let i = 0; i < MIGRATIONS.length; i++) {
        const version = i + 1
        if (applied.has(version)) continue
        db.exec('BEGIN')
        try {
            db.exec(MIGRATIONS[i])
            insert.run(version, new Date().toISOString())
            db.exec('COMMIT')
        } catch (err) {
            db.exec('ROLLBACK')
            throw err
        }
    }
}

// ── public helpers (the only surface repositories use) ───────────────────────

/** Prepare (and cache) a statement. */
export function prep(sql: string): StatementSync {
    const w = wrap()
    let s = w.stmts.get(sql)
    if (!s) {
        s = w.db.prepare(sql)
        w.stmts.set(sql, s)
    }
    return s
}

// `node:sqlite` types `.get`/`.all` as `Record<string, SQLOutputValue>`. These
// thin generics centralize the (safe) cast to the caller's row shape so repos
// stay free of `as unknown as` noise.

/** Run a query and return the first row typed as `T` (or undefined). */
export function getRow<T>(sql: string, ...params: any[]): T | undefined {
    return prep(sql).get(...params) as unknown as T | undefined
}

/** Run a query and return all rows typed as `T[]`. */
export function allRows<T>(sql: string, ...params: any[]): T[] {
    return prep(sql).all(...params) as unknown as T[]
}

/** Run raw SQL (DDL / multi-statement). */
export function exec(sql: string): void {
    wrap().db.exec(sql)
}

/** Run `fn` inside a transaction (synchronous — DatabaseSync is sync). */
export function tx<T>(fn: () => T): T {
    const { db } = wrap()
    db.exec('BEGIN')
    try {
        const result = fn()
        db.exec('COMMIT')
        return result
    } catch (err) {
        db.exec('ROLLBACK')
        throw err
    }
}

/** Force-open the connection (and run migrations) eagerly. */
export function initDb(): void {
    wrap()
}
