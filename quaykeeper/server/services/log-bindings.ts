// Log-binding service (logs_feature.md §7) — assigns a reusable destination
// endpoint (services/log-destinations.ts) to a log source and owns every daemon
// push/retract for the pipeline:
//
//   • realm binding    — "this NGINX server ships its access logs to destination X."
//     Set from the Servers page; the assembled `LogDestination` fragment is pushed
//     to *that* realm's nginxpilot (`realms.clientFor(realmId)` — never the
//     cookie-resolved active realm) over Channel A.
//   • instance binding — "this Config instance ships its app logs to destination X."
//     Set from the instance's Logs tab; stored only — quaykeeper-client picks it up
//     via the agent snapshot (services/agent-fetch.ts), whose version hash folds the
//     assembled spec, so no daemon call happens here.
//
// Realm bindings are owner-only (routes gate `authorize('owner')`); instance
// bindings are maintainer-level (D3) — maintainers *choose* from owner-defined
// endpoints, they can't define one. `reconcileRealm` replaces the old global
// drift reconcile (G19), now correctly scoped per realm.

import 'server-only'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import * as logDestRepo from '@/server/data/repositories/log-destination-repo'
import * as logBindingRepo from '@/server/data/repositories/log-binding-repo'
import type { StoredLogBinding } from '@/server/data/repositories/log-binding-repo'
import * as instanceRepo from '@/server/data/repositories/instance-repo'
import * as realmRepo from '@/server/data/repositories/realm-repo'
import * as realms from '@/server/services/realms'
import { RealmError } from '@/server/services/realms'
import { NginxpilotError, type NginxpilotClient } from '@/server/infrastructure/nginxpilot'
import {
    assembleSpec,
    parseShaping,
    logqlSelector,
    type DestinationEndpointType,
    type LogDestination,
    type LogShaping,
} from '@/server/domain/nginxpilot-logdest-fragment'
import { ID } from '@/server/infrastructure/ids'
import { slog } from '@/server/infrastructure/server-log'

/** A refusal Quaykeeper raises before touching nginxpilot (bad shaping, unknown ids, duplicates). */
export class LogBindingError extends Error {
    constructor(
        message: string,
        public code: string,
        public status: 400 | 404 | 409,
    ) {
        super(message)
        this.name = 'LogBindingError'
    }
}

/** The acting user, derived from the session — attributed on every audit entry. */
export interface LogBindingActor {
    githubId: number
    login: string
}

/**
 * A binding as the UI sees it: the binding row joined with its destination's
 * identity (name/type/url so tables render without a second fetch) + the LogQL
 * selector its labels resolve to (loki only — the preview pane).
 */
export interface LogBindingDto {
    id: string
    destinationId: string
    destinationName: string
    destinationType: string
    destinationUrl: string
    scope: 'realm' | 'instance'
    target: string
    enabled: boolean
    shaping: LogShaping
    logql: string
    createdAt: string
    updatedAt: string
}

function audit(actor: LogBindingActor, action: string, detail: string, meta?: unknown): void {
    auditRepo.append({ githubId: actor.githubId, login: actor.login, action, site: null, detail, meta })
}

function toDto(binding: StoredLogBinding, dest: { id: string; name: string; type: string; spec: { url: string } }): LogBindingDto {
    return {
        id: binding.id,
        destinationId: dest.id,
        destinationName: dest.name,
        destinationType: dest.type,
        destinationUrl: dest.spec.url,
        scope: binding.scope,
        target: binding.target,
        enabled: binding.enabled,
        shaping: binding.shaping,
        logql:
            dest.type === 'loki'
                ? logqlSelector({ name: dest.name, type: 'loki', labels: binding.shaping.labels })
                : '',
        createdAt: binding.createdAt,
        updatedAt: binding.updatedAt,
    }
}

/** Join one binding with its destination; undefined when the endpoint row is gone (shouldn't happen — deletes are guarded). */
function joined(binding: StoredLogBinding): LogBindingDto | undefined {
    const dest = logDestRepo.byId(binding.destinationId)
    return dest ? toDto(binding, dest) : undefined
}

export function listForRealm(realmId: string): LogBindingDto[] {
    return logBindingRepo
        .listRealm(realmId)
        .map(joined)
        .filter((d): d is LogBindingDto => !!d)
}

export function listForInstance(instanceId: string): LogBindingDto[] {
    return logBindingRepo
        .listInstance(instanceId)
        .map(joined)
        .filter((d): d is LogBindingDto => !!d)
}

/** Parse + validate a binding request's common half (destination + shaping). */
function parseBindingInput(
    input: { destinationId?: unknown; enabled?: unknown; shaping?: unknown },
    scope: 'realm' | 'instance',
): { destinationId: string; enabled: boolean; shaping: LogShaping } {
    const destinationId = typeof input.destinationId === 'string' ? input.destinationId.trim() : ''
    if (!destinationId) {
        throw new LogBindingError('"destinationId" is required', 'destination_required', 400)
    }
    const dest = logDestRepo.byId(destinationId)
    if (!dest) throw new LogBindingError('log destination not found', 'destination_not_found', 404)

    const checked = parseShaping(input.shaping, { scope, type: dest.type as DestinationEndpointType })
    if (!checked.ok) throw new LogBindingError(checked.message, `shaping_${checked.reason}`, 400)

    return { destinationId, enabled: input.enabled !== false, shaping: checked.value }
}

// ── realm bindings (owner; daemon push/retract lives here) ──────────────────────

/**
 * Set THE realm's log binding (the Servers-page modal is one-destination-per-realm):
 * upsert the row for the chosen destination, retract + drop any binding this realm
 * held on a *different* destination, then push/retract the daemon fragment on that
 * realm's own client. If the daemon rejects the fragment the row change is rolled
 * back, so the DB never holds a realm binding the daemon refused (mirrors the old
 * global-create rollback).
 */
export async function setRealmBinding(
    actor: LogBindingActor,
    realmId: string,
    input: { destinationId?: unknown; enabled?: unknown; shaping?: unknown },
): Promise<LogBindingDto> {
    if (!realmRepo.byId(realmId)) throw new LogBindingError('realm not found', 'realm_not_found', 404)
    const { destinationId, enabled, shaping } = parseBindingInput(input, 'realm')
    const dest = logDestRepo.byId(destinationId)!
    const client = realms.clientFor(realmId)

    // One binding per realm in the UI: switching destination retracts + drops the old one.
    for (const other of logBindingRepo.listRealm(realmId)) {
        if (other.destinationId === destinationId) continue
        const otherDest = logDestRepo.byId(other.destinationId)
        if (otherDest) await client.removeLogDestination(otherDest.name).catch(() => undefined)
        logBindingRepo.remove(other.id)
    }

    const now = new Date().toISOString()
    const previous = logBindingRepo.bySource('realm', realmId, destinationId)
    let row: StoredLogBinding
    if (previous) {
        logBindingRepo.update(previous.id, { enabled, shaping, updatedAt: now })
        row = { ...previous, enabled, shaping, updatedAt: now }
    } else {
        row = {
            id: ID.logBinding(),
            destinationId,
            scope: 'realm',
            target: realmId,
            enabled,
            shaping,
            createdBy: actor.githubId,
            createdAt: now,
            updatedAt: now,
        }
        logBindingRepo.insert(row)
    }

    try {
        if (enabled) {
            await client.writeLogDestination(assembleSpec(dest.spec, row))
        } else {
            await client.removeLogDestination(dest.name).catch(() => undefined)
        }
    } catch (err) {
        // Roll back — don't persist a binding whose fragment the daemon rejected.
        if (previous) logBindingRepo.update(previous.id, { enabled: previous.enabled, shaping: previous.shaping, updatedAt: previous.updatedAt })
        else logBindingRepo.remove(row.id)
        throw err
    }

    audit(actor, 'logs.binding.set', `realm:${realmId} → ${dest.name}`, {
        realm: realmId,
        destination: dest.name,
        enabled,
    })
    slog('info', 'logs', 'realm log binding set', { realm: realmId, destination: dest.name, enabled, by: actor.login })
    return toDto(row, dest)
}

/** Clear a realm binding: retract the daemon fragment (best-effort), then delete the row. */
export async function removeRealmBinding(actor: LogBindingActor, bindingId: string): Promise<void> {
    const binding = logBindingRepo.byId(bindingId)
    if (!binding || binding.scope !== 'realm') {
        throw new LogBindingError('log binding not found', 'binding_not_found', 404)
    }
    const dest = logDestRepo.byId(binding.destinationId)
    if (dest) {
        // Best-effort retraction: an unreachable daemon shouldn't strand the row —
        // reconcileRealm retracts the leftover fragment on its next pass.
        await realms
            .clientFor(binding.target)
            .removeLogDestination(dest.name)
            .catch((err) => slog('warn', 'logs', 'binding retract failed (reconcile will retry)', { realm: binding.target, error: String(err) }))
    }
    logBindingRepo.remove(binding.id)
    audit(actor, 'logs.binding.delete', `realm:${binding.target} → ${dest?.name ?? binding.destinationId}`)
    slog('info', 'logs', 'realm log binding removed', { realm: binding.target, destination: dest?.name, by: actor.login })
}

// ── instance bindings (maintainer; snapshot-delivered — no daemon call) ─────────

/**
 * Upsert an instance's binding for one destination. Stored only — the change
 * reaches the client via the agent snapshot's version-hash bump on its next poll.
 */
export function setInstanceBinding(
    actor: LogBindingActor,
    instanceId: string,
    input: { destinationId?: unknown; enabled?: unknown; shaping?: unknown },
): LogBindingDto {
    if (!instanceRepo.byId(instanceId)) {
        throw new LogBindingError('instance not found', 'instance_not_found', 404)
    }
    const { destinationId, enabled, shaping } = parseBindingInput(input, 'instance')
    const dest = logDestRepo.byId(destinationId)!

    const now = new Date().toISOString()
    const previous = logBindingRepo.bySource('instance', instanceId, destinationId)
    let row: StoredLogBinding
    if (previous) {
        logBindingRepo.update(previous.id, { enabled, shaping, updatedAt: now })
        row = { ...previous, enabled, shaping, updatedAt: now }
    } else {
        row = {
            id: ID.logBinding(),
            destinationId,
            scope: 'instance',
            target: instanceId,
            enabled,
            shaping,
            createdBy: actor.githubId,
            createdAt: now,
            updatedAt: now,
        }
        logBindingRepo.insert(row)
    }

    audit(actor, 'logs.binding.set', `instance:${instanceId} → ${dest.name}`, {
        instance: instanceId,
        destination: dest.name,
        enabled,
    })
    slog('info', 'logs', 'instance log binding set', { instance: instanceId, destination: dest.name, enabled, by: actor.login })
    return toDto(row, dest)
}

/** Patch an instance binding's enabled flag / shaping. */
export function updateInstanceBinding(
    actor: LogBindingActor,
    instanceId: string,
    bindingId: string,
    input: { enabled?: unknown; shaping?: unknown },
): LogBindingDto {
    const binding = logBindingRepo.byId(bindingId)
    if (!binding || binding.scope !== 'instance' || binding.target !== instanceId) {
        throw new LogBindingError('log binding not found', 'binding_not_found', 404)
    }
    const dest = logDestRepo.byId(binding.destinationId)
    if (!dest) throw new LogBindingError('log destination not found', 'destination_not_found', 404)

    let shaping = binding.shaping
    if (input.shaping !== undefined) {
        const checked = parseShaping(input.shaping, { scope: 'instance', type: dest.type as DestinationEndpointType })
        if (!checked.ok) throw new LogBindingError(checked.message, `shaping_${checked.reason}`, 400)
        shaping = checked.value
    }
    const enabled = input.enabled === undefined ? binding.enabled : input.enabled === true

    const now = new Date().toISOString()
    logBindingRepo.update(binding.id, { enabled, shaping, updatedAt: now })
    audit(actor, 'logs.binding.set', `instance:${instanceId} → ${dest.name}`, {
        instance: instanceId,
        destination: dest.name,
        enabled,
    })
    return toDto({ ...binding, enabled, shaping, updatedAt: now }, dest)
}

/** Delete an instance binding. Stored only — the snapshot hash bump stops the shipping. */
export function removeInstanceBinding(actor: LogBindingActor, instanceId: string, bindingId: string): void {
    const binding = logBindingRepo.byId(bindingId)
    if (!binding || binding.scope !== 'instance' || binding.target !== instanceId) {
        throw new LogBindingError('log binding not found', 'binding_not_found', 404)
    }
    const dest = logDestRepo.byId(binding.destinationId)
    logBindingRepo.remove(binding.id)
    audit(actor, 'logs.binding.delete', `instance:${instanceId} → ${dest?.name ?? binding.destinationId}`)
    slog('info', 'logs', 'instance log binding removed', { instance: instanceId, destination: dest?.name, by: actor.login })
}

// ── drift reconcile (G19, per realm) ────────────────────────────────────────────

/**
 * Drift-reconcile ONE realm's daemon against its own realm bindings: re-push any
 * enabled binding whose daemon fragment is missing or diverged, retract any daemon
 * destination Quaykeeper owns the name for but this realm no longer wants (covers
 * disabled/removed bindings and pre-split strays on non-default realms). A
 * hand-added daemon destination (name unknown to the DB) is left alone.
 * Best-effort per destination — one bad target never stalls the pass.
 */
export async function reconcileRealm(
    client: NginxpilotClient,
    realmId: string,
): Promise<{ pushed: number; removed: number }> {
    const desired = new Map<string, LogDestination>()
    for (const binding of logBindingRepo.listRealm(realmId)) {
        if (!binding.enabled) continue
        const dest = logDestRepo.byId(binding.destinationId)
        if (!dest) continue
        try {
            desired.set(dest.name, assembleSpec(dest.spec, binding))
        } catch (err) {
            slog('warn', 'logs', 'stored binding failed to assemble — skipped', { name: dest.name, error: String(err) })
        }
    }

    const live = await client.listLogDestinations()
    const liveByName = new Map(live.map((d) => [d.name, d]))

    let pushed = 0
    for (const [name, spec] of desired) {
        const current = liveByName.get(name)
        if (current && sameSpec(current, spec)) continue
        try {
            await client.writeLogDestination(spec)
            pushed++
        } catch (err) {
            slog('warn', 'logs', 'drift re-push failed', { name, realm: realmId, error: String(err) })
        }
    }

    let removed = 0
    for (const d of live) {
        if (desired.has(d.name)) continue
        if (!logDestRepo.byName(d.name)) continue // not ours (not in DB at all) — leave it
        try {
            await client.removeLogDestination(d.name)
            removed++
        } catch (err) {
            slog('warn', 'logs', 'drift retract failed', { name: d.name, realm: realmId, error: String(err) })
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

/** Map any error a log-binding op can throw to its HTTP status + code. */
export function httpErrorFor(err: unknown): HttpError {
    if (err instanceof LogBindingError) {
        return { status: err.status, code: err.code, detail: sanitizeDetail(err.message) }
    }
    if (err instanceof RealmError) {
        return { status: err.status, code: err.code }
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
