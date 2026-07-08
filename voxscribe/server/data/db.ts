// SQLite system-of-record (spec §6.2). Single owner of the `node:sqlite`
// `DatabaseSync` handle, cached on `globalThis` so Next dev hot-reload reuses one
// connection. Ported from the blueprint: single `DatabaseSync`, WAL mode,
// ordered append-only `MIGRATIONS[]` runner.
//
// `node:sqlite` is a built-in module available on Node >= 22.5. We load it via
// `process.getBuiltinModule` so this module can be imported on older runtimes
// without crashing at import time — it fails fast with an actionable message
// only when the DB is first touched. Node's bundled SQLite ships with FTS5.

import 'server-only'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
// Type-only import: erased at compile time, so it never triggers a runtime
// `require('node:sqlite')` on a Node version that lacks the module.
import type { DatabaseSync, StatementSync } from 'node:sqlite'

interface DbWrap {
    db: DatabaseSync
    /** Prepared-statement cache, keyed by SQL text (prepare once, reuse). */
    stmts: Map<string, StatementSync>
}

declare global {
    var __voxscribeDb: DbWrap | undefined
}

/**
 * Resolve the SQLite file path: `VOXSCRIBE_DB_PATH`/`DB_PATH` override, else
 * `voxscribe.db` under the workspace dir. Read straight from the environment so
 * tests can point at a temp file before first import of any repository.
 */
function resolveDbPath(): string {
    const explicit = process.env.VOXSCRIBE_DB_PATH ?? process.env.DB_PATH
    if (explicit && explicit.trim() !== '') return explicit.trim()
    const workspace = process.env.WORKSPACE_DIR?.trim() || '/workspace'
    return path.join(workspace, 'voxscribe.db')
}

/** Load `node:sqlite` synchronously, or throw a clear, actionable error. */
function loadDatabaseSync(): typeof DatabaseSync {
    const getBuiltin = (
        process as NodeJS.Process & {
            getBuiltinModule?: (id: string) => unknown
        }
    ).getBuiltinModule
    if (typeof getBuiltin === 'function') {
        const mod = getBuiltin('node:sqlite') as { DatabaseSync?: typeof DatabaseSync } | undefined
        if (mod?.DatabaseSync) return mod.DatabaseSync
    }
    throw new Error(
        `[voxscribe] The built-in 'node:sqlite' module is unavailable on this runtime ` +
            `(Node ${process.version}). voxscribe requires Node >= 22.5. ` +
            `Upgrade your Node version (the Dockerfile pins node:22-slim).`,
    )
}

function open(): DbWrap {
    const DatabaseSyncCtor = loadDatabaseSync()
    const dbPath = resolveDbPath()
    mkdirSync(path.dirname(dbPath), { recursive: true })
    const db = new DatabaseSyncCtor(dbPath)
    // WAL: concurrent readers + one writer, durable, good for our single process.
    db.exec('PRAGMA journal_mode = WAL;')
    // SQLite defaults foreign keys OFF; the note_tag cascade depends on it (§6.2).
    db.exec('PRAGMA foreign_keys = ON;')
    db.exec('PRAGMA busy_timeout = 5000;')
    migrate(db)
    return { db, stmts: new Map() }
}

function wrap(): DbWrap {
    if (!globalThis.__voxscribeDb) globalThis.__voxscribeDb = open()
    return globalThis.__voxscribeDb
}

// ── migrations ─────────────────────────────────────────────────────────────
// Ordered, append-only list of schema SQL. Each entry's index+1 is its version;
// never reorder or rewrite an applied migration — add a new one.

type Migration = string | ((db: DatabaseSync) => void)

const MIGRATIONS: Migration[] = [
    // v1 — the complete voxscribe schema (spec §6.2).
    `
    -- Users + roles (spec §3). admin | standard; guest is a runtime-only
    -- fallback for a session whose user row is gone — never stored.
    CREATE TABLE app_user (
        github_id  INTEGER PRIMARY KEY,
        login      TEXT NOT NULL,
        name       TEXT NOT NULL,
        avatar_url TEXT,
        role       TEXT NOT NULL,
        added_at   TEXT NOT NULL
    );

    -- Audit log. Append-only; writes are best-effort.
    CREATE TABLE audit (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        at        TEXT NOT NULL,
        github_id INTEGER,
        login     TEXT,
        action    TEXT NOT NULL,
        detail    TEXT
    );
    CREATE INDEX idx_audit_id ON audit(id DESC);

    -- Transcriptions (spec §6.2). Transcript text/segments live ON DISK
    -- (whisper output files are the source of truth); this row is metadata.
    CREATE TABLE transcription (
        id TEXT PRIMARY KEY,                       -- newId('trn') → 'trn_x8k2…'
        owner_id INTEGER NOT NULL REFERENCES app_user(github_id),
        title TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        media_ext TEXT NOT NULL,
        media_bytes INTEGER NOT NULL,
        media_sha256 TEXT NOT NULL,
        duration_seconds REAL,                     -- from ffprobe
        language TEXT NOT NULL DEFAULT 'auto',     -- requested
        detected_language TEXT,
        translate INTEGER NOT NULL DEFAULT 0,
        model TEXT NOT NULL,
        status TEXT NOT NULL,                      -- pending | processing | done | failed
        progress INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
    );
    CREATE INDEX idx_trn_owner_created ON transcription(owner_id, created_at DESC);
    CREATE INDEX idx_trn_status ON transcription(status);
    CREATE INDEX idx_trn_owner_sha ON transcription(owner_id, media_sha256);   -- per-owner duplicate check (§5.6)

    -- FTS over transcript plain text; rows inserted on 'done', deleted with the
    -- transcription (same tx).
    CREATE VIRTUAL TABLE transcript_fts USING fts5(
        transcription_id UNINDEXED, content
    );

    -- Notes (spec §4.5). Content is a .md file on disk; this row is metadata.
    CREATE TABLE note (
        id TEXT PRIMARY KEY,                       -- newId('nte') → 'nte_…'
        owner_id INTEGER NOT NULL REFERENCES app_user(github_id),
        title TEXT NOT NULL,
        note_date TEXT NOT NULL,                   -- 'YYYY-MM-DD', user-supplied
        content_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_note_owner_date ON note(owner_id, note_date DESC);

    -- Shared tag vocabulary (v2 transcription tags reuse this table).
    CREATE TABLE tag (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE                  -- normalized kebab-case (§4.5)
    );

    CREATE TABLE note_tag (
        note_id TEXT NOT NULL REFERENCES note(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tag(id),
        PRIMARY KEY (note_id, tag_id)
    );
    CREATE INDEX idx_note_tag_tag ON note_tag(tag_id);

    CREATE VIRTUAL TABLE note_fts USING fts5(
        note_id UNINDEXED, title, content
    );
    `,

    // v2 — instance settings (branding + theme), a key/value table mirroring
    // quaykeeper's app_setting. Keys are the SETTING_KEYS in domain/settings.ts.
    `
    CREATE TABLE app_setting (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TEXT NOT NULL
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
    // SQLite requires foreign keys OFF during a CREATE-new / DROP-old / RENAME
    // table rebuild, and the PRAGMA is a no-op *inside* a transaction — toggle it
    // around the whole migration run, OUTSIDE any BEGIN. Restored to ON before
    // the connection serves traffic.
    db.exec('PRAGMA foreign_keys = OFF;')
    try {
        for (let i = 0; i < MIGRATIONS.length; i++) {
            const version = i + 1
            if (applied.has(version)) continue
            db.exec('BEGIN')
            try {
                const m = MIGRATIONS[i]
                if (typeof m === 'function') m(db)
                else db.exec(m)
                insert.run(version, new Date().toISOString())
                db.exec('COMMIT')
            } catch (err) {
                db.exec('ROLLBACK')
                throw err
            }
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

// Reentrancy depth for `tx`. DatabaseSync has no nested transactions — a second
// `BEGIN` throws — so a `tx()` composed inside another `tx()` must JOIN the open
// transaction rather than start a new one.
let txDepth = 0

/**
 * Run `fn` inside a transaction (synchronous — DatabaseSync is sync). Reentrant:
 * the outermost call owns BEGIN/COMMIT/ROLLBACK; nested calls just run `fn` within
 * the open transaction. A throw at any depth propagates to the outermost call,
 * which rolls the whole unit back (all-or-nothing).
 */
export function tx<T>(fn: () => T): T {
    const { db } = wrap()
    if (txDepth > 0) {
        txDepth++
        try {
            return fn()
        } finally {
            txDepth--
        }
    }
    db.exec('BEGIN')
    txDepth++
    let committed = false
    try {
        const result = fn()
        db.exec('COMMIT')
        committed = true
        return result
    } catch (err) {
        // Only roll back a failure that happened BEFORE commit — a failed COMMIT
        // has already resolved the transaction, and attempting ROLLBACK on it
        // throws, which would replace the original error instead of explaining it.
        if (!committed) {
            try {
                db.exec('ROLLBACK')
            } catch {
                // Ignore — the original `err` explains the failure.
            }
        }
        throw err
    } finally {
        txDepth--
    }
}

/** Force-open the connection (and run migrations) eagerly. */
export function initDb(): void {
    wrap()
}
