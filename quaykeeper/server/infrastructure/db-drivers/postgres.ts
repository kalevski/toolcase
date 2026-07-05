// PostgreSQL driver (perch_database_management.md §6). Short-lived connections —
// connect → run → end per operation; management traffic is rare, so there is no
// pool and nothing to leak. All DDL runs autocommit (CREATE DATABASE refuses to
// run inside a transaction). Identifiers reaching this module are pre-validated;
// quoting still goes through domain/db-identifiers.ts as defense in depth.

import 'server-only'
import { Client } from 'pg'
import type { DbAccessLevel, DbDatabase, DbGrant, DbOperation, DbUser } from '@/server/domain/types'
import { quoteIdent, quoteLiteral } from '@/server/domain/db-identifiers'
import {
    classifyAccess,
    grantPlan,
    operationGrantPlan,
    type DbPrivSnapshot,
    type GrantPlan,
} from '@/server/domain/db-access'
import {
    CONNECT_TIMEOUT_MS,
    STATEMENT_TIMEOUT_MS,
    DbDriverError,
    type DbConnInfo,
    type DbDriver,
} from '@/server/infrastructure/db-drivers/types'

/** The database perch's own connections land on for server-level work. */
const MAINTENANCE_DB = 'postgres'

/** System databases hidden from listings and refused as targets (§10). */
const SYSTEM_DBS = new Set(['postgres', 'template0', 'template1'])

/** Composite map key for user × database facts. NUL can appear in neither name. */
const KEY_SEP = String.fromCharCode(0)
const userDbKey = (user: string, db: string) => user + KEY_SEP + db

function toDriverError(err: unknown): DbDriverError {
    const e = err as { message?: string; code?: string }
    return new DbDriverError(e.message ?? 'postgres error', e.code)
}

async function withClient<T>(
    conn: DbConnInfo,
    database: string,
    fn: (client: Client) => Promise<T>,
): Promise<T> {
    const client = new Client({
        host: conn.host,
        port: conn.port,
        user: conn.user,
        password: conn.password,
        database,
        connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
        query_timeout: STATEMENT_TIMEOUT_MS,
        ssl: conn.tls === 'require' ? { rejectUnauthorized: true } : false,
    })
    try {
        await client.connect()
    } catch (err) {
        throw toDriverError(err)
    }
    try {
        return await fn(client)
    } catch (err) {
        if (err instanceof DbDriverError) throw err
        throw toDriverError(err)
    } finally {
        await client.end().catch(() => {})
    }
}

/** Execute a full-reset grant plan: admin statements on the maintenance db,
 *  target statements connected to the database itself. */
async function runPlan(conn: DbConnInfo, database: string, plan: GrantPlan): Promise<void> {
    await withClient(conn, MAINTENANCE_DB, async (c) => {
        for (const sql of plan.admin) await c.query(sql)
    })
    if (plan.target.length > 0) {
        await withClient(conn, database, async (c) => {
            for (const sql of plan.target) await c.query(sql)
        })
    }
}

export const postgresDriver: DbDriver = {
    async ping(conn) {
        await withClient(conn, MAINTENANCE_DB, (c) => c.query('SELECT 1'))
    },

    async listDatabases(conn) {
        return withClient(conn, MAINTENANCE_DB, async (c) => {
            // `datallowconn` filter: a database that refuses connections (RDS
            // maintenance dbs and the like) is unmanageable AND would break the
            // grants matrix, which must connect INTO each listed database.
            const res = await c.query(
                `SELECT d.datname AS name,
                        pg_get_userbyid(d.datdba) AS owner,
                        CASE WHEN has_database_privilege(current_user, d.oid, 'CONNECT')
                             THEN pg_database_size(d.datname) ELSE NULL END AS size
                 FROM pg_database d
                 WHERE NOT d.datistemplate AND d.datallowconn
                 ORDER BY d.datname`,
            )
            return res.rows
                .filter((r) => !SYSTEM_DBS.has(r.name))
                .map(
                    (r): DbDatabase => ({
                        name: r.name,
                        owner: r.owner ?? null,
                        sizeBytes: r.size === null ? null : Number(r.size),
                    }),
                )
        })
    },

    async listUsers(conn) {
        return withClient(conn, MAINTENANCE_DB, async (c) => {
            const res = await c.query(
                `SELECT rolname AS name, rolsuper AS superuser
                 FROM pg_roles
                 WHERE rolcanlogin AND rolname NOT LIKE 'pg\\_%'
                 ORDER BY rolname`,
            )
            return res.rows.map(
                (r): DbUser => ({
                    name: r.name,
                    host: null,
                    superuser: r.superuser === true,
                    isAdminAccount: false,
                }),
            )
        })
    },

    async listGrants(conn, databases, users) {
        if (databases.length === 0 || users.length === 0) return []
        const out: DbGrant[] = []

        // Server-level facts once per matrix: the database ACL per user×db and db
        // ownership. The ACL is read via aclexplode, NOT has_database_privilege —
        // PUBLIC holds implicit CONNECT on every database, which would make a fully
        // revoked user still look connectable and misclassify `none` as `custom`.
        // CONNECT feeds the connectivity flag; the rest (TEMPORARY, CREATE) feeds
        // the operation classifier.
        // Only grants to actual roles count (PUBLIC's grantee oid 0 has no pg_roles row).
        // A fresh database has a NULL datacl (default ACL, nothing explicitly granted)
        // and empty Postgres arrays are ZERO-dimensional — feeding either through
        // aclexplode raises `ACL arrays must be one-dimensional` (22023). The
        // cardinality qual references only `d`, so it filters at the pg_database scan,
        // before the lateral function ever runs.
        const { connect, dbAcl, owners } = await withClient(conn, MAINTENANCE_DB, async (c) => {
            const aclRes = await c.query(
                `SELECT r.rolname AS name, d.datname AS db, a.privilege_type AS priv
                 FROM pg_database d
                 CROSS JOIN LATERAL aclexplode(d.datacl) a
                 JOIN pg_roles r ON r.oid = a.grantee
                 WHERE d.datname = ANY($2) AND cardinality(d.datacl) > 0
                   AND r.rolname = ANY($1)`,
                [users, databases],
            )
            const ownerRes = await c.query(
                `SELECT datname AS db, pg_get_userbyid(datdba) AS owner
                 FROM pg_database WHERE datname = ANY($1)`,
                [databases],
            )
            const connect = new Set<string>()
            const dbAcl = new Map<string, Set<string>>()
            for (const r of aclRes.rows) {
                const key = userDbKey(r.name, r.db)
                if (r.priv === 'CONNECT') {
                    connect.add(key)
                } else {
                    if (!dbAcl.has(key)) dbAcl.set(key, new Set())
                    dbAcl.get(key)!.add(r.priv)
                }
            }
            return {
                connect,
                dbAcl,
                owners: new Map<string, string>(ownerRes.rows.map((r) => [r.db, r.owner])),
            }
        })

        // Schema/table/function facts need a connection INTO each database (§6).
        for (const db of databases) {
            const { privs, defaults, schemaAcl, executors } = await withClient(conn, db, async (c) => {
                const privRes = await c.query(
                    `SELECT grantee, privilege_type
                     FROM information_schema.role_table_grants
                     WHERE table_schema = 'public' AND grantee = ANY($1)`,
                    [users],
                )
                // Same 22023 guard as the datacl query above: a REVOKE-emptied
                // default ACL is a zero-dimensional array aclexplode refuses.
                // Object type 'r' = tables (the empty-database stand-in for table
                // privs), 'f' = functions (the stand-in for EXECUTE).
                const defRes = await c.query(
                    `SELECT r.rolname AS grantee, a.privilege_type, d.defaclobjtype AS objtype
                     FROM pg_default_acl d
                     CROSS JOIN LATERAL aclexplode(d.defaclacl) a
                     JOIN pg_roles r ON r.oid = a.grantee
                     WHERE d.defaclobjtype IN ('r', 'f') AND cardinality(d.defaclacl) > 0
                       AND r.rolname = ANY($1)`,
                    [users],
                )
                // Schema `public` ACL: USAGE is the baseline every grant carries,
                // CREATE is the `ddl` operation.
                const schemaRes = await c.query(
                    `SELECT r.rolname AS grantee, a.privilege_type AS priv
                     FROM pg_namespace n
                     CROSS JOIN LATERAL aclexplode(n.nspacl) a
                     JOIN pg_roles r ON r.oid = a.grantee
                     WHERE n.nspname = 'public' AND cardinality(n.nspacl) > 0
                       AND r.rolname = ANY($1)`,
                    [users],
                )
                // Explicit EXECUTE on live functions in `public`. A NULL proacl is
                // the engine default (PUBLIC may execute) — not an explicit grant,
                // and aclexplode never sees it thanks to the cardinality qual.
                const execRes = await c.query(
                    `SELECT DISTINCT r.rolname AS grantee
                     FROM pg_proc p
                     JOIN pg_namespace n ON n.oid = p.pronamespace
                     CROSS JOIN LATERAL aclexplode(p.proacl) a
                     JOIN pg_roles r ON r.oid = a.grantee
                     WHERE n.nspname = 'public' AND cardinality(p.proacl) > 0
                       AND r.rolname = ANY($1) AND a.privilege_type = 'EXECUTE'`,
                    [users],
                )
                const privs = new Map<string, Set<string>>()
                for (const r of privRes.rows) {
                    if (!privs.has(r.grantee)) privs.set(r.grantee, new Set())
                    privs.get(r.grantee)!.add(r.privilege_type)
                }
                const defaults = new Map<string, Set<string>>()
                const executors = new Set<string>(execRes.rows.map((r) => r.grantee))
                for (const r of defRes.rows) {
                    if (r.objtype === 'f') {
                        if (r.privilege_type === 'EXECUTE') executors.add(r.grantee)
                        continue
                    }
                    if (!defaults.has(r.grantee)) defaults.set(r.grantee, new Set())
                    defaults.get(r.grantee)!.add(r.privilege_type)
                }
                const schemaAcl = new Map<string, Set<string>>()
                for (const r of schemaRes.rows) {
                    if (!schemaAcl.has(r.grantee)) schemaAcl.set(r.grantee, new Set())
                    schemaAcl.get(r.grantee)!.add(r.priv)
                }
                return { privs, defaults, schemaAcl, executors }
            })

            for (const user of users) {
                const snap: DbPrivSnapshot = {
                    connect: connect.has(userDbKey(user, db)),
                    privs: [...(privs.get(user) ?? [])],
                    defaultPrivs: [...(defaults.get(user) ?? [])],
                    isOwner: owners.get(db) === user,
                    dbPrivs: [...(dbAcl.get(userDbKey(user, db)) ?? [])],
                    schemaPrivs: [...(schemaAcl.get(user) ?? [])],
                    canExecute: executors.has(user),
                }
                out.push({ user, database: db, ...classifyAccess('postgres', snap) })
            }
        }
        return out
    },

    async createDatabase(conn, name) {
        await withClient(conn, MAINTENANCE_DB, (c) =>
            c.query(`CREATE DATABASE ${quoteIdent('postgres', name)}`),
        )
    },

    async dropDatabase(conn, name) {
        // WITH (FORCE) (pg 13+) terminates lingering sessions atomically — a
        // plain DROP fails on any idle connection into the target.
        await withClient(conn, MAINTENANCE_DB, (c) =>
            c.query(`DROP DATABASE ${quoteIdent('postgres', name)} WITH (FORCE)`),
        )
    },

    async createUser(conn, name, password) {
        // Passwords cannot be bind-parameterized in role DDL — the literal is
        // escaped by quoteLiteral and the value shape is pre-validated (§10).
        await withClient(conn, MAINTENANCE_DB, (c) =>
            c.query(
                `CREATE ROLE ${quoteIdent('postgres', name)} WITH LOGIN PASSWORD ${quoteLiteral('postgres', password)}`,
            ),
        )
    },

    async dropUser(conn, name) {
        // A role with remaining objects/grants refuses to drop, so sweep every
        // database first: reassign what it owns to the admin, then drop its
        // remaining privileges. Rare operation; the per-db connections are fine.
        const dbs = await this.listDatabases(conn)
        const u = quoteIdent('postgres', name)
        for (const db of dbs) {
            await withClient(conn, db.name, async (c) => {
                await c.query(`REASSIGN OWNED BY ${u} TO CURRENT_USER`)
                await c.query(`DROP OWNED BY ${u}`)
            })
        }
        await withClient(conn, MAINTENANCE_DB, async (c) => {
            // DROP OWNED in the maintenance db also clears db-level grants there.
            await c.query(`DROP OWNED BY ${u}`)
            await c.query(`DROP ROLE ${u}`)
        })
    },

    async setPassword(conn, name, password) {
        await withClient(conn, MAINTENANCE_DB, (c) =>
            c.query(
                `ALTER ROLE ${quoteIdent('postgres', name)} WITH PASSWORD ${quoteLiteral('postgres', password)}`,
            ),
        )
    },

    async applyAccess(conn, user, database, level: DbAccessLevel) {
        await runPlan(conn, database, grantPlan('postgres', user, database, level))
    },

    async applyOperations(conn, user, database, operations: readonly DbOperation[]) {
        await runPlan(conn, database, operationGrantPlan('postgres', user, database, operations))
    },
}
