// SQLite system-of-record (§5 persistence). Single owner of the `node:sqlite`
// `DatabaseSync` handle, cached on `globalThis` so Next dev hot-reload reuses one
// connection. Ported verbatim from TaskForge's `server/data/db.ts`: single
// `DatabaseSync`, WAL mode, ordered append-only `MIGRATIONS[]` runner. Only the
// migration sequence (§12 schema) and the Quaykeeper branding/db-path differ.
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
    var __quaykeeperDb: DbWrap | undefined
}

/**
 * Resolve the SQLite file path. Quaykeeper has no central `config` module yet (it
 * arrives with the auth/config task), so the one value `db.ts` needs is read
 * straight from the environment: `QUAYKEEPER_DB_PATH`/`DB_PATH` override, else a
 * `quaykeeper.db` under the workspace dir.
 */
function resolveDbPath(): string {
    const explicit = process.env.QUAYKEEPER_DB_PATH ?? process.env.DB_PATH
    if (explicit && explicit.trim() !== '') return explicit.trim()
    const workspace = process.env.WORKSPACE_DIR?.trim() || '/workspace'
    return path.join(workspace, 'quaykeeper.db')
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
        `[quaykeeper] The built-in 'node:sqlite' module is unavailable on this runtime ` +
            `(Node ${process.version}). Quaykeeper requires Node >= 22.5 (Node 24 recommended). ` +
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
    if (!globalThis.__quaykeeperDb) globalThis.__quaykeeperDb = open()
    return globalThis.__quaykeeperDb
}

// ── migrations ─────────────────────────────────────────────────────────────
// Ordered, append-only list of schema SQL. Each entry's index+1 is its version;
// never reorder or rewrite an applied migration — add a new one. An entry may
// also be a function (DDL + row-level backfill in TS) — it runs inside the same
// per-version transaction as a SQL entry.

type Migration = string | ((db: DatabaseSync) => void)

const MIGRATIONS: Migration[] = [
    // v1 — the complete Quaykeeper schema, kept as a single squashed entry. The
    // database is recreated on schema change (pre-release: no live data, no
    // upgrade path), so new tables/columns are merged into this entry in place
    // rather than appended as a new migration.
    `
    -- Users + roles (static-hosting-app-design.md §12). Two assignable roles:
    -- owner (full control, manages other users' features) and standard. The guest
    -- role is a runtime-only fallback for a session whose user row is gone — never stored.
    CREATE TABLE app_user (
        github_id  INTEGER PRIMARY KEY,
        login      TEXT NOT NULL,
        name       TEXT NOT NULL,
        avatar_url TEXT,
        role       TEXT NOT NULL,            -- owner | standard
        added_at   TEXT NOT NULL
    );

    -- Per-user quota overrides (§11, §15). A row exists only when a user is
    -- customised; every column is nullable and a NULL field inherits the default.
    CREATE TABLE user_limit (
        github_id          INTEGER PRIMARY KEY REFERENCES app_user(github_id) ON DELETE CASCADE,
        max_sites          INTEGER,        -- NULL = inherit role default
        max_bytes_per_site INTEGER,
        max_bytes_total    INTEGER,
        min_interval_sec   INTEGER,
        custom_domains     INTEGER,
        keep_releases      INTEGER,
        private_repos      INTEGER,        -- 0 | 1 | NULL (inherit)
        advanced_config    INTEGER,        -- 0 | 1 | NULL (inherit) — the raw-nginx "advanced" escape hatch
        updated_at         TEXT NOT NULL
    );

    -- Per-user feature overrides. A row exists only when the owner has explicitly
    -- toggled a feature for this user; absence = follow the global default. The
    -- effective visibility is: globalEnabled(feature) && (override ?? true).
    -- Owners are exempt (they always see every feature to manage it).
    CREATE TABLE user_feature (
        github_id   INTEGER NOT NULL REFERENCES app_user(github_id) ON DELETE CASCADE,
        feature_key TEXT    NOT NULL,
        enabled     INTEGER NOT NULL,       -- 0 | 1 (row present = explicit override)
        updated_at  TEXT    NOT NULL,
        PRIMARY KEY (github_id, feature_key)
    );

    -- Durable GitHub credential (private-repo support): the user's OAuth access
    -- token, AES-256-GCM-encrypted via infrastructure/cipher.ts — never plaintext
    -- at rest, never sent to the client.
    CREATE TABLE user_github_token (
        github_id  INTEGER PRIMARY KEY REFERENCES app_user(github_id) ON DELETE CASCADE,
        token_enc  TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    -- Realms: registered nginxpilot instances (multiple_realms.md §2.1). token_enc
    -- is the AES-256-GCM ciphertext of the bearer token (NULL = unauthenticated);
    -- the plaintext never leaves the server. The partial unique index enforces
    -- "exactly one default realm" at the DB layer.
    CREATE TABLE realm (
        id          TEXT PRIMARY KEY,         -- server-generated short id
        name        TEXT NOT NULL,            -- human label ("prod-eu", "lab")
        admin_url   TEXT NOT NULL,            -- https://nginxpilot.internal:9090 (normalized, no trailing /)
        token_enc   TEXT,                     -- AES-256-GCM ciphertext; NULL = unauthenticated
        is_default  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL
    );
    CREATE UNIQUE INDEX idx_realm_one_default ON realm(is_default) WHERE is_default = 1;

    -- Per-user realm access grants (M:N). is_default marks the user's own operating
    -- realm among their grants (owner-managed; non-owners never switch, §0.6).
    CREATE TABLE user_realm (
        github_id  INTEGER NOT NULL REFERENCES app_user(github_id) ON DELETE CASCADE,
        realm_id   TEXT    NOT NULL REFERENCES realm(id)           ON DELETE CASCADE,
        is_default INTEGER NOT NULL DEFAULT 0,
        granted_at TEXT    NOT NULL,
        PRIMARY KEY (github_id, realm_id)
    );

    -- Owner-managed subdomain pool. Each base domain belongs to one realm (a
    -- wildcard is served by exactly one instance) and carries the per-base
    -- wildcard TLS policy (auto degrades to HTTP while the cert isn't issued, so
    -- a missing cert never takes subdomains down) plus the per-base HTTP/2 and HSTS
    -- policies (see BaseDomain.http2 / .hsts — both cert-scoped, so they live here,
    -- not per subdomain).
    -- Every base domain is offered to all users — there is no audience tier.
    CREATE TABLE base_domain (
        domain     TEXT PRIMARY KEY,              -- e.g. quaykeeper.dev
        tls        TEXT NOT NULL DEFAULT 'auto',  -- off | auto
        http2      INTEGER NOT NULL DEFAULT 1,    -- HTTP/2 for every subdomain under the wildcard; inert while tls = off
        hsts       INTEGER NOT NULL DEFAULT 0,    -- Strict-Transport-Security; opt-in only (sticky in browsers), inert while tls = off
        realm_id   TEXT REFERENCES realm(id),     -- NULL only until the boot backfill assigns the default realm
        created_at TEXT NOT NULL
    );

    -- Sites. Hostname uniqueness is PER-REALM (two nginx ingresses are independent,
    -- so the same hostname can legitimately exist in each). realm_id is assigned by
    -- the boot backfill (services/realms.ts ensureSeed), after which app code treats
    -- it as required.
    CREATE TABLE site (
        id           TEXT PRIMARY KEY,        -- short id; also the fragment filename suffix
        owner_id     INTEGER NOT NULL,        -- app_user.github_id
        repo_owner   TEXT NOT NULL,
        repo_name    TEXT NOT NULL,
        source_type  TEXT,                    -- git (NULL) | http-zip
        source_url   TEXT,                    -- explicit URL; NULL = derive https://github.com/<owner>/<name>.git
        branch       TEXT NOT NULL,           -- git only (an http-zip source ignores it)
        subdir       TEXT,                    -- git only; an archive uses strip_components
        auth_method  TEXT,                    -- none | ssh-key | https-token | github-token | bearer | basic | header
        auth_username TEXT,                   -- https-token | basic (not secret)
        auth_header_name TEXT,                -- header auth (not secret)
        checksum_url TEXT,                    -- http-zip only
        strip_components INTEGER,             -- http-zip only
        allow_insecure INTEGER NOT NULL DEFAULT 0, -- http-zip only: permit a plain http:// archive URL
        routing      TEXT,                    -- static (NULL) | spa | clean-urls (nginxpilot per-site routing)
        not_found    TEXT,                    -- site-relative custom 404 page (/404.html); static/clean-urls only
        cache_assets INTEGER NOT NULL DEFAULT 0, -- immutable Cache-Control for fingerprinted assets
        gzip         INTEGER NOT NULL DEFAULT 0, -- gzip responses (no TLS requirement)
        block_exploits INTEGER NOT NULL DEFAULT 0, -- nginxpilot's scanner/SQLi deny snippet
        tls          TEXT,                    -- off | auto | required — CUSTOM domains only; NULL = auto (subdomains inherit their base)
        hsts         INTEGER NOT NULL DEFAULT 0, -- Strict-Transport-Security; CUSTOM domains only, opt-in (subdomains inherit their base)
        advanced     TEXT,                    -- raw nginx server{} directives; plan-gated (PlanLimits.advancedConfig)
        exclude      TEXT,                    -- JSON string[] of extra deny globs; NULL = Quaykeeper's ['*.map'] default
        require_file TEXT,                    -- JSON string[] post-fetch gate; NULL = ['index.html'] default, [] = no gate
        keep_releases INTEGER,                -- rollback depth; NULL = the owner's plan value
        interval_sec INTEGER,                 -- poll cadence; NULL = the owner's plan floor (never faster than it)
        hostname     TEXT NOT NULL,           -- alice.quaykeeper.dev | www.example.com
        host_kind    TEXT NOT NULL,           -- subdomain | custom
        status       TEXT NOT NULL,           -- draft|provisioning|live|failed|suspended|over_quota
        bytes        INTEGER,                 -- last measured deployed size
        last_ref     TEXT,                    -- last live git ref (from /status)
        last_error   TEXT,
        repo_private INTEGER NOT NULL DEFAULT 0,  -- redeploys re-emit the fragment auth block without a GitHub round-trip
        realm_id     TEXT REFERENCES realm(id),
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
    );
    CREATE INDEX idx_site_owner ON site(owner_id);
    CREATE UNIQUE INDEX idx_site_realm_hostname ON site(realm_id, hostname);

    -- Per-site source credential: the deploy key / token / password / header value a
    -- non-GitHub source authenticates with. AES-256-GCM ciphertext via cipher.ts, never
    -- plaintext at rest and never returned to the client (the API is write-only; reads
    -- report presence only). A GitHub source needs no row — it reuses the owner's OAuth
    -- token from user_github_token. Deleted with the site.
    CREATE TABLE site_credential (
        site_id    TEXT PRIMARY KEY REFERENCES site(id) ON DELETE CASCADE,
        secret_enc TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    -- Pending fragment removals: a site fragment the daemon should no longer hold but
    -- whose DELETE couldn't be confirmed (forced site delete with the daemon down, a
    -- rehost retracting the old domain). Retried by the status poll's reconcile pass
    -- until the daemon confirms (404 = already gone = success), so an orphaned fragment
    -- never serves a dead site forever. No FK to site — the row typically outlives it.
    CREATE TABLE site_removal (
        realm_id   TEXT NOT NULL,
        domain     TEXT NOT NULL,
        reason     TEXT NOT NULL,        -- delete | rehost
        attempts   INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (realm_id, domain)
    );

    -- Global instance settings (owner-editable branding + custom-domain ingress).
    -- Generic key/value; empty on a fresh instance — a missing key falls through
    -- to its built-in default / env fallback (domain/settings.ts validates writes).
    CREATE TABLE app_setting (
        key        TEXT PRIMARY KEY,       -- app_name | tagline | theme | brand_color | ingress_ipv4 | ingress_ipv6
        value      TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    -- Audit log. meta is a nullable JSON snapshot of the written object (secrets
    -- stripped at the call site — cert keys and credential bodies never pass through).
    CREATE TABLE audit (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        at        TEXT NOT NULL,
        github_id INTEGER,
        login     TEXT,
        action    TEXT NOT NULL,
        site      TEXT,
        detail    TEXT,
        meta      TEXT
    );
    CREATE INDEX idx_audit_id ON audit(id DESC);

    -- Persisted per-resource state history (quaykeeper_better.md B1). One row per
    -- non-active EPISODE of a managed-mode resource (disabled / at_risk / a cert
    -- renew failure): opened when the status poller first sees the state, refreshed
    -- while it persists, closed (cleared_at) on recovery — survives daemon AND
    -- quaykeeper restarts. The actor_* columns denormalize "who last touched this
    -- resource" from the audit log at episode-open time, surviving audit pruning.
    CREATE TABLE resource_state (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        realm_id     TEXT NOT NULL,
        kind         TEXT NOT NULL,          -- site | proxy | redirect | dead_host | upstream | stream | stream-upstream | cert
        key          TEXT NOT NULL,          -- domain (sites/proxies/…) or name (pools/streams)
        state        TEXT NOT NULL,          -- disabled | at_risk | renew_failed
        reason       TEXT,                   -- daemon's nginx -t / renewal error (latest)
        since        TEXT,                   -- daemon-reported failing-since, when it has one
        first_seen   TEXT NOT NULL,          -- when the poller opened the episode
        last_seen    TEXT NOT NULL,          -- last poll that still saw the state
        cleared_at   TEXT,                   -- NULL = episode still open
        actor_login  TEXT,                   -- last audit actor for this key at open time
        actor_action TEXT,
        actor_at     TEXT
    );
    CREATE UNIQUE INDEX idx_resource_state_open ON resource_state(realm_id, kind, key) WHERE cleared_at IS NULL;
    CREATE INDEX idx_resource_state_history ON resource_state(realm_id, kind, key, id DESC);

    -- The Config subsystem (move_wharf_to_perch.md §3): two global pools (plain
    -- variables, encrypted secrets) plus a flat, tag/project-organized instance
    -- list — no projects/environments, no override cascade, no interpolation.
    -- Cascade rules: deleting an instance drops its tags/vars/flags; deleting a
    -- referenced global var/secret is blocked (ON DELETE RESTRICT) so a fetch
    -- never silently loses a value.
    CREATE TABLE global_var (
        id          TEXT PRIMARY KEY,
        key         TEXT NOT NULL UNIQUE,
        value       TEXT NOT NULL,             -- plaintext by design; secrets go in the secret table
        description TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    );

    CREATE TABLE secret (
        id          TEXT PRIMARY KEY,
        key         TEXT NOT NULL UNIQUE,
        value_enc   TEXT NOT NULL,             -- AES-256-GCM via infrastructure/cipher.ts
        description TEXT,
        created_by  INTEGER NOT NULL,          -- app_user.github_id
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    );

    CREATE TABLE instance (
        id             TEXT PRIMARY KEY,
        name           TEXT NOT NULL UNIQUE,
        description    TEXT,
        project        TEXT,                   -- plain grouping label; NULL = unassigned
        key_hash       TEXT,                   -- sha256 of fetch secret; NULL until minted
        key_set_at     TEXT,
        key_expires_at TEXT,
        last_fetch_at  TEXT,                   -- applied-as-of watermark (incl. 304s)
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
    );
    CREATE INDEX idx_instance_project ON instance(project);

    CREATE TABLE instance_tag (
        instance_id TEXT NOT NULL REFERENCES instance(id) ON DELETE CASCADE,
        tag         TEXT NOT NULL,
        PRIMARY KEY (instance_id, tag)
    );
    CREATE INDEX idx_instance_tag_tag ON instance_tag(tag);

    CREATE TABLE env_var (
        id            TEXT PRIMARY KEY,
        instance_id   TEXT NOT NULL REFERENCES instance(id) ON DELETE CASCADE,
        key           TEXT NOT NULL,
        source        TEXT NOT NULL,           -- 'literal' | 'global' | 'secret'
        value         TEXT,                    -- literal text (source='literal')
        global_var_id TEXT REFERENCES global_var(id) ON DELETE RESTRICT,
        secret_id     TEXT REFERENCES secret(id)     ON DELETE RESTRICT,
        description   TEXT,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        UNIQUE(instance_id, key),
        CHECK (
            (source = 'literal' AND value IS NOT NULL AND global_var_id IS NULL AND secret_id IS NULL) OR
            (source = 'global'  AND global_var_id IS NOT NULL AND value IS NULL AND secret_id IS NULL) OR
            (source = 'secret'  AND secret_id IS NOT NULL AND value IS NULL AND global_var_id IS NULL)
        )
    );
    CREATE INDEX idx_env_var_instance ON env_var(instance_id);
    CREATE INDEX idx_env_var_global   ON env_var(global_var_id);
    CREATE INDEX idx_env_var_secret   ON env_var(secret_id);

    CREATE TABLE feature_flag (
        id          TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL REFERENCES instance(id) ON DELETE CASCADE,
        key         TEXT NOT NULL,
        enabled     INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        UNIQUE(instance_id, key)
    );
    CREATE INDEX idx_feature_flag_instance ON feature_flag(instance_id);

    -- Database-server registry (quaykeeper_database_management.md §4). One row per
    -- owner-connected server; admin_password_enc is AES-256-GCM ciphertext.
    -- Databases/users/grants are NOT mirrored — the server's own catalogs are the
    -- source of truth (§3), so this is the only table the subsystem persists.
    CREATE TABLE db_server (
        id                  TEXT PRIMARY KEY,          -- dbsrv_<11 base36>
        name                TEXT NOT NULL UNIQUE,      -- human label ("prod-pg", "shared-mysql")
        kind                TEXT NOT NULL,             -- postgres | mysql
        host                TEXT NOT NULL,
        port                INTEGER NOT NULL,
        tls                 TEXT NOT NULL DEFAULT 'off', -- off | require
        admin_user          TEXT NOT NULL,
        admin_password_enc  TEXT NOT NULL,             -- AES-256-GCM via cipher.ts
        last_ok_at          TEXT,                      -- last successful probe/operation
        last_error          TEXT,                      -- last connection/DDL failure (message only)
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL
    );

    -- Saved docker-run snippets (the Snippets page). The form-built recipe is a
    -- JSON DockerRunSpec (domain/docker-run.ts owns shape + validation); instance_id
    -- is the optional Config instance whose resolved variables the generated command
    -- injects at container boot — ON DELETE SET NULL degrades the snippet to a
    -- plain docker run instead of deleting it.
    CREATE TABLE docker_snippet (
        id          TEXT PRIMARY KEY,          -- snip_<11 base36>
        name        TEXT NOT NULL UNIQUE,      -- human label ("redis-cache", "api worker")
        description TEXT,
        spec        TEXT NOT NULL,             -- JSON DockerRunSpec (domain/docker-run.ts)
        instance_id TEXT REFERENCES instance(id) ON DELETE SET NULL,
        created_by  INTEGER NOT NULL,          -- app_user.github_id
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    );
    CREATE INDEX idx_docker_snippet_instance ON docker_snippet(instance_id);

    -- Scheduled jobs: owner-defined shell / JavaScript scripts run on a 5-field
    -- cron schedule and/or on demand; job_run is the append-only execution history
    -- (ON DELETE CASCADE). Executor + ticker: services/jobs.ts / job-scheduler.ts;
    -- the script is stored opaquely (domain/job.ts validates before it lands).
    CREATE TABLE scheduled_job (
        id           TEXT PRIMARY KEY,          -- job_<11 base36>
        name         TEXT NOT NULL UNIQUE,      -- human label ("nightly backup")
        description  TEXT,
        kind         TEXT NOT NULL,             -- shell | node
        script       TEXT NOT NULL,             -- the source (opaque; domain/job.ts validates)
        schedule     TEXT,                      -- 5-field cron; NULL = manual-only (run-now only)
        enabled      INTEGER NOT NULL DEFAULT 1,
        timeout_sec  INTEGER NOT NULL,          -- hard wall-clock kill cap
        created_by   INTEGER NOT NULL,          -- app_user.github_id
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
    );

    CREATE TABLE job_run (
        id                 TEXT PRIMARY KEY,     -- run_<11 base36>
        job_id             TEXT NOT NULL REFERENCES scheduled_job(id) ON DELETE CASCADE,
        trigger            TEXT NOT NULL,        -- manual | schedule
        status             TEXT NOT NULL,        -- success | failed | timeout | error
        exit_code          INTEGER,              -- NULL when killed by signal / never spawned
        stdout             TEXT NOT NULL DEFAULT '',
        stderr             TEXT NOT NULL DEFAULT '',
        truncated          INTEGER NOT NULL DEFAULT 0,
        started_at         TEXT NOT NULL,
        finished_at        TEXT NOT NULL,
        duration_ms        INTEGER NOT NULL,
        triggered_by       INTEGER,              -- github_id (manual) / NULL (schedule)
        triggered_by_login TEXT
    );
    CREATE INDEX idx_job_run_job ON job_run(job_id);

    -- Log shipping (logs_feature.md): log_destination is the reusable owner-defined
    -- ENDPOINT (name/url/TLS/auth — SECRETS BY REFERENCE ONLY: spec.auth carries
    -- *_env/*_file names, never secret bytes, so nothing is encrypted); log_binding
    -- assigns a destination to a log source — an nginxpilot realm's access logs
    -- (scope 'realm', pushed as a daemon fragment) or a Config instance's app logs
    -- (scope 'instance', delivered via the agent snapshot) — and carries the
    -- per-source shaping JSON (labels/filter/parse/tunables, domain LogShaping).
    -- No SQL FK binding → destination: referential integrity is service-enforced
    -- (an in-use destination can't be deleted), matching the repo style.
    CREATE TABLE log_destination (
        id          TEXT PRIMARY KEY,          -- logdest_<11 base36>
        name        TEXT NOT NULL UNIQUE,      -- slug [a-z0-9-]+ — the fragment filename component
        type        TEXT NOT NULL,             -- loki | http (push endpoints only)
        spec        TEXT NOT NULL,             -- JSON DestinationEndpoint (refs only; domain/nginxpilot-logdest-fragment.ts)
        created_by  INTEGER NOT NULL,          -- app_user.github_id
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    );

    CREATE TABLE log_binding (
        id             TEXT PRIMARY KEY,           -- logbind_<11 base36>
        destination_id TEXT NOT NULL,              -- → log_destination.id (service-enforced)
        scope          TEXT NOT NULL,              -- realm | instance
        target         TEXT NOT NULL,              -- realm.id | instance.id
        enabled        INTEGER NOT NULL DEFAULT 1,
        shaping        TEXT NOT NULL DEFAULT '{}', -- JSON LogShaping (domain/nginxpilot-logdest-fragment.ts)
        created_by     INTEGER NOT NULL,           -- app_user.github_id
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
    );
    CREATE UNIQUE INDEX idx_log_binding_unique ON log_binding(scope, target, destination_id);
    CREATE INDEX idx_log_binding_target ON log_binding(scope, target);
    CREATE INDEX idx_log_binding_dest ON log_binding(destination_id);
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
    // rebuild, and the PRAGMA is a no-op *inside* a transaction — so toggle it here,
    // around the whole migration run, OUTSIDE any `BEGIN` (D2). No current migration
    // rebuilds a table, but doing it for the loop is simplest and harmless (a future
    // rebuild migration then just works), and it is restored to ON before the
    // connection serves traffic.
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
// `BEGIN` throws "cannot start a transaction within a transaction" — so a `tx()`
// composed inside another `tx()` (e.g. a service transaction calling a repo helper
// that opens its own) must JOIN the open transaction rather than start a new one.
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
        // has already resolved the transaction one way or another, and attempting
        // ROLLBACK on it throws ("no transaction is active"), which would replace
        // the original error instead of explaining it.
        if (!committed) {
            try {
                db.exec('ROLLBACK')
            } catch {
                // Ignore — the original `err` is what actually explains the failure.
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
