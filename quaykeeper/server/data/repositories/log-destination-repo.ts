// Log-destination registry repository — all SQL for the `log_destination` table.
// Since the endpoint/binding split (logs_feature.md) a row is a reusable,
// owner-defined push *endpoint* (name/url/TLS/auth — the domain
// `DestinationEndpoint`); where it applies and how the stream is shaped live on
// `log_binding` rows (log-binding-repo.ts). (Databases created before the
// migration squash may still carry the pre-split `scope`/`target`/`enabled`
// columns — DEPRECATED, never read or written here.) The `spec` JSON carries
// secret material BY REFERENCE ONLY (`*_env`/`*_file`), so no column is encrypted.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { DestinationEndpoint } from '@/server/domain/nginxpilot-logdest-fragment'

/** The stored destination endpoint: identity + the validated endpoint-only JSON spec. */
export interface StoredLogDestination {
    id: string
    name: string
    type: string
    /** Endpoint fields only (url/tenant/TLS/auth) — shaping lives on bindings. */
    spec: DestinationEndpoint
    createdBy: number
    createdAt: string
    updatedAt: string
}

interface Raw {
    id: string
    name: string
    type: string
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
        spec: JSON.parse(r.spec) as DestinationEndpoint,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }
}

export function list(): StoredLogDestination[] {
    return allRows<Raw>('SELECT * FROM log_destination ORDER BY name').map(map)
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
        `INSERT INTO log_destination (id, name, type, spec, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        row.id,
        row.name,
        row.type,
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
        spec?: DestinationEndpoint
        updatedAt: string
    },
): void {
    const sets: string[] = []
    const params: (string | number)[] = []
    if (fields.type !== undefined) {
        sets.push('type = ?')
        params.push(fields.type)
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
