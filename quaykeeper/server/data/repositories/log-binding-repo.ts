// Log-binding repository — all SQL for the `log_binding` table (logs_feature.md
// §3.2/§6). One row assigns a reusable destination endpoint (`log_destination`)
// to a log source — an nginxpilot realm's access logs (`scope = 'realm'`) or a
// Config instance's app logs (`scope = 'instance'`) — and carries the per-source
// shaping JSON (`LogShaping`: labels/filter/parse/tunables). Referential
// integrity to `log_destination` is service-enforced (no SQL FK, matching the
// table's own style); `UNIQUE(scope, target, destination_id)` means a source
// binds a given destination at most once.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { LogBindingScope, LogShaping } from '@/server/domain/nginxpilot-logdest-fragment'

/** One stored binding: destination × source + the shaping half of the old spec. */
export interface StoredLogBinding {
    id: string
    destinationId: string
    scope: LogBindingScope
    /** `realm.id` (realm scope) | `instance.id` (instance scope). */
    target: string
    enabled: boolean
    shaping: LogShaping
    createdBy: number
    createdAt: string
    updatedAt: string
}

interface Raw {
    id: string
    destination_id: string
    scope: string
    target: string
    enabled: number
    shaping: string
    created_by: number
    created_at: string
    updated_at: string
}

function map(r: Raw): StoredLogBinding {
    return {
        id: r.id,
        destinationId: r.destination_id,
        scope: r.scope as LogBindingScope,
        target: r.target,
        enabled: r.enabled !== 0,
        shaping: JSON.parse(r.shaping) as LogShaping,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }
}

export function list(): StoredLogBinding[] {
    return allRows<Raw>('SELECT * FROM log_binding ORDER BY scope, target, created_at').map(map)
}

export function listByDestination(destinationId: string): StoredLogBinding[] {
    return allRows<Raw>(
        'SELECT * FROM log_binding WHERE destination_id = ? ORDER BY scope, target',
        destinationId,
    ).map(map)
}

export function listByTarget(scope: LogBindingScope, target: string): StoredLogBinding[] {
    return allRows<Raw>(
        'SELECT * FROM log_binding WHERE scope = ? AND target = ? ORDER BY created_at',
        scope,
        target,
    ).map(map)
}

/** A realm's bindings — what its nginxpilot daemon should be shipping. */
export function listRealm(realmId: string): StoredLogBinding[] {
    return listByTarget('realm', realmId)
}

/** An instance's bindings — what its quaykeeper-client snapshot delivers. */
export function listInstance(instanceId: string): StoredLogBinding[] {
    return listByTarget('instance', instanceId)
}

export function byId(id: string): StoredLogBinding | undefined {
    const r = getRow<Raw>('SELECT * FROM log_binding WHERE id = ?', id)
    return r ? map(r) : undefined
}

/** The binding for one (source, destination) pair — the UNIQUE(scope, target, destination_id) lookup. */
export function bySource(
    scope: LogBindingScope,
    target: string,
    destinationId: string,
): StoredLogBinding | undefined {
    const r = getRow<Raw>(
        'SELECT * FROM log_binding WHERE scope = ? AND target = ? AND destination_id = ?',
        scope,
        target,
        destinationId,
    )
    return r ? map(r) : undefined
}

export function insert(row: StoredLogBinding): void {
    prep(
        `INSERT INTO log_binding (id, destination_id, scope, target, enabled, shaping, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        row.id,
        row.destinationId,
        row.scope,
        row.target,
        row.enabled ? 1 : 0,
        JSON.stringify(row.shaping),
        row.createdBy,
        row.createdAt,
        row.updatedAt,
    )
}

/** Replace a binding's mutable fields (source + destination are immutable — delete and rebind). */
export function update(
    id: string,
    fields: { enabled?: boolean; shaping?: LogShaping; updatedAt: string },
): void {
    const sets: string[] = []
    const params: (string | number)[] = []
    if (fields.enabled !== undefined) {
        sets.push('enabled = ?')
        params.push(fields.enabled ? 1 : 0)
    }
    if (fields.shaping !== undefined) {
        sets.push('shaping = ?')
        params.push(JSON.stringify(fields.shaping))
    }
    sets.push('updated_at = ?')
    params.push(fields.updatedAt)
    params.push(id)
    prep(`UPDATE log_binding SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function remove(id: string): void {
    prep('DELETE FROM log_binding WHERE id = ?').run(id)
}

/** Drop every binding for a source — the realm-delete cascade (D5). */
export function removeByTarget(scope: LogBindingScope, target: string): void {
    prep('DELETE FROM log_binding WHERE scope = ? AND target = ?').run(scope, target)
}

/** How many bindings reference a destination — the destination-delete guard. */
export function countByDestination(destinationId: string): number {
    return (
        getRow<{ n: number }>(
            'SELECT COUNT(*) AS n FROM log_binding WHERE destination_id = ?',
            destinationId,
        )?.n ?? 0
    )
}
