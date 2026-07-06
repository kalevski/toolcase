// Log-destinations service (log_ides.md §4) — the control plane for structured
// log shipping. Owner-only (every destination carries a URL, and the `test`
// endpoint fires outbound HTTP from the edge host → SSRF surface, so per G21 only
// owners create/edit; site/instance opt-in toggles come later). Unlike routing
// resources — which live inside nginxpilot — log destinations are stored HERE
// (`log_destination` table): Quaykeeper owns `scope` and drift-reconciles the
// daemon's set against these rows (G19).
//
// Two scopes ship in v1:
//   • global   — the shared nginx edge. Rendered to a fragment and pushed to the
//                active realm's nginxpilot over Channel A (writeLogDestination).
//   • instance — app-instance logs. Stored only; delivered to quaykeeper-client
//                via the /v1/config snapshot (services/agent-fetch.ts). nginxpilot
//                never sees these.
// (Per-site derived destinations — G18 — are a later addition; the schema's
// `scope`/`target` columns already anticipate them.)
//
// SECRETS BY REFERENCE ONLY: the reference-only v1 model (§4.1) — a destination's
// `auth` carries `*_env`/`*_file` names; the operator provisions the actual secret
// on the nginxpilot host (global) or as an instance variable (instance). Quaykeeper
// never holds Loki credentials, so there is nothing to encrypt.

import 'server-only'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import * as logDestRepo from '@/server/data/repositories/log-destination-repo'
import type { LogDestScope, StoredLogDestination } from '@/server/data/repositories/log-destination-repo'
import {
    NginxpilotError,
    type LogDestTestResult,
    type NginxpilotClient,
    type NginxpilotLogsStatus,
} from '@/server/infrastructure/nginxpilot'
import {
    parseLogDestination,
    logqlSelector,
    type LogDestination,
} from '@/server/domain/nginxpilot-logdest-fragment'
import { ID } from '@/server/infrastructure/ids'
import { slog } from '@/server/infrastructure/server-log'

/** A refusal Quaykeeper raises *before* touching nginxpilot (bad request shape, name clash, unknown id). */
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
 * A destination as the admin UI sees it: identity + scope + the validated spec
 * (refs only — safe to serialize) + the LogQL selector its labels resolve to (a
 * concrete preview for the label config; empty for non-loki types).
 */
export interface LogDestDto {
    id: string
    name: string
    type: string
    scope: LogDestScope
    target?: string
    enabled: boolean
    spec: LogDestination
    logql: string
    createdAt: string
    updatedAt: string
}

const VALID_SCOPES: ReadonlySet<string> = new Set(['global', 'instance'])

function audit(actor: LogDestActor, action: string, detail: string, meta?: unknown): void {
    auditRepo.append({ githubId: actor.githubId, login: actor.login, action, site: null, detail, meta })
}

function toDto(row: StoredLogDestination): LogDestDto {
    return {
        id: row.id,
        name: row.name,
        type: row.type,
        scope: row.scope,
        target: row.target,
        enabled: row.enabled,
        spec: row.spec,
        logql: row.type === 'loki' ? logqlSelector(row.spec) : '',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }
}

/** Validate the request body into a spec plus its scope/target, applying the v1 scope rules. */
function parseRequest(input: unknown): { spec: LogDestination; scope: LogDestScope; target?: string } {
    const checked = parseLogDestination(input)
    if (!checked.ok) throw new LogDestError(checked.message, `logdest_${checked.reason}`, 400)

    const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
    const scopeRaw = typeof o.scope === 'string' && o.scope ? o.scope : 'global'
    if (!VALID_SCOPES.has(scopeRaw)) {
        throw new LogDestError('scope must be "global" or "instance"', 'logdest_bad_scope', 400)
    }
    const scope = scopeRaw as LogDestScope
    const target = typeof o.target === 'string' && o.target.trim() ? o.target.trim() : undefined
    if (scope === 'instance' && !target) {
        throw new LogDestError('an instance-scoped destination needs a target instance id', 'logdest_target_required', 400)
    }
    if (scope === 'instance' && checked.value.type !== 'loki' && checked.value.type !== 'http') {
        throw new LogDestError('instance destinations must be type loki or http (the client ships over the network)', 'logdest_bad_instance_type', 400)
    }
    if (scope !== 'instance' && checked.value.parse?.length) {
        throw new LogDestError('parse templates apply to instance destinations only (nginxpilot access logs are already JSON)', 'logdest_parse_global', 400)
    }
    return { spec: checked.value, scope, target }
}

export function list(): LogDestDto[] {
    return logDestRepo.list().map(toDto)
}

export function get(id: string): LogDestDto | undefined {
    const row = logDestRepo.byId(id)
    return row ? toDto(row) : undefined
}

/**
 * Create a destination. Persists the row, then (global scope) renders + pushes the
 * fragment to the active realm's nginxpilot — the daemon validates the candidate
 * merged config and answers a precise 400 if it disagrees, in which case the row is
 * rolled back so the DB never holds a destination the daemon rejected.
 */
export async function create(
    client: NginxpilotClient,
    actor: LogDestActor,
    input: unknown,
): Promise<{ value: LogDestDto; warnings: string[] }> {
    const { spec, scope, target } = parseRequest(input)
    if (logDestRepo.byName(spec.name)) {
        throw new LogDestError(`a log destination named "${spec.name}" already exists`, 'name_taken', 409)
    }

    const now = new Date().toISOString()
    const row: StoredLogDestination = {
        id: ID.logDestination(),
        name: spec.name,
        type: spec.type,
        scope,
        target,
        enabled: spec.enabled !== false,
        spec,
        createdBy: actor.githubId,
        createdAt: now,
        updatedAt: now,
    }
    logDestRepo.insert(row)

    let warnings: string[] = []
    try {
        if (scope === 'global') {
            ;({ warnings } = await client.writeLogDestination(spec))
        }
    } catch (err) {
        logDestRepo.remove(row.id) // don't persist a destination the daemon rejected
        throw err
    }
    audit(actor, 'logs.destination.create', `${spec.name} (${spec.type}, ${scope})`, redactMeta(row))
    slog('info', 'logs', 'log destination created', { name: spec.name, type: spec.type, scope, by: actor.login })
    return { value: toDto(row), warnings }
}

/**
 * Replace a destination (name is immutable — it is the fragment key). If the name in
 * the body differs from the stored name it is rejected; delete and recreate to rename.
 */
export async function update(
    client: NginxpilotClient,
    actor: LogDestActor,
    id: string,
    input: unknown,
): Promise<{ value: LogDestDto; warnings: string[] }> {
    const existing = logDestRepo.byId(id)
    if (!existing) throw new LogDestError('log destination not found', 'not_found', 404)

    const { spec, scope, target } = parseRequest(input)
    if (spec.name !== existing.name) {
        throw new LogDestError('a destination name is immutable (delete and recreate to rename)', 'name_immutable', 400)
    }

    const now = new Date().toISOString()
    const next: StoredLogDestination = {
        ...existing,
        type: spec.type,
        scope,
        target,
        enabled: spec.enabled !== false,
        spec,
        updatedAt: now,
    }

    let warnings: string[] = []
    if (scope === 'global') {
        ;({ warnings } = await client.writeLogDestination(spec))
    } else if (existing.scope === 'global') {
        // Scope moved off the edge — retract the daemon fragment.
        await client.removeLogDestination(existing.name).catch(() => undefined)
    }
    logDestRepo.update(id, { type: next.type, scope, target: target ?? null, enabled: next.enabled, spec, updatedAt: now })
    audit(actor, 'logs.destination.update', `${spec.name} (${spec.type}, ${scope})`, redactMeta(next))
    slog('info', 'logs', 'log destination updated', { name: spec.name, scope, by: actor.login })
    return { value: toDto(next), warnings }
}

/** Delete a destination from the DB and (global scope) retract its daemon fragment. */
export async function remove(client: NginxpilotClient, actor: LogDestActor, id: string): Promise<void> {
    const existing = logDestRepo.byId(id)
    if (!existing) throw new LogDestError('log destination not found', 'not_found', 404)
    if (existing.scope === 'global') {
        await client.removeLogDestination(existing.name)
    }
    logDestRepo.remove(id)
    audit(actor, 'logs.destination.delete', existing.name)
    slog('info', 'logs', 'log destination removed', { name: existing.name, by: actor.login })
}

/**
 * Test a CANDIDATE destination (body-based, pre-save) against the active realm's
 * daemon — validate it, push one synthetic entry, report the outcome. Owner-only and
 * never persisted; the URL SSRF surface is why this is gated to owners (G21).
 */
export async function test(client: NginxpilotClient, input: unknown): Promise<LogDestTestResult> {
    const { spec } = parseRequest(input)
    return client.testLogDestination(spec)
}

/** Per-destination shipping stats + intake health from the active realm (`GET /logs/status`). */
export async function logsStatus(client: NginxpilotClient): Promise<NginxpilotLogsStatus> {
    return client.logsStatus()
}

/**
 * Drift-reconcile the active realm's daemon against the DB's global destinations
 * (G19): re-push any global row whose daemon copy is missing or diverged, and retract
 * any daemon destination Quaykeeper no longer owns. Best-effort — a per-destination
 * failure is logged and skipped so one bad target never stalls the pass. Returns a
 * small summary for the caller (status-poll) to log.
 */
export async function reconcile(client: NginxpilotClient): Promise<{ pushed: number; removed: number }> {
    const desired = logDestRepo.listByScope('global')
    const live = await client.listLogDestinations()
    const liveByName = new Map(live.map((d) => [d.name, d]))
    const desiredNames = new Set(desired.map((d) => d.name))

    let pushed = 0
    for (const row of desired) {
        const current = liveByName.get(row.name)
        if (current && sameSpec(current, row.spec)) continue
        try {
            await client.writeLogDestination(row.spec)
            pushed++
        } catch (err) {
            slog('warn', 'logs', 'drift re-push failed', { name: row.name, error: String(err) })
        }
    }

    // Retract daemon destinations Quaykeeper owns the namespace for but no longer wants.
    // Only remove names that look Quaykeeper-managed AND aren't in the desired set; a
    // hand-added daemon destination (unknown to the DB) is left alone.
    let removed = 0
    for (const d of live) {
        if (desiredNames.has(d.name)) continue
        if (!logDestRepo.byName(d.name)) continue // not ours (not in DB at all) — leave it
        try {
            await client.removeLogDestination(d.name)
            removed++
        } catch (err) {
            slog('warn', 'logs', 'drift retract failed', { name: d.name, error: String(err) })
        }
    }
    return { pushed, removed }
}

/** Shallow spec-equality by canonical JSON — good enough to detect drift. */
function sameSpec(a: LogDestination, b: LogDestination): boolean {
    return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
}

/** Sort object keys recursively so JSON compare is order-insensitive. */
function canonical(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(canonical)
    if (v && typeof v === 'object') {
        const out: Record<string, unknown> = {}
        for (const k of Object.keys(v as Record<string, unknown>).sort()) {
            out[k] = canonical((v as Record<string, unknown>)[k])
        }
        return out
    }
    return v
}

/** Audit meta never carries anything sensitive (spec is refs only), but stamp scope/target explicitly. */
function redactMeta(row: StoredLogDestination): unknown {
    return { name: row.name, type: row.type, scope: row.scope, target: row.target, enabled: row.enabled }
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
