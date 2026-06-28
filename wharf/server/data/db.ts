// SQLite system-of-record. Single owner of the `node:sqlite` `DatabaseSync`
// handle, cached on `globalThis` so Next dev hot-reload reuses one connection and
// the Agent API listener (instrumentation.ts) shares the same in-process handle.
//
// `node:sqlite` is a built-in available on Node >= 22.5 (stable/flag-free on Node
// 24). Loaded via `process.getBuiltinModule` so importing this file on an older
// runtime doesn't crash at import — it fails fast, with an actionable message,
// only when the DB is first touched.

import 'server-only'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type { DatabaseSync, StatementSync } from 'node:sqlite'
import { config } from '@/server/config'

interface DbWrap {
    db: DatabaseSync
    /** Prepared-statement cache, keyed by SQL text (prepare once, reuse). */
    stmts: Map<string, StatementSync>
}

declare global {
    var __wharfDb: DbWrap | undefined
}

function loadDatabaseSync(): typeof DatabaseSync {
    const getBuiltin = (
        process as NodeJS.Process & { getBuiltinModule?: (id: string) => unknown }
    ).getBuiltinModule
    if (typeof getBuiltin === 'function') {
        const mod = getBuiltin('node:sqlite') as { DatabaseSync?: typeof DatabaseSync } | undefined
        if (mod?.DatabaseSync) return mod.DatabaseSync
    }
    throw new Error(
        `[wharf] The built-in 'node:sqlite' module is unavailable on this runtime ` +
            `(Node ${process.version}). Wharf requires Node >= 22.5 (Node 24 recommended). ` +
            `Upgrade Node (the Dockerfile already pins node:24-slim).`,
    )
}

function open(): DbWrap {
    const DatabaseSyncCtor = loadDatabaseSync()
    mkdirSync(path.dirname(config.dbPath), { recursive: true })
    const db = new DatabaseSyncCtor(config.dbPath)
    db.exec('PRAGMA journal_mode = WAL;') // concurrent readers + one writer, durable
    db.exec('PRAGMA foreign_keys = ON;')
    db.exec('PRAGMA busy_timeout = 5000;')
    migrate(db)
    return { db, stmts: new Map() }
}

function wrap(): DbWrap {
    if (!globalThis.__wharfDb) globalThis.__wharfDb = open()
    return globalThis.__wharfDb
}

// ── migrations ─────────────────────────────────────────────────────────────
// Ordered, append-only (planning §4). Each entry's index+1 is its version; never
// reorder or rewrite an applied migration — add a new one.

const MIGRATIONS: string[] = [
    // v1 — blueprint baseline: users + audit (audit scoped by nullable project_id)
    `
    CREATE TABLE app_user (
        github_id  INTEGER PRIMARY KEY,
        login      TEXT NOT NULL,
        name       TEXT NOT NULL,
        avatar_url TEXT,
        role       TEXT NOT NULL,          -- 'owner' | 'guest'
        added_at   TEXT NOT NULL
    );
    CREATE TABLE audit (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        at         TEXT NOT NULL,
        github_id  INTEGER,
        login      TEXT,
        action     TEXT NOT NULL,
        detail     TEXT,
        project_id TEXT                     -- nullable; scopes audit to a project
    );
    CREATE INDEX idx_audit_id ON audit(id DESC);
    CREATE INDEX idx_audit_project ON audit(project_id, id DESC);
    `,
    // v2 — projects & membership
    `
    CREATE TABLE project (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        slug       TEXT NOT NULL UNIQUE,
        created_by INTEGER NOT NULL,
        created_at TEXT NOT NULL
    );
    CREATE TABLE project_member (
        id           TEXT PRIMARY KEY,
        project_id   TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
        github_id    INTEGER NOT NULL REFERENCES app_user(github_id) ON DELETE CASCADE,
        project_role TEXT NOT NULL,         -- 'developer' | 'devops'
        granted_by   INTEGER NOT NULL,
        granted_at   TEXT NOT NULL,
        UNIQUE(project_id, github_id)
    );
    CREATE INDEX idx_member_github ON project_member(github_id);
    CREATE INDEX idx_member_project ON project_member(project_id);
    `,
    // v3 — environments & instances (instance carries its own fetch credential)
    `
    CREATE TABLE environment (
        id              TEXT PRIMARY KEY,
        project_id      TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
        name            TEXT NOT NULL,
        sort_order      INTEGER NOT NULL DEFAULT 0,
        strict_required INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL,
        UNIQUE(project_id, name)
    );
    CREATE INDEX idx_environment_project ON environment(project_id, sort_order);
    CREATE TABLE instance (
        id             TEXT PRIMARY KEY,
        environment_id TEXT NOT NULL REFERENCES environment(id) ON DELETE CASCADE,
        name           TEXT NOT NULL,
        key_hash       TEXT,                -- SHA-256 of the fetch secret; NULL until minted
        key_set_at     TEXT,
        key_expires_at TEXT,                -- optional fetch-key expiry (NULL = no expiry); gap-10
        last_fetch_at  TEXT,                -- last successful Agent-API fetch (incl. 304); §3.2 watermark
        created_at     TEXT NOT NULL,
        UNIQUE(environment_id, name)
    );
    CREATE INDEX idx_instance_environment ON instance(environment_id);
    `,
    // v4 — secrets (project level, devops-only values; AES-256-GCM ciphertext)
    `
    CREATE TABLE secret (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
        key         TEXT NOT NULL,
        value_enc   TEXT NOT NULL,
        description TEXT,
        created_by  INTEGER NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        UNIQUE(project_id, key)
    );
    CREATE INDEX idx_secret_project ON secret(project_id);
    `,
    // v5 — environment variables (two scopes via nullable instance_id)
    `
    CREATE TABLE env_var (
        id             TEXT PRIMARY KEY,
        project_id     TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
        environment_id TEXT NOT NULL REFERENCES environment(id) ON DELETE CASCADE,
        instance_id    TEXT REFERENCES instance(id) ON DELETE CASCADE,   -- NULL = env-scope baseline
        key            TEXT NOT NULL,
        source         TEXT NOT NULL,        -- 'literal' | 'secret_ref'
        value_enc      TEXT,                 -- literal value (encrypted), NULL for secret_ref
        secret_id      TEXT REFERENCES secret(id) ON DELETE RESTRICT,    -- set iff source='secret_ref'
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL,
        UNIQUE(environment_id, instance_id, key)
    );
    CREATE INDEX idx_env_var_env ON env_var(environment_id, instance_id);
    CREATE INDEX idx_env_var_secret ON env_var(secret_id);
    `,
    // v6 — feature flags (project level, value per environment)
    `
    CREATE TABLE feature_flag (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
        key         TEXT NOT NULL,
        description TEXT,
        type        TEXT NOT NULL DEFAULT 'boolean',  -- boolean|string|number|json
        created_at  TEXT NOT NULL,
        UNIQUE(project_id, key)
    );
    CREATE TABLE feature_flag_value (
        id             TEXT PRIMARY KEY,
        flag_id        TEXT NOT NULL REFERENCES feature_flag(id) ON DELETE CASCADE,
        environment_id TEXT NOT NULL REFERENCES environment(id) ON DELETE CASCADE,
        enabled        INTEGER NOT NULL DEFAULT 0,
        value          TEXT,
        updated_at     TEXT NOT NULL,
        UNIQUE(flag_id, environment_id)
    );
    CREATE INDEX idx_flag_project ON feature_flag(project_id);
    CREATE INDEX idx_flag_value_flag ON feature_flag_value(flag_id);
    CREATE INDEX idx_flag_value_env ON feature_flag_value(environment_id);
    `,
    // v7 — notes (project level, revealable sensitive data; AES-256-GCM ciphertext)
    `
    CREATE TABLE note (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
        title       TEXT NOT NULL,
        content_enc TEXT NOT NULL,
        created_by  INTEGER NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    );
    CREATE INDEX idx_note_project ON note(project_id);
    `,
    // v8 — saved docker-run command specs (project level, owner/devops)
    `
    CREATE TABLE docker_command (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        spec_json   TEXT NOT NULL,
        instance_id TEXT REFERENCES instance(id) ON DELETE SET NULL,
        created_by  INTEGER NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        UNIQUE(project_id, name)
    );
    CREATE INDEX idx_docker_command_project ON docker_command(project_id);
    `,
    // v9 — per-key documentation + required flag (additive ALTERs)
    `
    ALTER TABLE env_var ADD COLUMN description TEXT;
    ALTER TABLE env_var ADD COLUMN required INTEGER NOT NULL DEFAULT 0;
    `,
    // v10 — backup snapshots (owner-managed; §8.7)
    `
    CREATE TABLE backup (
        id         TEXT PRIMARY KEY,
        path       TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        encrypted  INTEGER NOT NULL DEFAULT 1,
        kind       TEXT NOT NULL DEFAULT 'auto',     -- 'auto' | 'manual'
        key_id     TEXT,
        created_at TEXT NOT NULL,
        created_by INTEGER
    );
    CREATE INDEX idx_backup_created ON backup(created_at DESC);
    `,
    // v11 — owner-editable instance settings (branding); generic key/value store
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

/**
 * Take a consistent snapshot of the DB to `destPath` via SQLite `VACUUM INTO`
 * (used by the backup ticker, §8.7). Writes a single defragmented file.
 */
export function vacuumInto(destPath: string): void {
    // VACUUM INTO does not accept a bound parameter for the path; the caller
    // supplies a server-controlled path (BACKUP_DIR + generated id), never user input.
    wrap().db.exec(`VACUUM INTO '${destPath.replace(/'/g, "''")}'`)
}
