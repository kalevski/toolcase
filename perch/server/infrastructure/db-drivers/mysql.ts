// MySQL / MariaDB driver (perch_database_management.md §6). Same shape as the
// postgres driver: short-lived connections, autocommit DDL, statements emitted
// by domain/db-access.ts, identifiers pre-validated. Mysql grants are all
// db-qualified, so no per-database connections are ever needed. Accounts are
// `(user, host)` pairs — v1 creates `'name'@'%'` and resolves an existing
// account's host from `mysql.user` (preferring `'%'`) for grant/drop targets.

import 'server-only'
import mysql, { type Connection } from 'mysql2/promise'
import type { DbDatabase, DbGrant, DbUser } from '@/server/domain/types'
import { quoteAccount, quoteIdent, quoteLiteral } from '@/server/domain/db-identifiers'
import { classifyPrivileges, grantPlan } from '@/server/domain/db-access'
import {
    CONNECT_TIMEOUT_MS,
    STATEMENT_TIMEOUT_MS,
    DbDriverError,
    type DbConnInfo,
    type DbDriver,
} from '@/server/infrastructure/db-drivers/types'

/** System schemas hidden from listings and refused as targets (§10). */
const SYSTEM_DBS = new Set(['mysql', 'information_schema', 'performance_schema', 'sys'])

/** Engine-internal accounts hidden from listings (root stays visible — it is
 *  usually the registry's admin account and gets the locked badge instead). */
const SYSTEM_USERS = new Set(['mysql.sys', 'mysql.session', 'mysql.infoschema', 'mariadb.sys'])

/** "There is no such grant" — expected from the reset REVOKE when the user has
 *  no grant on the database yet (§6); ER_NONEXISTING_GRANT / _TABLE_GRANT. */
const NO_GRANT_ERRNOS = new Set([1141, 1147])

function toDriverError(err: unknown): DbDriverError {
    const e = err as { message?: string; errno?: number; code?: string }
    return new DbDriverError(e.message ?? 'mysql error', e.code ?? (e.errno ? String(e.errno) : undefined))
}

async function withConn<T>(conn: DbConnInfo, fn: (c: Connection) => Promise<T>): Promise<T> {
    let c: Connection
    try {
        c = await mysql.createConnection({
            host: conn.host,
            port: conn.port,
            user: conn.user,
            password: conn.password,
            connectTimeout: CONNECT_TIMEOUT_MS,
            // `{}` = TLS on, verified against the system CAs (§10).
            ssl: conn.tls === 'require' ? {} : undefined,
        })
    } catch (err) {
        throw toDriverError(err)
    }
    try {
        return await fn(c)
    } catch (err) {
        if (err instanceof DbDriverError) throw err
        throw toDriverError(err)
    } finally {
        await c.end().catch(() => {})
    }
}

async function q(c: Connection, sql: string, params?: unknown[]): Promise<any[]> {
    const [rows] = await c.query({ sql, values: params, timeout: STATEMENT_TIMEOUT_MS })
    return rows as any[]
}

/** Resolve each user name to its account host (v1 assumption: one account per
 *  name; `'%'` preferred when several exist). */
async function hostsFor(c: Connection, users: string[]): Promise<Map<string, string>> {
    if (users.length === 0) return new Map()
    const rows = await q(c, `SELECT user, host FROM mysql.user WHERE user IN (?)`, [users])
    const out = new Map<string, string>()
    for (const r of rows) {
        if (!out.has(r.user) || r.host === '%') out.set(r.user, r.host)
    }
    return out
}

/** Parse one `SHOW GRANTS` line → its privilege list and target (`*` = global,
 *  else the database name). Returns null for non-GRANT lines (PROXY etc.). */
export function parseGrantLine(line: string): { privs: string[]; target: string } | null {
    const m = /^GRANT (.+?) ON (\*|`(?:[^`]|``)+`|"[^"]+"|\S+)\.\* TO /i.exec(line)
    if (!m) return null
    const privs = m[1]
        .split(', ')
        .map((p) => p.trim().toUpperCase())
        // USAGE is mysql's explicit "no privileges" marker — strip it (§5).
        .filter((p) => p !== 'USAGE')
    let target = m[2]
    if (target.startsWith('`')) target = target.slice(1, -1).replace(/``/g, '`')
    else if (target.startsWith('"')) target = target.slice(1, -1) // ANSI_QUOTES servers
    return { privs, target: target === '*' ? '*' : target }
}

export const mysqlDriver: DbDriver = {
    async ping(conn) {
        await withConn(conn, (c) => q(c, 'SELECT 1'))
    },

    async listDatabases(conn) {
        return withConn(conn, async (c) => {
            const schemas = await q(c, 'SELECT schema_name AS name FROM information_schema.schemata ORDER BY schema_name')
            const sizes = await q(
                c,
                `SELECT table_schema AS name, SUM(data_length + index_length) AS size
                 FROM information_schema.tables GROUP BY table_schema`,
            )
            const sizeBy = new Map<string, number>(sizes.map((r) => [r.name, Number(r.size)]))
            return schemas
                .filter((r) => !SYSTEM_DBS.has(r.name))
                .map(
                    (r): DbDatabase => ({
                        name: r.name,
                        owner: null,
                        sizeBytes: sizeBy.get(r.name) ?? 0,
                    }),
                )
        })
    },

    async listUsers(conn) {
        return withConn(conn, async (c) => {
            const rows = await q(c, 'SELECT user, host, super_priv FROM mysql.user ORDER BY user, host')
            return rows
                .filter((r) => !SYSTEM_USERS.has(r.user))
                .map(
                    (r): DbUser => ({
                        name: r.user,
                        host: r.host,
                        superuser: r.super_priv === 'Y',
                        isAdminAccount: false,
                    }),
                )
        })
    },

    async listGrants(conn, databases, users) {
        if (databases.length === 0 || users.length === 0) return []
        return withConn(conn, async (c) => {
            const hosts = await hostsFor(c, users)
            const out: DbGrant[] = []
            for (const user of users) {
                const host = hosts.get(user)
                // Per-db privilege sets from SHOW GRANTS; global (`ON *.*`)
                // privileges apply everywhere, so they merge into every db.
                const perDb = new Map<string, Set<string>>()
                const global = new Set<string>()
                if (host !== undefined) {
                    const rows = await q(c, `SHOW GRANTS FOR ${quoteAccount(user, host)}`)
                    for (const row of rows) {
                        const line = String(Object.values(row)[0])
                        const parsed = parseGrantLine(line)
                        if (!parsed) continue
                        const bucket =
                            parsed.target === '*'
                                ? global
                                : (perDb.get(parsed.target) ??
                                  perDb.set(parsed.target, new Set()).get(parsed.target)!)
                        for (const p of parsed.privs) bucket.add(p)
                    }
                }
                for (const db of databases) {
                    const privs = new Set([...(perDb.get(db) ?? []), ...global])
                    out.push({
                        user,
                        database: db,
                        level: classifyPrivileges('mysql', {
                            connect: privs.size > 0,
                            privs: [...privs],
                        }),
                    })
                }
            }
            return out
        })
    },

    async createDatabase(conn, name) {
        await withConn(conn, (c) => q(c, `CREATE DATABASE ${quoteIdent('mysql', name)}`))
    },

    async dropDatabase(conn, name) {
        await withConn(conn, (c) => q(c, `DROP DATABASE ${quoteIdent('mysql', name)}`))
    },

    async createUser(conn, name, password) {
        // IDENTIFIED BY refuses bind parameters on several server versions — the
        // literal is escaped by quoteLiteral and pre-validated (§10).
        await withConn(conn, (c) =>
            q(c, `CREATE USER ${quoteAccount(name, '%')} IDENTIFIED BY ${quoteLiteral('mysql', password)}`),
        )
    },

    async dropUser(conn, name) {
        await withConn(conn, async (c) => {
            const hosts = await hostsFor(c, [name])
            const host = hosts.get(name)
            if (host === undefined) throw new DbDriverError(`user "${name}" not found`)
            await q(c, `DROP USER ${quoteAccount(name, host)}`)
        })
    },

    async setPassword(conn, name, password) {
        await withConn(conn, async (c) => {
            const hosts = await hostsFor(c, [name])
            const host = hosts.get(name)
            if (host === undefined) throw new DbDriverError(`user "${name}" not found`)
            await q(
                c,
                `ALTER USER ${quoteAccount(name, host)} IDENTIFIED BY ${quoteLiteral('mysql', password)}`,
            )
        })
    },

    async applyAccess(conn, user, database, level) {
        await withConn(conn, async (c) => {
            const hosts = await hostsFor(c, [user])
            const host = hosts.get(user) ?? '%'
            const plan = grantPlan('mysql', user, database, level, host)
            for (const sql of plan.admin) {
                try {
                    await q(c, sql)
                } catch (err) {
                    const errno = (err as { errno?: number }).errno
                    // The reset REVOKE on a user with no existing grant is expected.
                    if (sql.startsWith('REVOKE') && errno !== undefined && NO_GRANT_ERRNOS.has(errno)) continue
                    throw err
                }
            }
        })
    },
}
