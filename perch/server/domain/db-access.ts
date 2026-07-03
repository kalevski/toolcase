// Pure access-level model (perch_database_management.md §3, §5): the per-engine
// statement-list emitters that translate a simplified level (`none | read |
// readwrite | owner`) into concrete GRANT/REVOKE DDL, and the reverse classifier
// that folds a live privilege snapshot back into a level (or `custom`). String-in
// / string-out, no I/O — the exact SQL for every (engine × level) pair is
// unit-tested here without a live server; drivers only execute what this emits.

import type { DbAccessLevel, DbServerKind } from '@/server/domain/types'
import { quoteAccount, quoteIdent } from '@/server/domain/db-identifiers'

/**
 * The statements that apply one level for one user on one database. Two buckets
 * because postgres splits the surface: database-level grants run on the
 * maintenance connection (`admin`), schema/table grants must run connected to
 * the target database itself (`target`). Mysql grants are all db-qualified, so
 * its `target` list is always empty.
 *
 * Every plan is a full reset: the leading REVOKEs strip whatever was there, then
 * the level's grants are laid down — so applying a level is idempotent and
 * "re-apply" recovers drift (§3).
 */
export interface GrantPlan {
    /** Statements for the maintenance-database connection. */
    admin: string[]
    /** Statements for a connection to the target database (postgres only). */
    target: string[]
}

/**
 * Build the statement plan for setting `user`'s access on `database` to `level`.
 * Inputs MUST already be validated by `domain/db-identifiers.ts`; this function
 * only quotes and emits. `host` is the mysql account host ('%' in v1; ignored
 * for postgres).
 *
 * Deliberate deviation from the obvious `owner` mapping: no `ALTER DATABASE …
 * OWNER TO` — ownership is exclusive (one role), so granting a second user
 * `owner` would silently strip the first. `GRANT ALL` is equivalent for
 * management purposes and reversible; actual catalog ownership still classifies
 * as `owner` on read (§3).
 */
export function grantPlan(
    kind: DbServerKind,
    user: string,
    database: string,
    level: DbAccessLevel,
    host = '%',
): GrantPlan {
    return kind === 'postgres'
        ? postgresPlan(user, database, level)
        : mysqlPlan(user, database, level, host)
}

function postgresPlan(user: string, database: string, level: DbAccessLevel): GrantPlan {
    const u = quoteIdent('postgres', user)
    const d = quoteIdent('postgres', database)

    // Full reset first (idempotency): strip db-level, schema-level, table/sequence
    // and default privileges. `ALTER DEFAULT PRIVILEGES` here covers objects the
    // *admin role* creates later; objects other roles create need a re-apply —
    // the documented §3 caveat.
    const admin = [`REVOKE ALL ON DATABASE ${d} FROM ${u}`]
    const target = [
        `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${u}`,
        `REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${u}`,
        `REVOKE ALL ON SCHEMA public FROM ${u}`,
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ${u}`,
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${u}`,
    ]

    switch (level) {
        case 'none':
            break
        case 'read':
            admin.push(`GRANT CONNECT ON DATABASE ${d} TO ${u}`)
            target.push(
                `GRANT USAGE ON SCHEMA public TO ${u}`,
                `GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${u}`,
                `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${u}`,
            )
            break
        case 'readwrite':
            admin.push(`GRANT CONNECT, TEMPORARY ON DATABASE ${d} TO ${u}`)
            target.push(
                `GRANT USAGE ON SCHEMA public TO ${u}`,
                `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${u}`,
                `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${u}`,
                `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${u}`,
                `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${u}`,
            )
            break
        case 'owner':
            admin.push(`GRANT ALL PRIVILEGES ON DATABASE ${d} TO ${u}`)
            target.push(
                `GRANT ALL ON SCHEMA public TO ${u}`,
                `GRANT ALL ON ALL TABLES IN SCHEMA public TO ${u}`,
                `GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${u}`,
                `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${u}`,
                `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${u}`,
            )
            break
    }
    return { admin, target }
}

function mysqlPlan(user: string, database: string, level: DbAccessLevel, host: string): GrantPlan {
    const acct = quoteAccount(user, host)
    const d = quoteIdent('mysql', database)

    // The reset REVOKE errors with "there is no such grant" when the user has no
    // grant on the db yet — the driver tolerates exactly that error code (§6).
    const admin = [`REVOKE ALL PRIVILEGES ON ${d}.* FROM ${acct}`]

    switch (level) {
        case 'none':
            break
        case 'read':
            admin.push(`GRANT SELECT, SHOW VIEW ON ${d}.* TO ${acct}`)
            break
        case 'readwrite':
            admin.push(
                `GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE, SHOW VIEW, CREATE TEMPORARY TABLES ON ${d}.* TO ${acct}`,
            )
            break
        case 'owner':
            admin.push(`GRANT ALL PRIVILEGES ON ${d}.* TO ${acct}`)
            break
    }
    return { admin, target: [] }
}

// ── classification (live grants → level) ─────────────────────────────────────

/**
 * A driver-collected snapshot of one user's live privileges on one database,
 * normalized enough for pure classification.
 */
export interface DbPrivSnapshot {
    /** postgres: `has_database_privilege(user, db, 'CONNECT')`; mysql: any grant row exists. */
    connect: boolean
    /** Uppercase privilege names — postgres: the union of table grants in schema
     *  `public`; mysql: the db-level privilege list from `SHOW GRANTS` (with the
     *  no-op `USAGE` marker stripped by the driver). */
    privs: string[]
    /** postgres: privileges recorded in `pg_default_acl` for the user — stands in
     *  for `privs` when the database has no tables yet (a fresh `read` grant on an
     *  empty database would otherwise classify as no privileges at all). */
    defaultPrivs?: string[]
    /** postgres: the role owns the database (`pg_database.datdba`). */
    isOwner?: boolean
}

// Canonical per-level table/db privilege sets — mirror what `grantPlan` emits.
const PG_READ = new Set(['SELECT'])
const PG_READWRITE = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
/** Every table privilege `GRANT ALL` confers (postgres ≤16; 17 adds MAINTAIN —
 *  a superset still classifies as owner via `isSuperset`). */
const PG_ALL = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'])
const MY_READ = new Set(['SELECT', 'SHOW VIEW'])
const MY_READWRITE = new Set([
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'EXECUTE',
    'SHOW VIEW',
    'CREATE TEMPORARY TABLES',
])

function sameSet(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false
    for (const v of a) if (!b.has(v)) return false
    return true
}

function isSuperset(a: Set<string>, b: Set<string>): boolean {
    for (const v of b) if (!a.has(v)) return false
    return true
}

/**
 * Fold a live snapshot back into a level. Anything that matches no canonical set
 * is `custom` — perch reports it honestly and never rewrites it implicitly (§3).
 */
export function classifyPrivileges(
    kind: DbServerKind,
    snap: DbPrivSnapshot,
): DbAccessLevel | 'custom' {
    const effective = new Set(
        (snap.privs.length > 0 ? snap.privs : (snap.defaultPrivs ?? [])).map((p) =>
            p.toUpperCase(),
        ),
    )

    if (kind === 'postgres') {
        if (snap.isOwner) return 'owner'
        if (!snap.connect) return effective.size === 0 ? 'none' : 'custom'
        if (isSuperset(effective, PG_ALL)) return 'owner'
        if (sameSet(effective, PG_READ)) return 'read'
        if (sameSet(effective, PG_READWRITE)) return 'readwrite'
        return 'custom'
    }

    // mysql: a grant row's existence IS connectivity, so only the privilege set
    // matters. `SHOW GRANTS` says `ALL PRIVILEGES` literally when everything is granted.
    if (effective.has('ALL PRIVILEGES')) return 'owner'
    if (effective.size === 0) return 'none'
    if (sameSet(effective, MY_READ)) return 'read'
    if (sameSet(effective, MY_READWRITE)) return 'readwrite'
    return 'custom'
}
