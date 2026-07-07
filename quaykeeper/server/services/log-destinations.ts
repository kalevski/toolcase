// Log-destination service — owner CRUD over reusable log *endpoints*
// (logs_feature.md §7). Since the endpoint/binding split a destination is only
// the connection half (name/url/TLS/auth by reference); where it ships from and
// how the stream is shaped live on `log_binding` rows (services/log-bindings.ts,
// which also owns every daemon push/retract). Owner-only (every destination
// carries a URL, and the `test` endpoint fires outbound HTTP from the edge host
// → SSRF surface, so per G21 only owners create/edit endpoints; maintainers can
// merely *choose* one when binding an instance, D3).
//
// A bare endpoint ships nothing — creating one does NOT touch any daemon. An
// endpoint update re-pushes every enabled realm binding that references it (the
// fragments embed endpoint fields); instance bindings refresh implicitly via the
// agent-snapshot version hash. Deletion is blocked while any binding references
// the endpoint (409 `destination_in_use`).
//
// SECRETS BY REFERENCE ONLY: `auth` carries `*_env`/`*_file` names; the operator
// provisions the actual secret on the nginxpilot host (realm bindings) or as an
// instance variable (instance bindings). Quaykeeper never holds credentials.

import 'server-only'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import * as logDestRepo from '@/server/data/repositories/log-destination-repo'
import type { StoredLogDestination } from '@/server/data/repositories/log-destination-repo'
import * as logBindingRepo from '@/server/data/repositories/log-binding-repo'
import * as realms from '@/server/services/realms'
import {
    NginxpilotError,
    type LogDestTestResult,
    type NginxpilotClient,
    type NginxpilotLogsStatus,
} from '@/server/infrastructure/nginxpilot'
import {
    parseDestinationEndpoint,
    assembleSpec,
    type DestinationEndpoint,
} from '@/server/domain/nginxpilot-logdest-fragment'
import { ID } from '@/server/infrastructure/ids'
import { slog } from '@/server/infrastructure/server-log'

/** A refusal Quaykeeper raises *before* touching nginxpilot (bad request shape, name clash, unknown id, in-use delete). */
export class LogDestError extends Error {
    constructor(
        message: string,
        public code: string,
        public status: 400 | 404 | 409,
    ) {
        super(message)
        this.name = 'LogDestError'
    }
}

/** The acting owner, derived from the session — attributed on every audit entry. */
export interface LogDestActor {
    githubId: number
    login: string
}

/**
 * A destination endpoint as the admin UI sees it: identity + the validated
 * endpoint spec (refs only — safe to serialize) + how many sources bind it (the
 * at-a-glance reuse signal before editing/deleting, D4).
 */
export interface LogDestDto {
    id: string
    name: string
    type: string
    spec: DestinationEndpoint
    usedBy: { realms: number; instances: number }
    createdAt: string
    updatedAt: string
}

function audit(actor: LogDestActor, action: string, detail: string, meta?: unknown): void {
    auditRepo.append({ githubId: actor.githubId, login: actor.login, action, site: null, detail, meta })
}

function toDto(row: StoredLogDestination): LogDestDto {
    const bindings = logBindingRepo.listByDestination(row.id)
    return {
        id: row.id,
        name: row.name,
        type: row.type,
        spec: row.spec,
        usedBy: {
            realms: bindings.filter((b) => b.scope === 'realm').length,
            instances: bindings.filter((b) => b.scope === 'instance').length,
        },
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }
}

/** Validate the request body into an endpoint spec. */
function parseRequest(input: unknown): DestinationEndpoint {
    const checked = parseDestinationEndpoint(input)
    if (!checked.ok) throw new LogDestError(checked.message, `logdest_${checked.reason}`, 400)
    return checked.value
}

export function list(): LogDestDto[] {
    return logDestRepo.list().map(toDto)
}

export function get(id: string): LogDestDto | undefined {
    const row = logDestRepo.byId(id)
    return row ? toDto(row) : undefined
}

/**
 * Create a destination endpoint. Persist-only — a bare endpoint ships nothing
 * until a realm or instance binds it, so no daemon is touched here.
 */
export function create(actor: LogDestActor, input: unknown): LogDestDto {
    const spec = parseRequest(input)
    if (logDestRepo.byName(spec.name)) {
        throw new LogDestError(`a log destination named "${spec.name}" already exists`, 'name_taken', 409)
    }

    const now = new Date().toISOString()
    const row: StoredLogDestination = {
        id: ID.logDestination(),
        name: spec.name,
        type: spec.type,
        spec,
        createdBy: actor.githubId,
        createdAt: now,
        updatedAt: now,
    }
    logDestRepo.insert(row)
    audit(actor, 'logs.destination.create', `${spec.name} (${spec.type})`, { name: spec.name, type: spec.type })
    slog('info', 'logs', 'log destination created', { name: spec.name, type: spec.type, by: actor.login })
    return toDto(row)
}

/**
 * Replace a destination endpoint (name is immutable — it is the fragment key; delete
 * and recreate to rename). The daemon fragments embed endpoint fields, so every
 * enabled realm binding referencing this endpoint is re-pushed to *its* realm
 * (`clientFor(binding.target)`); a per-realm push failure is folded into `warnings`
 * (the reconcile pass retries it) rather than failing the update. Instance bindings
 * refresh implicitly — the agent snapshot reads the endpoint fresh, so the version
 * hash bumps and every bound client hot-reloads on its next poll.
 */
export async function update(
    actor: LogDestActor,
    id: string,
    input: unknown,
): Promise<{ value: LogDestDto; warnings: string[] }> {
    const existing = logDestRepo.byId(id)
    if (!existing) throw new LogDestError('log destination not found', 'not_found', 404)

    const spec = parseRequest(input)
    if (spec.name !== existing.name) {
        throw new LogDestError('a destination name is immutable (delete and recreate to rename)', 'name_immutable', 400)
    }

    const now = new Date().toISOString()
    logDestRepo.update(id, { type: spec.type, spec, updatedAt: now })

    const warnings: string[] = []
    for (const binding of logBindingRepo.listByDestination(id)) {
        if (binding.scope !== 'realm' || !binding.enabled) continue
        try {
            const client = realms.clientFor(binding.target)
            const { warnings: pushWarnings } = await client.writeLogDestination(assembleSpec(spec, binding))
            warnings.push(...pushWarnings)
        } catch (err) {
            slog('warn', 'logs', 'endpoint-update fragment re-push failed', {
                name: spec.name,
                realm: binding.target,
                error: String(err),
            })
            warnings.push(`fragment re-push failed for realm ${binding.target} — the reconcile pass will retry`)
        }
    }

    audit(actor, 'logs.destination.update', `${spec.name} (${spec.type})`, { name: spec.name, type: spec.type })
    slog('info', 'logs', 'log destination updated', { name: spec.name, by: actor.login })
    const next = logDestRepo.byId(id)
    return { value: toDto(next ?? { ...existing, type: spec.type, spec, updatedAt: now }), warnings }
}

/**
 * Delete a destination endpoint. Blocked (409 `destination_in_use`) while any
 * binding references it — unbind from the Servers page / instance Logs tab first.
 * An unbound endpoint has no daemon fragment anywhere, so this is DB-only.
 */
export function remove(actor: LogDestActor, id: string): void {
    const existing = logDestRepo.byId(id)
    if (!existing) throw new LogDestError('log destination not found', 'not_found', 404)
    const inUse = logBindingRepo.countByDestination(id)
    if (inUse > 0) {
        throw new LogDestError(
            `"${existing.name}" is in use by ${inUse} binding(s) — unbind first`,
            'destination_in_use',
            409,
        )
    }
    logDestRepo.remove(id)
    audit(actor, 'logs.destination.delete', existing.name)
    slog('info', 'logs', 'log destination removed', { name: existing.name, by: actor.login })
}

/**
 * Test a CANDIDATE endpoint (body-based, pre-save) against the active realm's
 * daemon — assemble it with empty shaping, push one synthetic entry, report the
 * outcome. Owner-only and never persisted; the URL SSRF surface is why this is
 * gated to owners (G21).
 */
export async function test(client: NginxpilotClient, input: unknown): Promise<LogDestTestResult> {
    const spec = parseRequest(input)
    return client.testLogDestination(assembleSpec(spec, { scope: 'realm', enabled: true, shaping: {} }))
}

/** Per-destination shipping stats + intake health from one realm's daemon (`GET /logs/status`). */
export async function logsStatus(client: NginxpilotClient): Promise<NginxpilotLogsStatus> {
    return client.logsStatus()
}

// ── error → HTTP mapping (so routes stay thin) ──────────────────────────────────

export interface HttpError {
    status: number
    code: string
    detail?: string
}

function sanitizeDetail(raw: string | undefined): string | undefined {
    if (!raw) return undefined
    const clean = raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()
    if (!clean) return undefined
    return clean.length > 500 ? `${clean.slice(0, 497)}…` : clean
}

/** Map any error a log-destination op can throw to its HTTP status + code. */
export function httpErrorFor(err: unknown): HttpError {
    if (err instanceof LogDestError) {
        return { status: err.status, code: err.code, detail: sanitizeDetail(err.message) }
    }
    if (err instanceof NginxpilotError) {
        switch (err.status) {
            case 400:
                return { status: 400, code: 'nginxpilot_rejected', detail: sanitizeDetail(err.detail) }
            case 404:
                return { status: 404, code: 'not_found', detail: sanitizeDetail(err.detail) }
            default:
                return { status: 502, code: 'nginxpilot_error' }
        }
    }
    return { status: 500, code: 'internal_error' }
}
