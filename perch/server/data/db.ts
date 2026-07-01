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
    // v5 — per-base-domain subdomain TLS policy (§0/Phase D). One wildcard cert per base
    // domain covers every `<label>.<base>` subdomain, so TLS is decided once here, never
    // per subdomain. `auto` degrades to HTTP when the cert isn't issued yet (so a missing
    // cert never takes subdomains down); existing rows default to `auto`. Inert unless
    // nginxpilot runs in managed mode.
    `
    ALTER TABLE base_domain ADD COLUMN tls TEXT NOT NULL DEFAULT 'auto';  -- off | auto
    `,
    // v6 — realms: registered nginxpilot instances (owner-managed, multiple_realms.md §2.1).
    // Each realm is one nginxpilot the control plane can drive. `token_enc` is the
    // AES-256-GCM ciphertext of the bearer token (NULL = unauthenticated instance); the
    // plaintext token never leaves the server. The partial unique index enforces "exactly
    // one default realm" at the DB layer — setting a new default is a two-step tx.
    `
    CREATE TABLE realm (
        id          TEXT PRIMARY KEY,         -- server-generated short id
        name        TEXT NOT NULL,            -- human label ("prod-eu", "lab")
        admin_url   TEXT NOT NULL,            -- https://nginxpilot.internal:9090 (normalized, no trailing /)
        token_enc   TEXT,                     -- AES-256-GCM ciphertext of the bearer token; NULL = unauthenticated
        is_default  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL
    );
    CREATE UNIQUE INDEX idx_realm_one_default ON realm(is_default) WHERE is_default = 1;
    `,
    // v7 — per-user realm access grants (M:N, multiple_realms.md §2.1). A row = "this user
    // may use this realm". `is_default` marks the user's own operating realm among their
    // grants (owner-managed; non-owners never switch, §0.6). Cascades with the user/realm.
    `
    CREATE TABLE user_realm (
        github_id  INTEGER NOT NULL REFERENCES app_user(github_id) ON DELETE CASCADE,
        realm_id   TEXT    NOT NULL REFERENCES realm(id)           ON DELETE CASCADE,
        is_default INTEGER NOT NULL DEFAULT 0,
        granted_at TEXT    NOT NULL,
        PRIMARY KEY (github_id, realm_id)
    );
    `,
    // v8 — sites belong to a realm (the instance they deploy to, multiple_realms.md §2.1,
    // §10.2). Hostname uniqueness becomes PER-REALM: two nginx ingresses are independent,
    // so the same hostname can legitimately exist in each. SQLite can't drop a column-level
    // UNIQUE in place, so rebuild the table: add `realm_id`, swap the global UNIQUE(hostname)
    // for UNIQUE(realm_id, hostname). `realm_id` is left NULL here and backfilled to the
    // seed default realm at boot (`services/realms.ts` ensureSeed), after which app code
    // treats it as required. This is a CREATE-new / DROP-old / RENAME rebuild, which SQLite
    // requires `foreign_keys` to be OFF for — the migration runner toggles it OFF around the
    // whole run and back ON afterwards (D2), so a future inbound FK can't silently corrupt
    // data on an un-migrated instance. (A `PRAGMA` inside this SQL would be a no-op — it runs
    // inside the migration's `BEGIN`/`COMMIT`, where SQLite ignores the foreign_keys toggle.)
    `
    CREATE TABLE site_new (
        id          TEXT PRIMARY KEY,
        owner_id    INTEGER NOT NULL,
        repo_owner  TEXT NOT NULL,
        repo_name   TEXT NOT NULL,
        branch      TEXT NOT NULL,
        subdir      TEXT,
        hostname    TEXT NOT NULL,
        host_kind   TEXT NOT NULL,
        status      TEXT NOT NULL,
        bytes       INTEGER,
        last_ref    TEXT,
        last_error  TEXT,
        realm_id    TEXT REFERENCES realm(id),
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    );
    INSERT INTO site_new (id, owner_id, repo_owner, repo_name, branch, subdir, hostname,
                          host_kind, status, bytes, last_ref, last_error, realm_id, created_at, updated_at)
        SELECT id, owner_id, repo_owner, repo_name, branch, subdir, hostname,
               host_kind, status, bytes, last_ref, last_error, NULL, created_at, updated_at
        FROM site;
    DROP TABLE site;
    ALTER TABLE site_new RENAME TO site;
    CREATE INDEX idx_site_owner ON site(owner_id);
    CREATE UNIQUE INDEX idx_site_realm_hostname ON site(realm_id, hostname);
    `,
    // v9 — base-domain pools belong to a realm (multiple_realms.md §2.1, §10.4): a
    // wildcard is served by exactly one instance. Nullable to survive the ALTER; the seed
    // backfill assigns the default realm at boot, after which app code treats it as set.
    `
    ALTER TABLE base_domain ADD COLUMN realm_id TEXT REFERENCES realm(id);
    `,
    // v10 — sponsorships are keyed by the sponsor's IMMUTABLE numeric GitHub id, not
    // their (reusable) login (S3). A recycled username could otherwise inherit a stale
    // sponsorship and silently get a paid plan. Rebuild the table: `sponsor_id` becomes
    // the PK (== app_user.github_id), `sponsor_login` is kept for display only. Existing
    // rows are backfilled by joining the old login-keyed rows to app_user; rows whose
    // login has no matching user can't be linked to an id (and granted nothing under
    // id-based resolution, since plan lookup needs the user row), so they're dropped —
    // the GraphQL reconcile re-creates any still-valid sponsorship with its id within a
    // minute. CREATE-new / DROP-old / RENAME rebuild (foreign_keys is toggled OFF around
    // the whole migration run; see `migrate`).
    `
    CREATE TABLE sponsorship_new (
        sponsor_id    INTEGER PRIMARY KEY,     -- == app_user.github_id (immutable)
        sponsor_login TEXT NOT NULL,           -- display only; NOT the key
        tier_cents    INTEGER NOT NULL,
        status        TEXT NOT NULL,           -- active | pending_cancel | cancelled
        effective_at  TEXT NOT NULL,
        updated_at    TEXT NOT NULL
    );
    INSERT INTO sponsorship_new (sponsor_id, sponsor_login, tier_cents, status, effective_at, updated_at)
        SELECT u.github_id, s.sponsor_login, s.tier_cents, s.status, s.effective_at, s.updated_at
        FROM sponsorship s
        JOIN app_user u ON u.login = s.sponsor_login;
    DROP TABLE sponsorship;
    ALTER TABLE sponsorship_new RENAME TO sponsorship;
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
    // SQLite requires foreign keys OFF during a CREATE-new / DROP-old / RENAME table
    // rebuild (migrations v8/v10), and the PRAGMA is a no-op *inside* a transaction — so
    // toggle it here, around the whole migration run, OUTSIDE any `BEGIN` (D2). Today only
    // the rebuild migrations need this; doing it for the loop is simplest and harmless,
    // since migrations either don't touch FKs or are run on a freshly-open connection
    // before any request. It is restored to ON before the connection serves traffic.
    db.exec('PRAGMA foreign_keys = OFF;')
    try {
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
// `BEGIN` throws "cannot start a transaction within a transaction" — so a `tx()`
// composed inside another `tx()` (e.g. `ensureSeed` calling `grantAllUsers`) must
// JOIN the open transaction rather than start a new one.
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
