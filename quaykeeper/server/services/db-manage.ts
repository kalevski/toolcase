// Database-management service (quaykeeper_database_management.md §7) — the maintainer
// façade every /api/db-servers/** route calls: resolve the registry row, decrypt
// the credential (via services/db-servers.ts), validate identifiers through the
// pure domain module, dispatch the driver, record probe state, audit. Also owns
// the guardrails (§10): the registry's own admin account is locked, system
// objects are refused by validation, and non-admin superusers are not droppable.

import 'server-only'
import { randomBytes } from 'node:crypto'
import * as dbServerRepo from '@/server/data/repositories/db-server-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import { driverFor, DbDriverError } from '@/server/infrastructure/db-drivers'
import {
    DbServerError,
    connInfoOf,
    storedServer,
    type DbActor,
} from '@/server/services/db-servers'
import {
    validateDatabaseName,
    validateUserName,
    validateDbPassword,
} from '@/server/domain/db-identifiers'
import { bytesNeeded, generateSecret } from '@/server/domain/secret-gen'
import { levelForOperations, levelOperations } from '@/server/domain/db-access'
import {
    DB_OPERATIONS,
    isDbAccessLevel,
    isDbOperation,
    type DbAccessLevel,
    type DbDatabase,
    type DbGrant,
    type DbOperation,
    type DbUser,
} from '@/server/domain/types'
import type { StoredDbServer } from '@/server/data/repositories/db-server-repo'

/** Generated user passwords: the secret-gen `password` charset at 24 chars. */
const GENERATED_PASSWORD_LENGTH = 24

function audit(actor: DbActor, action: string, server: StoredDbServer, detail: string, meta?: unknown): void {
    auditRepo.append({
        githubId: actor.githubId,
        login: actor.login,
        action,
        site: null,
        detail: `${server.name}/${detail}`,
        meta,
    })
}

/**
 * Run one driver operation with probe bookkeeping: success bumps the row's
 * `last_ok_at`, a driver failure lands in `last_error` (and rethrows for the
 * route's 502). Registry/validation refusals never touch probe state.
 */
async function withProbe<T>(server: StoredDbServer, op: () => Promise<T>): Promise<T> {
    try {
        const result = await op()
        dbServerRepo.recordProbe(server.id, true)
        return result
    } catch (err) {
        if (err instanceof DbDriverError) {
            dbServerRepo.recordProbe(server.id, false, err.message)
        }
        throw err
    }
}

function requireDbName(server: StoredDbServer, raw: unknown): string {
    const res = validateDatabaseName(server.kind, raw)
    if (!res.ok) throw new DbServerError(res.error, 'invalid_database_name', 400)
    return res.name
}

function requireUserName(server: StoredDbServer, raw: unknown): string {
    const res = validateUserName(server.kind, raw)
    if (!res.ok) throw new DbServerError(res.error, 'invalid_user_name', 400)
    return res.name
}

/** The registry's own admin account is managed on the admin page, never here (§10). */
function assertNotAdminAccount(server: StoredDbServer, user: string): void {
    if (user === server.adminUser.toLowerCase()) {
        throw new DbServerError(
            `"${user}" is the registry admin account — edit it on the DB Servers admin page`,
            'admin_account_locked',
            409,
        )
    }
}

// ── databases ────────────────────────────────────────────────────────────────

export async function listDatabases(serverId: string): Promise<DbDatabase[]> {
    const server = storedServer(serverId)
    return withProbe(server, () => driverFor(server.kind).listDatabases(connInfoOf(server)))
}

export async function createDatabase(actor: DbActor, serverId: string, rawName: unknown): Promise<DbDatabase> {
    const server = storedServer(serverId)
    const name = requireDbName(server, rawName)
    await withProbe(server, () => driverFor(server.kind).createDatabase(connInfoOf(server), name))
    audit(actor, 'db.database.create', server, name, { database: name })
    return { name, owner: server.kind === 'postgres' ? server.adminUser : null, sizeBytes: null }
}

export async function dropDatabase(actor: DbActor, serverId: string, rawName: unknown): Promise<void> {
    const server = storedServer(serverId)
    const name = requireDbName(server, rawName)
    await withProbe(server, () => driverFor(server.kind).dropDatabase(connInfoOf(server), name))
    audit(actor, 'db.database.drop', server, name, { database: name })
}

// ── users ────────────────────────────────────────────────────────────────────

export async function listUsers(serverId: string): Promise<DbUser[]> {
    const server = storedServer(serverId)
    const users = await withProbe(server, () => driverFor(server.kind).listUsers(connInfoOf(server)))
    // The driver leaves `isAdminAccount` false — only the service knows the registry row.
    return users.map((u) => ({ ...u, isAdminAccount: u.name === server.adminUser }))
}

export interface CreatedDbUser {
    name: string
    /** The plaintext password — returned exactly ONCE, never stored (§8). */
    password: string
    generated: boolean
}

export async function createUser(
    actor: DbActor,
    serverId: string,
    input: { name?: unknown; password?: unknown },
): Promise<CreatedDbUser> {
    const server = storedServer(serverId)
    const name = requireUserName(server, input.name)
    assertNotAdminAccount(server, name)

    let password: string
    let generated: boolean
    if (input.password === undefined || input.password === null || input.password === '') {
        const spec = { kind: 'password' as const, length: GENERATED_PASSWORD_LENGTH }
        password = generateSecret(randomBytes(bytesNeeded(spec)), spec)
        generated = true
    } else {
        const res = validateDbPassword(input.password)
        if (!res.ok) throw new DbServerError(res.error, 'invalid_password', 400)
        password = res.name
        generated = false
    }

    await withProbe(server, () => driverFor(server.kind).createUser(connInfoOf(server), name, password))
    audit(actor, 'db.user.create', server, name, { user: name, generated })
    return { name, password, generated }
}

export async function resetPassword(
    actor: DbActor,
    serverId: string,
    rawUser: unknown,
    rawPassword: unknown,
): Promise<CreatedDbUser> {
    const server = storedServer(serverId)
    const name = requireUserName(server, rawUser)
    assertNotAdminAccount(server, name)

    let password: string
    let generated: boolean
    if (rawPassword === undefined || rawPassword === null || rawPassword === '') {
        const spec = { kind: 'password' as const, length: GENERATED_PASSWORD_LENGTH }
        password = generateSecret(randomBytes(bytesNeeded(spec)), spec)
        generated = true
    } else {
        const res = validateDbPassword(rawPassword)
        if (!res.ok) throw new DbServerError(res.error, 'invalid_password', 400)
        password = res.name
        generated = false
    }

    await withProbe(server, () => driverFor(server.kind).setPassword(connInfoOf(server), name, password))
    audit(actor, 'db.user.password_reset', server, name, { user: name, generated })
    return { name, password, generated }
}

export async function dropUser(actor: DbActor, serverId: string, rawUser: unknown): Promise<void> {
    const server = storedServer(serverId)
    const name = requireUserName(server, rawUser)
    assertNotAdminAccount(server, name)

    // Non-admin superusers are visible but not droppable in v1 (§10) — a live
    // check, since superuser-ness only exists on the target server.
    const users = await withProbe(server, () => driverFor(server.kind).listUsers(connInfoOf(server)))
    const target = users.find((u) => u.name === name)
    if (!target) throw new DbServerError(`user "${name}" not found`, 'db_user_not_found', 404)
    if (target.superuser) {
        throw new DbServerError(`"${name}" is a superuser — not droppable from quaykeeper`, 'superuser_locked', 409)
    }

    await withProbe(server, () => driverFor(server.kind).dropUser(connInfoOf(server), name))
    audit(actor, 'db.user.drop', server, name, { user: name })
}

// ── access matrix ────────────────────────────────────────────────────────────

export interface DbGrantMatrix {
    /** Manageable databases (system ones already filtered by the driver). */
    databases: string[]
    /** Matrix users: login-capable, minus the admin account and superusers —
     *  their access is implicit/locked, a level cell would be a lie (§10). */
    users: string[]
    grants: DbGrant[]
}

export async function grantMatrix(serverId: string): Promise<DbGrantMatrix> {
    const server = storedServer(serverId)
    const conn = connInfoOf(server)
    const driver = driverFor(server.kind)
    return withProbe(server, async () => {
        const [databases, allUsers] = await Promise.all([
            driver.listDatabases(conn),
            driver.listUsers(conn),
        ])
        const dbNames = databases.map((d) => d.name)
        const users = allUsers
            .filter((u) => !u.superuser && u.name !== server.adminUser)
            .map((u) => u.name)
        const grants = await driver.listGrants(conn, dbNames, users)
        return { databases: dbNames, users, grants }
    })
}

export async function setAccess(
    actor: DbActor,
    serverId: string,
    input: { user?: unknown; database?: unknown; level?: unknown; operations?: unknown },
): Promise<DbGrant> {
    const server = storedServer(serverId)
    const user = requireUserName(server, input.user)
    const database = requireDbName(server, input.database)
    assertNotAdminAccount(server, user)

    // Two shapes: a preset level, or an explicit operation set (the detailed
    // editor) — exactly one of them.
    const hasLevel = input.level !== undefined && input.level !== null
    const hasOps = input.operations !== undefined && input.operations !== null
    if (hasLevel === hasOps) {
        throw new DbServerError('provide exactly one of "level" or "operations"', 'invalid_level', 400)
    }
    let level: DbAccessLevel | undefined
    let operations: DbOperation[] | undefined
    if (hasLevel) {
        if (!isDbAccessLevel(input.level)) {
            throw new DbServerError('"level" must be none | read | readwrite | owner', 'invalid_level', 400)
        }
        level = input.level
    } else {
        if (!Array.isArray(input.operations) || !input.operations.every(isDbOperation)) {
            throw new DbServerError(
                `"operations" must be an array of: ${DB_OPERATIONS.join(' | ')}`,
                'invalid_operations',
                400,
            )
        }
        const requested = new Set(input.operations as DbOperation[])
        operations = DB_OPERATIONS.filter((op) => requested.has(op)) // dedupe, canonical order
    }

    // Attribute the previous state in the audit trail (§11) — best-effort: a
    // classification failure must not block the change itself.
    let previous: DbGrant | undefined
    try {
        const before = await driverFor(server.kind).listGrants(connInfoOf(server), [database], [user])
        previous = before[0]
    } catch {
        previous = undefined
    }

    const driver = driverFor(server.kind)
    if (operations !== undefined) {
        const ops = operations
        await withProbe(server, () => driver.applyOperations(connInfoOf(server), user, database, ops))
    } else {
        await withProbe(server, () => driver.applyAccess(connInfoOf(server), user, database, level!))
    }

    const applied =
        operations !== undefined ? (operations.join('+') || 'none') : level!
    audit(actor, 'db.grant.set', server, `${user} @ ${database} → ${applied}`, {
        user,
        database,
        level: level ?? null,
        operations: operations ?? null,
        previous: previous ? { level: previous.level, operations: previous.operations } : undefined,
    })
    return operations !== undefined
        ? {
              user,
              database,
              level: levelForOperations(server.kind, operations),
              operations,
              extras: [],
          }
        : { user, database, level: level!, operations: levelOperations(server.kind, level!), extras: [] }
}
