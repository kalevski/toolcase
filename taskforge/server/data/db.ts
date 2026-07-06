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
// never reorder or rewrite an applied migration — add a new one. The 5.0 fresh
// start consolidated the historical v1–v10 chain into this single v1 (there are
// no pre-5.0 databases to upgrade); future schema changes append v2+.

const MIGRATIONS: string[] = [
    // v1 — full schema.
    // Secret discipline: `account.api_key_env` holds an env-var NAME (the key is
    // resolved at spawn time, never stored); `git_key` rows are metadata only —
    // the private key material is an owner-only 0600 file at
    // `${gitKeysDir}/<alias>`, referenced by `project.ssh_key_alias`.
    // (C3 search uses an FTS5 virtual table created lazily by search-repo.ts so
    //  a runtime without FTS5 degrades to "search unavailable", not a boot failure.)
    `
    CREATE TABLE project (
        name          TEXT PRIMARY KEY,
        git_url       TEXT,
        branch        TEXT,
        ssh_key_alias TEXT,
        created_at    TEXT NOT NULL
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
        model         TEXT,
        depends       TEXT,
        account       TEXT,
        PRIMARY KEY (project, id)
    );
    CREATE INDEX idx_task_status ON task(project, status);

    CREATE TABLE telemetry (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        project     TEXT NOT NULL,
        task        TEXT NOT NULL,
        status      TEXT NOT NULL,
        elapsed     REAL NOT NULL,
        model       TEXT NOT NULL,
        commit_sha  TEXT,
        error       TEXT,
        created_at  TEXT NOT NULL,
        tokens_in   INTEGER,
        tokens_out  INTEGER,
        cost_usd    REAL,
        review      TEXT,
        review_note TEXT
    );
    CREATE INDEX idx_telemetry_latest ON telemetry(project, task, id DESC);
    CREATE INDEX idx_telemetry_project_created ON telemetry(project, created_at);

    CREATE TABLE warm_session (
        project    TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        ts         INTEGER NOT NULL
    );

    CREATE TABLE run (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        project      TEXT NOT NULL,
        started_at   TEXT NOT NULL,
        finished_at  TEXT,
        reason       TEXT,
        options_json TEXT NOT NULL,
        done         INTEGER NOT NULL DEFAULT 0,
        error        INTEGER NOT NULL DEFAULT 0,
        total        INTEGER NOT NULL DEFAULT 0,
        started_by   TEXT,
        branch       TEXT,
        pr_url       TEXT
    );
    CREATE INDEX idx_run_project ON run(project, id DESC);

    CREATE TABLE run_event (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        project    TEXT NOT NULL,
        type       TEXT NOT NULL,
        task       TEXT,
        payload    TEXT,
        created_at TEXT NOT NULL,
        run_id     INTEGER
    );
    CREATE INDEX idx_run_event_project ON run_event(project, id);
    CREATE INDEX idx_run_event_run ON run_event(run_id, id);

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
        entries     TEXT NOT NULL,
        account     TEXT
    );

    CREATE TABLE meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE agent_prompt (
        project  TEXT NOT NULL,
        agent    TEXT NOT NULL,
        prompt   TEXT NOT NULL,
        model    TEXT NOT NULL,
        used_at  TEXT NOT NULL,
        PRIMARY KEY (project, agent)
    );

    CREATE TABLE agent_prompt_history (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        agent   TEXT NOT NULL,
        prompt  TEXT NOT NULL,
        model   TEXT NOT NULL,
        used_at TEXT NOT NULL
    );
    CREATE INDEX idx_prompt_history ON agent_prompt_history(project, agent, id DESC);

    CREATE TABLE prompt_template (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        agent      TEXT NOT NULL,
        prompt     TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE schedule (
        project          TEXT PRIMARY KEY,
        cron             TEXT NOT NULL,
        options_json     TEXT NOT NULL,
        enabled          INTEGER NOT NULL DEFAULT 1,
        only_if_pending  INTEGER NOT NULL DEFAULT 1,
        skip_above_usage INTEGER,
        last_fired_at    TEXT
    );

    CREATE TABLE audit (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        at        TEXT NOT NULL,
        github_id INTEGER,
        login     TEXT,
        action    TEXT NOT NULL,
        project   TEXT,
        detail    TEXT
    );
    CREATE INDEX idx_audit_id ON audit(id DESC);
    CREATE INDEX idx_audit_project ON audit(project, id DESC);

    CREATE TABLE project_setting (
        project TEXT NOT NULL,
        key     TEXT NOT NULL,
        value   TEXT NOT NULL,
        PRIMARY KEY (project, key)
    );

    CREATE TABLE agent_def (
        kind            TEXT PRIMARY KEY,
        label           TEXT NOT NULL,
        prompt_preamble TEXT NOT NULL,
        target          TEXT NOT NULL,
        post            TEXT NOT NULL DEFAULT 'none',
        created_at      TEXT NOT NULL
    );

    CREATE TABLE account (
        alias         TEXT PRIMARY KEY,
        dir           TEXT NOT NULL,
        auth          TEXT NOT NULL,
        label         TEXT,
        api_key_env   TEXT,
        last_used_at  TEXT,
        cooling_until TEXT
    );

    CREATE TABLE git_key (
        alias      TEXT PRIMARY KEY,
        label      TEXT,
        created_at TEXT NOT NULL
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
    // Foreign keys must be toggled OUTSIDE any transaction (the pragma is a
    // no-op inside one). Off for the run so a future table-REBUILD migration
    // (CREATE new → copy → DROP old → RENAME) doesn't trip references; restored
    // in `finally` so the live connection always ends up enforcing FKs.
    db.exec('PRAGMA foreign_keys = OFF;')
    try {
        // DAT-1 — serialize the whole migration sequence behind the SQLite write
        // lock. `BEGIN IMMEDIATE` grabs the RESERVED lock up front, so if two
        // processes boot at once only one migrates; the other blocks (busy_timeout)
        // then sees the migrations already applied. The applied set is re-read
        // *inside* the lock so we never re-run a migration a peer just committed.
        db.exec('BEGIN IMMEDIATE')
        try {
            const rows = db.prepare('SELECT version FROM schema_migrations').all() as unknown as {
                version: number
            }[]
            const applied = new Set(rows.map((r) => r.version))
            const insert = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
            for (let i = 0; i < MIGRATIONS.length; i++) {
                const version = i + 1
                if (applied.has(version)) continue
                db.exec(MIGRATIONS[i])
                insert.run(version, new Date().toISOString())
            }
            db.exec('COMMIT')
        } catch (err) {
            db.exec('ROLLBACK')
            throw err
        }
    } finally {
        db.exec('PRAGMA foreign_keys = ON;')
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

// DatabaseSync has no nested transactions, so `tx()` is reentrant: an inner
// call joins the open transaction and only the outermost owns BEGIN/COMMIT/
// ROLLBACK. Lets a service compose repo helpers that use tx() themselves.
let txDepth = 0

/** Run `fn` inside a transaction (synchronous — DatabaseSync is sync). Reentrant. */
export function tx<T>(fn: () => T): T {
    const { db } = wrap()
    if (txDepth > 0) return fn()
    txDepth++
    db.exec('BEGIN')
    try {
        const result = fn()
        db.exec('COMMIT')
        return result
    } catch (err) {
        db.exec('ROLLBACK')
        throw err
    } finally {
        txDepth--
    }
}

/** Force-open the connection (and run migrations) eagerly. */
export function initDb(): void {
    wrap()
}
