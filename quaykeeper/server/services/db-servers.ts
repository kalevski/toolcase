// Database-server registry service (quaykeeper_database_management.md §7) — the
// owner-only surface: CRUD over `db_server` plus the live test-connection probe.
// Owns credential encryption (cipher.ts — the plaintext admin password exists
// only transiently in here and in the drivers) and DTO masking. The maintainer
// management surface lives in `services/db-manage.ts`, which resolves decrypted
// connections through this module.

import 'server-only'
import * as dbServerRepo from '@/server/data/repositories/db-server-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import { encrypt, decrypt } from '@/server/infrastructure/cipher'
import { ID } from '@/server/infrastructure/ids'
import { driverFor, DbDriverError, type DbConnInfo } from '@/server/infrastructure/db-drivers'
import { slog } from '@/server/infrastructure/server-log'
import {
    isDbServerKind,
    isDbServerTls,
    DB_SERVER_DEFAULT_PORT,
    type DbServer,
} from '@/server/domain/types'
import type { StoredDbServer } from '@/server/data/repositories/db-server-repo'

/** A registry refusal, mirroring `RealmError`: bad input (400), unknown id
 *  (404), name conflict (409), or an unreachable/refusing server (502). */
export class DbServerError extends Error {
    constructor(
        message: string,
        public code: string,
        public status: 400 | 404 | 409 | 502,
    ) {
        super(message)
        this.name = 'DbServerError'
    }
}

/** The acting user, attributed on every audit entry. */
export interface DbActor {
    githubId: number
    login: string
}

function audit(actor: DbActor, action: string, detail: string, meta?: unknown): void {
    auditRepo.append({
        githubId: actor.githubId,
        login: actor.login,
        action,
        site: null,
        detail,
        meta,
    })
}

/** Mask a stored row to the client DTO — the credential never leaves the server (§10). */
function toDto(r: StoredDbServer): DbServer {
    const { adminPasswordEnc: _enc, ...dto } = r
    return dto
}

// ── resolution (shared with services/db-manage.ts) ───────────────────────────

/** The stored row, or a 404 `DbServerError`. */
export function storedServer(id: string): StoredDbServer {
    const r = dbServerRepo.byId(id)
    if (!r) throw new DbServerError(`database server "${id}" not found`, 'db_server_not_found', 404)
    return r
}

/** The decrypted, server-only connection for a registry row. */
export function connInfoOf(r: StoredDbServer): DbConnInfo {
    return {
        kind: r.kind,
        host: r.host,
        port: r.port,
        tls: r.tls,
        user: r.adminUser,
        password: decrypt(r.adminPasswordEnc),
    }
}

// ── reads ────────────────────────────────────────────────────────────────────

/** Every registered server, masked. Served to owner (admin page) AND
 *  maintainers (management pages) — the DTO carries nothing sensitive. */
export function listServers(): DbServer[] {
    return dbServerRepo.list().map(toDto)
}

export function getServer(id: string): DbServer {
    return toDto(storedServer(id))
}

// ── input validation ─────────────────────────────────────────────────────────

const NAME_MAX = 64
/** Hostname or IP literal — no scheme, no path, no whitespace. DB servers are
 *  routinely on private networks, so unlike realm URLs there is no private-range
 *  block: registration is operator-only and audited (§10). Link-local literals
 *  (cloud metadata endpoints) are still refused below — never a real DB host. */
const HOST_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9.:_-]*[A-Za-z0-9])?$/

/** True for a link-local IP literal (169.254.0.0/16 / fe80::/10) — the cloud
 *  metadata range; registering one is only ever an SSRF probe, never a DB. */
function isLinkLocalLiteral(host: string): boolean {
    if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(host)) return true
    return /^fe[89ab][0-9a-f]:/i.test(host)
}

function validateName(raw: unknown): string {
    const name = typeof raw === 'string' ? raw.trim() : ''
    if (!name) throw new DbServerError('"name" is required', 'invalid_request', 400)
    if (name.length > NAME_MAX) {
        throw new DbServerError(`"name" exceeds ${NAME_MAX} characters`, 'invalid_request', 400)
    }
    return name
}

function validateHost(raw: unknown): string {
    const host = typeof raw === 'string' ? raw.trim() : ''
    if (!host || host.length > 253 || !HOST_PATTERN.test(host)) {
        throw new DbServerError('"host" must be a hostname or IP address', 'invalid_host', 400)
    }
    if (isLinkLocalLiteral(host)) {
        throw new DbServerError('"host" must not be a link-local address', 'invalid_host', 400)
    }
    return host
}

function validatePort(raw: unknown, fallback: number): number {
    if (raw === undefined || raw === null || raw === '') return fallback
    const port = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new DbServerError('"port" must be 1–65535', 'invalid_port', 400)
    }
    return port
}

function validateAdminUser(raw: unknown): string {
    const user = typeof raw === 'string' ? raw.trim() : ''
    if (!user || user.length > 128) {
        throw new DbServerError('"adminUser" is required', 'invalid_request', 400)
    }
    return user
}

function validateAdminPassword(raw: unknown): string {
    // The admin credential is operator data for an existing account — shape is
    // the engine's business; quaykeeper only refuses empties.
    if (typeof raw !== 'string' || raw === '') {
        throw new DbServerError('"adminPassword" is required', 'invalid_request', 400)
    }
    return raw
}

// ── owner CRUD ───────────────────────────────────────────────────────────────

/** Register a server (`POST /api/admin/db-servers`). The password is encrypted
 *  before it touches the row; the audit meta never contains it (§11). */
export function createServer(
    actor: DbActor,
    input: {
        name?: unknown
        kind?: unknown
        host?: unknown
        port?: unknown
        tls?: unknown
        adminUser?: unknown
        adminPassword?: unknown
    },
): DbServer {
    const name = validateName(input.name)
    if (!isDbServerKind(input.kind)) {
        throw new DbServerError('"kind" must be postgres | mysql', 'invalid_kind', 400)
    }
    const kind = input.kind
    const host = validateHost(input.host)
    const port = validatePort(input.port, DB_SERVER_DEFAULT_PORT[kind])
    const tls = isDbServerTls(input.tls) ? input.tls : 'off'
    const adminUser = validateAdminUser(input.adminUser)
    const adminPassword = validateAdminPassword(input.adminPassword)

    if (dbServerRepo.byName(name)) {
        throw new DbServerError(`a server named "${name}" already exists`, 'name_taken', 409)
    }

    const now = new Date().toISOString()
    const row: StoredDbServer = {
        id: ID.dbServer(),
        name,
        kind,
        host,
        port,
        tls,
        adminUser,
        adminPasswordEnc: encrypt(adminPassword),
        createdAt: now,
        updatedAt: now,
    }
    dbServerRepo.insert(row)
    audit(actor, 'db_server.create', `${name} (${kind}) → ${host}:${port}`, {
        name,
        kind,
        host,
        port,
        tls,
        adminUser,
    })
    slog('info', 'db-servers', 'server registered', { id: row.id, name, kind, host, by: actor.login })
    return toDto(row)
}

/** Edit a server (`PATCH …/{id}`) — any subset of the mutable fields; an absent
 *  `adminPassword` keeps the stored credential. `kind` is immutable. */
export function updateServer(
    actor: DbActor,
    id: string,
    input: {
        name?: unknown
        host?: unknown
        port?: unknown
        tls?: unknown
        adminUser?: unknown
        adminPassword?: unknown
    },
): DbServer {
    const r = storedServer(id)
    const fields: Parameters<typeof dbServerRepo.update>[1] = {
        updatedAt: new Date().toISOString(),
    }
    if (input.name !== undefined) {
        const name = validateName(input.name)
        const clash = dbServerRepo.byName(name)
        if (clash && clash.id !== id) {
            throw new DbServerError(`a server named "${name}" already exists`, 'name_taken', 409)
        }
        fields.name = name
    }
    if (input.host !== undefined) fields.host = validateHost(input.host)
    if (input.port !== undefined) fields.port = validatePort(input.port, r.port)
    if (input.tls !== undefined) {
        if (!isDbServerTls(input.tls)) {
            throw new DbServerError('"tls" must be off | require', 'invalid_request', 400)
        }
        fields.tls = input.tls
    }
    if (input.adminUser !== undefined) fields.adminUser = validateAdminUser(input.adminUser)
    if (input.adminPassword !== undefined && input.adminPassword !== '') {
        fields.adminPasswordEnc = encrypt(validateAdminPassword(input.adminPassword))
    }

    dbServerRepo.update(id, fields)
    const { adminPasswordEnc: _enc, updatedAt: _at, ...metaFields } = fields as Record<string, unknown>
    audit(actor, 'db_server.update', r.name, {
        ...metaFields,
        credentialRotated: fields.adminPasswordEnc !== undefined,
    })
    return toDto(storedServer(id))
}

/** Remove a registry row (`DELETE …/{id}`). The server itself is untouched. */
export function removeServer(actor: DbActor, id: string): void {
    const r = storedServer(id)
    dbServerRepo.remove(id)
    audit(actor, 'db_server.delete', r.name)
    slog('info', 'db-servers', 'server removed', { id, name: r.name, by: actor.login })
}

// ── live probe ───────────────────────────────────────────────────────────────

export interface DbServerTestResult {
    ok: boolean
    error?: string
}

/** Live credential/reachability check (`POST …/{id}/test`). Never throws on a
 *  connection failure — folds it into `{ok:false}` and records the probe either
 *  way so the health dot stays truthful. */
export async function testServer(actor: DbActor, id: string): Promise<DbServerTestResult> {
    const r = storedServer(id)
    try {
        await driverFor(r.kind).ping(connInfoOf(r))
        dbServerRepo.recordProbe(id, true)
        audit(actor, 'db_server.test', `${r.name}: ok`)
        return { ok: true }
    } catch (err) {
        const message = err instanceof DbDriverError ? err.message : 'connection failed'
        dbServerRepo.recordProbe(id, false, message)
        audit(actor, 'db_server.test', `${r.name}: ${message}`)
        return { ok: false, error: message }
    }
}

// ── error → HTTP mapping ─────────────────────────────────────────────────────

/** Map a registry/driver error to HTTP status + code. `detail` carries the
 *  engine's message for driver failures — it is an already-sanitized engine
 *  error (never a credential), and without it a 502 is undebuggable from the
 *  UI. Other error messages stay server-side. 5xx failures are also logged
 *  here (the one choke point every db-server route funnels through), because
 *  the Next request log only shows the status line. */
export function httpErrorFor(err: unknown): { status: number; code: string; detail?: string } {
    if (err instanceof DbServerError) return { status: err.status, code: err.code }
    if (err instanceof DbDriverError) {
        console.error(`[db-servers] driver error${err.code ? ` (${err.code})` : ''}: ${err.message}`)
        return { status: 502, code: 'db_driver_error', detail: err.message }
    }
    console.error('[db-servers] unexpected error:', err)
    return { status: 500, code: 'internal_error' }
}
