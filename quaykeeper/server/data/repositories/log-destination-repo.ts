// Log-destination registry repository — all SQL for the `log_destination` table
// (log_ides.md §4). Quaykeeper is the source of truth for log destinations
// (unlike routing resources, which live in nginxpilot): this table drives what
// gets pushed to the daemon (global scope) or delivered to quaykeeper-client
// (instance scope), and the drift reconciler (G19) diffs the daemon's live set
// against these rows. The destination `spec` is stored as opaque JSON and carries
// secret material BY REFERENCE ONLY (`*_env`/`*_file`), so no column is encrypted.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { LogDestination } from '@/server/domain/nginxpilot-logdest-fragment'

/** Where a destination applies. `global` pushes to nginxpilot; `instance` is delivered to a client. */
export type LogDestScope = 'global' | 'site' | 'instance'

/** The stored destination: identity + scope binding + the validated JSON spec. */
export interface StoredLogDestination {
    id: string
    name: string
    type: string
    scope: LogDestScope
    /** Site hostname / instance id for a scoped destination; undefined for global. */
    target?: string
    enabled: boolean
    /** The full destination as `POST /log-destinations` / a `logs:` snapshot entry would carry it. */
    spec: LogDestination
    createdBy: number
    createdAt: string
    updatedAt: string
}

interface Raw {
    id: string
    name: string
    type: string
    scope: string
    target: string | null
    enabled: number
    spec: string
    created_by: number
    created_at: string
    updated_at: string
}

function map(r: Raw): StoredLogDestination {
    return {
        id: r.id,
        name: r.name,
        type: r.type,
        scope: r.scope as LogDestScope,
        target: r.target ?? undefined,
        enabled: r.enabled !== 0,
        spec: JSON.parse(r.spec) as LogDestination,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }
}

export function list(): StoredLogDestination[] {
    return allRows<Raw>('SELECT * FROM log_destination ORDER BY name').map(map)
}

export function listByScope(scope: LogDestScope): StoredLogDestination[] {
    return allRows<Raw>('SELECT * FROM log_destination WHERE scope = ? ORDER BY name', scope).map(map)
}

export function byId(id: string): StoredLogDestination | undefined {
    const r = getRow<Raw>('SELECT * FROM log_destination WHERE id = ?', id)
    return r ? map(r) : undefined
}

export function byName(name: string): StoredLogDestination | undefined {
    const r = getRow<Raw>('SELECT * FROM log_destination WHERE name = ?', name)
    return r ? map(r) : undefined
}

export function insert(row: StoredLogDestination): void {
    prep(
        `INSERT INTO log_destination (id, name, type, scope, target, enabled, spec, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        row.id,
        row.name,
        row.type,
        row.scope,
        row.target ?? null,
        row.enabled ? 1 : 0,
        JSON.stringify(row.spec),
        row.createdBy,
        row.createdAt,
        row.updatedAt,
    )
}

/** Replace the mutable fields of a destination (name is immutable — it is the fragment key). */
export function update(
    id: string,
    fields: {
        type?: string
        scope?: LogDestScope
        target?: string | null
        enabled?: boolean
        spec?: LogDestination
        updatedAt: string
    },
): void {
    const sets: string[] = []
    const params: (string | number | null)[] = []
    if (fields.type !== undefined) {
        sets.push('type = ?')
        params.push(fields.type)
    }
    if (fields.scope !== undefined) {
        sets.push('scope = ?')
        params.push(fields.scope)
    }
    if (fields.target !== undefined) {
        sets.push('target = ?')
        params.push(fields.target)
    }
    if (fields.enabled !== undefined) {
        sets.push('enabled = ?')
        params.push(fields.enabled ? 1 : 0)
    }
    if (fields.spec !== undefined) {
        sets.push('spec = ?')
        params.push(JSON.stringify(fields.spec))
    }
    sets.push('updated_at = ?')
    params.push(fields.updatedAt)
    params.push(id)
    prep(`UPDATE log_destination SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function remove(id: string): void {
    prep('DELETE FROM log_destination WHERE id = ?').run(id)
}

export function count(): number {
    return getRow<{ n: number }>('SELECT COUNT(*) AS n FROM log_destination')?.n ?? 0
}
