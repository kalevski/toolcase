// SQLite system-of-record (§5 persistence). Single owner of the `node:sqlite`
// `DatabaseSync` handle, cached on `globalThis` so Next dev hot-reload reuses one
// connection. Ported verbatim from TaskForge's `server/data/db.ts`: single
// `DatabaseSync`, WAL mode, ordered append-only `MIGRATIONS[]` runner. Only the
// migration sequence (§12 schema) and the Perch branding/db-path differ.
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

interface DbWrap {
    db: DatabaseSync
    /** Prepared-statement cache, keyed by SQL text (prepare once, reuse). */
    stmts: Map<string, StatementSync>
}

declare global {
    var __perchDb: DbWrap | undefined
}

/**
 * Resolve the SQLite file path. Perch has no central `config` module yet (it
 * arrives with the auth/config task), so the one value `db.ts` needs is read
 * straight from the environment: `PERCH_DB_PATH`/`DB_PATH` override, else a
 * `perch.db` under the workspace dir.
 */
function resolveDbPath(): string {
    const explicit = process.env.PERCH_DB_PATH ?? process.env.DB_PATH
    if (explicit && explicit.trim() !== '') return explicit.trim()
    const workspace = process.env.WORKSPACE_DIR?.trim() || '/workspace'
    return path.join(workspace, 'perch.db')
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
        `[perch] The built-in 'node:sqlite' module is unavailable on this runtime ` +
            `(Node ${process.version}). Perch requires Node >= 22.5 (Node 24 recommended). ` +
            `Upgrade your Node version (the Dockerfile already pins node:24-slim).`,
    )
}

function open(): DbWrap {
    const DatabaseSyncCtor = loadDatabaseSync()
    const dbPath = resolveDbPath()
    mkdirSync(path.dirname(dbPath), { recursive: true })
    const db = new DatabaseSyncCtor(dbPath)
    // WAL: concurrent readers + one writer, durable, good for our single process.
    db.exec('PRAGMA journal_mode = WAL;')
    db.exec('PRAGMA foreign_keys = ON;')
    db.exec('PRAGMA busy_timeout = 5000;')
    migrate(db)
    return { db, stmts: new Map() }
}

function wrap(): DbWrap {
    if (!globalThis.__perchDb) globalThis.__perchDb = open()
    return globalThis.__perchDb
}

// ── migrations ─────────────────────────────────────────────────────────────
// Ordered, append-only list of schema SQL. Each entry's index+1 is its version;
// never reorder or rewrite an applied migration — add a new one.

const MIGRATIONS: string[] = [
    // v1 — initial schema (notes/static-hosting-app-design.md §12)
    `
    CREATE TABLE app_user (
        github_id  INTEGER PRIMARY KEY,
        login      TEXT NOT NULL,
        name       TEXT NOT NULL,
        avatar_url TEXT,
        role       TEXT NOT NULL,            -- owner | standard | guest
        added_at   TEXT NOT NULL
    );

    CREATE TABLE base_domain (               -- owner-managed subdomain pool
        domain     TEXT PRIMARY KEY,         -- e.g. perch.dev
        created_at TEXT NOT NULL
    );

    CREATE TABLE site (
        id          TEXT PRIMARY KEY,        -- short id; also the fragment filename suffix
        owner_id    INTEGER NOT NULL,        -- app_user.github_id
        repo_owner  TEXT NOT NULL,
        repo_name   TEXT NOT NULL,
        branch      TEXT NOT NULL,
        subdir      TEXT,
        hostname    TEXT NOT NULL UNIQUE,    -- alice.perch.dev | www.example.com
        host_kind   TEXT NOT NULL,           -- subdomain | custom
        status      TEXT NOT NULL,           -- draft|provisioning|live|failed|suspended|over_quota
        bytes       INTEGER,                 -- last measured deployed size
        last_ref    TEXT,                    -- last live git ref (from /status)
        last_error  TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    );
    CREATE INDEX idx_site_owner ON site(owner_id);

    CREATE TABLE sponsorship (
        sponsor_login TEXT PRIMARY KEY,      -- == app_user.login
        tier_cents    INTEGER NOT NULL,
        status        TEXT NOT NULL,         -- active | pending_cancel | cancelled
        effective_at  TEXT NOT NULL,
        updated_at    TEXT NOT NULL
    );

    CREATE TABLE plan_tier (                 -- owner-editable $ → plan mapping
        min_cents INTEGER PRIMARY KEY,
        plan      TEXT NOT NULL              -- bronze | silver | gold
    );

    CREATE TABLE audit (                     -- mirror TaskForge audit log
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        at        TEXT NOT NULL,
        github_id INTEGER,
        login     TEXT,
        action    TEXT NOT NULL,
        site      TEXT,
        detail    TEXT
    );
    CREATE INDEX idx_audit_id ON audit(id DESC);
    `,
    // v2 — base-domain audience tiers (§10). Each base domain is offered to one of
    // three groups: free accounts, paid (sponsored) accounts, or staff (maintainer/
    // owner). Existing rows default to `free` so nothing a user could already pick
    // disappears on upgrade.
    `
    ALTER TABLE base_domain ADD COLUMN tier TEXT NOT NULL DEFAULT 'free';  -- free | paid | staff
    `,
    // v3 — per-user custom limit overrides (§11, §15). An owner can tweak any one
    // user's quotas above/below their role/plan default. A row exists only when a
    // user is customised; every column is nullable and a NULL field inherits the
    // default. Cascades away if the user row is ever deleted.
    `
    CREATE TABLE user_limit (
        github_id          INTEGER PRIMARY KEY REFERENCES app_user(github_id) ON DELETE CASCADE,
        max_sites          INTEGER,        -- NULL = inherit role/plan default
        max_bytes_per_site INTEGER,
        max_bytes_total    INTEGER,
        min_interval_sec   INTEGER,
        custom_domains     INTEGER,
        keep_releases      INTEGER,
        private_repos      INTEGER,        -- 0 | 1 | NULL (inherit)
        updated_at         TEXT NOT NULL
    );
    `,
    // v4 — global instance settings (owner-editable branding + custom-domain
    // ingress). A generic key/value store: one row per setting, value is the raw
    // string the UI persisted (validated in `domain/settings.ts` before it lands).
    // A missing key falls through to its built-in default / env fallback, so the
    // table is empty on a fresh instance and every setting is optional.
    `
    CREATE TABLE app_setting (
        key        TEXT PRIMARY KEY,       -- app_name | tagline | theme | brand_color | ingress_ipv4 | ingress_ipv6
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
