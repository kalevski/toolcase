// Pure access model (quaykeeper_database_management.md §3, §5): engine-neutral
// operations (`select | insert | … | temp`), the per-engine statement-list
// emitters that translate an operation set — or a simplified level preset over
// one — into concrete GRANT/REVOKE DDL, and the reverse classifier that folds a
// live privilege snapshot back into `{ level, operations, extras }`. String-in /
// string-out, no I/O — the exact SQL for every (engine × grant) pair lives here;
// drivers only execute what this emits.

import type { DbAccessLevel, DbOperation, DbServerKind } from '@/server/domain/types'
import { DB_OPERATIONS } from '@/server/domain/types'
import { quoteAccount, quoteIdent } from '@/server/domain/db-identifiers'

// ── operation → privilege mappings ───────────────────────────────────────────

/** Postgres table privilege per operation (the ops that live on tables). */
const PG_TABLE_PRIV: Partial<Record<DbOperation, string>> = {
    select: 'SELECT',
    insert: 'INSERT',
    update: 'UPDATE',
    delete: 'DELETE',
    references: 'REFERENCES',
    trigger: 'TRIGGER',
}

/** Every table privilege postgres `GRANT ALL` confers (pg ≤16; 17 adds MAINTAIN —
 *  a superset still classifies as owner via `isSuperset`). */
const PG_ALL = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'])

/** Mysql db-level privileges per operation. No two operations share a privilege,
 *  so classification can consume them set-wise without order sensitivity. */
const MYSQL_OP_PRIVS: Record<DbOperation, string[]> = {
    select: ['SELECT', 'SHOW VIEW'],
    insert: ['INSERT'],
    update: ['UPDATE'],
    delete: ['DELETE'],
    references: ['REFERENCES'],
    trigger: ['TRIGGER'],
    execute: ['EXECUTE'],
    ddl: ['CREATE', 'ALTER', 'DROP', 'INDEX', 'CREATE VIEW', 'CREATE ROUTINE', 'ALTER ROUTINE', 'EVENT'],
    temp: ['CREATE TEMPORARY TABLES'],
}

// ── levels as presets over operations ────────────────────────────────────────

/**
 * The operation set a simplified level stands for. `readwrite` differs per
 * engine: postgres functions are PUBLIC-executable by default so `execute`
 * needs no grant there, mysql requires it explicitly. `owner` reports every
 * operation (its actual grant is engine `ALL`, a superset of the nine ops).
 */
export function levelOperations(kind: DbServerKind, level: DbAccessLevel): DbOperation[] {
    switch (level) {
        case 'none':
            return []
        case 'read':
            return ['select']
        case 'readwrite':
            return kind === 'mysql'
                ? ['select', 'insert', 'update', 'delete', 'execute', 'temp']
                : ['select', 'insert', 'update', 'delete', 'temp']
        case 'owner':
            return [...DB_OPERATIONS]
    }
}

function sameOps(a: readonly DbOperation[], b: readonly DbOperation[]): boolean {
    if (a.length !== b.length) return false
    const set = new Set(b)
    return a.every((op) => set.has(op))
}

/** The level an explicit operation set reads back as: a preset when it matches
 *  one exactly, `none` when empty, else `custom`. (All nine ops is still
 *  `custom` — real `owner` means engine `ALL`, which is strictly more.) */
export function levelForOperations(
    kind: DbServerKind,
    ops: readonly DbOperation[],
): DbAccessLevel | 'custom' {
    if (ops.length === 0) return 'none'
    for (const level of ['read', 'readwrite'] as const) {
        if (sameOps(ops, levelOperations(kind, level))) return level
    }
    return 'custom'
}

// ── emitters (operations / levels → statement plans) ─────────────────────────

/**
 * The statements that apply one grant for one user on one database. Two buckets
 * because postgres splits the surface: database-level grants run on the
 * maintenance connection (`admin`), schema/table grants must run connected to
 * the target database itself (`target`). Mysql grants are all db-qualified, so
 * its `target` list is always empty.
 *
 * Every plan is a full reset: the leading REVOKEs strip whatever was there, then
 * the grants are laid down — so applying is idempotent and "re-apply" recovers
 * drift (§3).
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
    if (level === 'owner') {
        return kind === 'postgres'
            ? postgresOwnerPlan(user, database)
            : mysqlOwnerPlan(user, database, host)
    }
    return operationGrantPlan(kind, user, database, levelOperations(kind, level), host)
}

/**
 * Build the statement plan for setting `user`'s access on `database` to exactly
 * `ops` (the detailed editor's path). Same full-reset semantics as `grantPlan`.
 */
export function operationGrantPlan(
    kind: DbServerKind,
    user: string,
    database: string,
    ops: readonly DbOperation[],
    host = '%',
): GrantPlan {
    const set = new Set(ops)
    return kind === 'postgres'
        ? postgresOpsPlan(user, database, set)
        : mysqlOpsPlan(user, database, set, host)
}

/**
 * The shared postgres reset: strip db-level, schema-level, table/sequence/
 * function and default privileges. `ALTER DEFAULT PRIVILEGES` here covers
 * objects the *admin role* creates later; objects other roles create need a
 * re-apply — the documented §3 caveat.
 */
function postgresReset(u: string, d: string): GrantPlan {
    return {
        admin: [`REVOKE ALL ON DATABASE ${d} FROM ${u}`],
        target: [
            `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${u}`,
            `REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${u}`,
            `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM ${u}`,
            `REVOKE ALL ON SCHEMA public FROM ${u}`,
            `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ${u}`,
            `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${u}`,
            `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM ${u}`,
        ],
    }
}

function postgresOpsPlan(user: string, database: string, ops: Set<DbOperation>): GrantPlan {
    const u = quoteIdent('postgres', user)
    const d = quoteIdent('postgres', database)
    const { admin, target } = postgresReset(u, d)
    if (ops.size === 0) return { admin, target }

    // Baseline for any non-empty set: the user must reach the database and see
    // the schema. Ordered by DB_OPERATIONS so emitted SQL is deterministic.
    const dbPrivs = ['CONNECT', ...(ops.has('temp') ? ['TEMPORARY'] : [])]
    const schemaPrivs = ['USAGE', ...(ops.has('ddl') ? ['CREATE'] : [])]
    const tablePrivs = DB_OPERATIONS.filter((op) => ops.has(op) && PG_TABLE_PRIV[op]).map(
        (op) => PG_TABLE_PRIV[op]!,
    )

    admin.push(`GRANT ${dbPrivs.join(', ')} ON DATABASE ${d} TO ${u}`)
    target.push(`GRANT ${schemaPrivs.join(', ')} ON SCHEMA public TO ${u}`)
    if (tablePrivs.length > 0) {
        const list = tablePrivs.join(', ')
        target.push(
            `GRANT ${list} ON ALL TABLES IN SCHEMA public TO ${u}`,
            `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ${list} ON TABLES TO ${u}`,
        )
    }
    // Serial/identity columns make inserts (and upserts) call nextval — sequence
    // access rides along with the row-writing operations.
    if (ops.has('insert') || ops.has('update')) {
        target.push(
            `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${u}`,
            `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${u}`,
        )
    }
    if (ops.has('execute')) {
        target.push(
            `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${u}`,
            `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO ${u}`,
        )
    }
    return { admin, target }
}

function postgresOwnerPlan(user: string, database: string): GrantPlan {
    const u = quoteIdent('postgres', user)
    const d = quoteIdent('postgres', database)
    const { admin, target } = postgresReset(u, d)
    admin.push(`GRANT ALL PRIVILEGES ON DATABASE ${d} TO ${u}`)
    target.push(
        `GRANT ALL ON SCHEMA public TO ${u}`,
        `GRANT ALL ON ALL TABLES IN SCHEMA public TO ${u}`,
        `GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${u}`,
        `GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO ${u}`,
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${u}`,
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${u}`,
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ${u}`,
    )
    return { admin, target }
}

function mysqlOpsPlan(user: string, database: string, ops: Set<DbOperation>, host: string): GrantPlan {
    const acct = quoteAccount(user, host)
    const d = quoteIdent('mysql', database)

    // The reset REVOKE errors with "there is no such grant" when the user has no
    // grant on the db yet — the driver tolerates exactly that error code (§6).
    const admin = [`REVOKE ALL PRIVILEGES ON ${d}.* FROM ${acct}`]
    const privs = DB_OPERATIONS.filter((op) => ops.has(op)).flatMap((op) => MYSQL_OP_PRIVS[op])
    if (privs.length > 0) admin.push(`GRANT ${privs.join(', ')} ON ${d}.* TO ${acct}`)
    return { admin, target: [] }
}

function mysqlOwnerPlan(user: string, database: string, host: string): GrantPlan {
    const acct = quoteAccount(user, host)
    const d = quoteIdent('mysql', database)
    return {
        admin: [
            `REVOKE ALL PRIVILEGES ON ${d}.* FROM ${acct}`,
            `GRANT ALL PRIVILEGES ON ${d}.* TO ${acct}`,
        ],
        target: [],
    }
}

// ── classification (live grants → level + operations) ────────────────────────

/**
 * A driver-collected snapshot of one user's live privileges on one database,
 * normalized enough for pure classification.
 */
export interface DbPrivSnapshot {
    /** postgres: explicit CONNECT in the database ACL; mysql: any grant row exists. */
    connect: boolean
    /** Uppercase privilege names — postgres: the union of table grants in schema
     *  `public`; mysql: the db-level privilege list from `SHOW GRANTS` (with the
     *  no-op `USAGE` marker stripped by the driver). */
    privs: string[]
    /** postgres: table privileges recorded in `pg_default_acl` for the user —
     *  stands in for `privs` when the database has no tables yet (a fresh `read`
     *  grant on an empty database would otherwise classify as no privileges). */
    defaultPrivs?: string[]
    /** postgres: the role owns the database (`pg_database.datdba`). */
    isOwner?: boolean
    /** postgres: database-ACL privileges beyond CONNECT (TEMPORARY, CREATE). */
    dbPrivs?: string[]
    /** postgres: schema `public` ACL privileges (USAGE, CREATE). */
    schemaPrivs?: string[]
    /** postgres: the role holds EXECUTE on functions in `public` — explicit
     *  `pg_proc` ACL entries or a default ACL for functions. */
    canExecute?: boolean
}

/** The classifier's verdict: a level, plus the operation detail behind it. */
export interface DbAccessClassification {
    level: DbAccessLevel | 'custom'
    /** Operations fully present in the live grant (canonical DB_OPERATIONS order). */
    operations: DbOperation[]
    /** Privileges that fold into no operation — the reason for `custom`. */
    extras: string[]
}

const upper = (values: string[] | undefined) => new Set((values ?? []).map((v) => v.toUpperCase()))

function isSuperset(a: Set<string>, b: Set<string>): boolean {
    for (const v of b) if (!a.has(v)) return false
    return true
}

/**
 * Fold a live snapshot back into `{ level, operations, extras }`. Anything that
 * matches no preset is `custom` — quaykeeper reports it honestly (operations it
 * can express, extras it cannot) and never rewrites it implicitly (§3).
 */
export function classifyAccess(kind: DbServerKind, snap: DbPrivSnapshot): DbAccessClassification {
    return kind === 'postgres' ? classifyPostgres(snap) : classifyMysql(snap)
}

function finish(kind: DbServerKind, connect: boolean, ops: Set<DbOperation>, extras: string[]): DbAccessClassification {
    const operations = DB_OPERATIONS.filter((op) => ops.has(op))
    if (!connect) {
        // Privileges without connectivity are inert but real — report custom, not none.
        return operations.length === 0 && extras.length === 0
            ? { level: 'none', operations: [], extras: [] }
            : { level: 'custom', operations, extras }
    }
    if (extras.length === 0) {
        const level = levelForOperations(kind, operations)
        if (level !== 'custom') return { level, operations, extras: [] }
    }
    return { level: 'custom', operations, extras }
}

function classifyPostgres(snap: DbPrivSnapshot): DbAccessClassification {
    // Empty database fallback: no live tables means no role_table_grants rows —
    // the default ACL is the only trace of what a grant meant.
    const table = upper(snap.privs.length > 0 ? snap.privs : snap.defaultPrivs)

    if (snap.isOwner || isSuperset(table, PG_ALL)) {
        return { level: 'owner', operations: [...DB_OPERATIONS], extras: [] }
    }

    const ops = new Set<DbOperation>()
    const extras: string[] = []
    for (const op of DB_OPERATIONS) {
        const priv = PG_TABLE_PRIV[op]
        if (priv && table.has(priv)) {
            ops.add(op)
            table.delete(priv)
        }
    }
    for (const leftover of table) extras.push(leftover) // TRUNCATE and friends

    const db = upper(snap.dbPrivs)
    if (db.delete('TEMPORARY')) ops.add('temp')
    db.delete('CONNECT') // connectivity is the `connect` flag, not an extra
    for (const leftover of db) extras.push(`${leftover} (database)`) // db-level CREATE = create schemas

    const schema = upper(snap.schemaPrivs)
    if (schema.delete('CREATE')) ops.add('ddl')
    schema.delete('USAGE') // baseline, carried by every non-empty grant

    if (snap.canExecute) ops.add('execute')

    // A bare CONNECT (no operations at all) matches no preset — name it for the UI.
    if (snap.connect && ops.size === 0 && extras.length === 0) {
        return { level: 'custom', operations: [], extras: ['CONNECT only'] }
    }
    return finish('postgres', snap.connect, ops, extras)
}

function classifyMysql(snap: DbPrivSnapshot): DbAccessClassification {
    // A grant row's existence IS connectivity, so only the privilege set matters.
    // `SHOW GRANTS` says `ALL PRIVILEGES` literally when everything is granted.
    const privs = upper(snap.privs)
    if (privs.has('ALL PRIVILEGES')) {
        return { level: 'owner', operations: [...DB_OPERATIONS], extras: [] }
    }
    if (privs.size === 0) return { level: 'none', operations: [], extras: [] }

    const ops = new Set<DbOperation>()
    for (const op of DB_OPERATIONS) {
        const needed = MYSQL_OP_PRIVS[op]
        // An operation counts only when ALL its privileges are present — a bare
        // SELECT without SHOW VIEW is a partial `select` and stays an extra.
        if (needed.every((p) => privs.has(p))) {
            ops.add(op)
            for (const p of needed) privs.delete(p)
        }
    }
    return finish('mysql', true, ops, [...privs]) // leftovers: LOCK TABLES, partials…
}
