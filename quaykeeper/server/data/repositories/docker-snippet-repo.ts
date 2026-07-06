// Docker-snippet repository — all SQL for the `docker_snippet` table (the
// Snippets page). The recipe is stored as an opaque JSON `spec` column and run
// through the pure `normalizeSpec` on every read, so a spec written before a
// shape change always comes back well-formed. The instance join carries only
// name + key presence — never key material.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import { normalizeSpec, type DockerRunSpec } from '@/server/domain/docker-run'
import type { DockerSnippet } from '@/server/domain/types'

interface Raw {
    id: string
    name: string
    description: string | null
    spec: string
    instance_id: string | null
    instance_name: string | null
    instance_key_hash: string | null
    created_by: number
    created_at: string
    updated_at: string
}

const SELECT = `
    SELECT s.*, i.name AS instance_name, i.key_hash AS instance_key_hash
    FROM docker_snippet s
    LEFT JOIN instance i ON i.id = s.instance_id
`

function map(r: Raw): DockerSnippet {
    let parsed: unknown
    try {
        parsed = JSON.parse(r.spec)
    } catch {
        parsed = null // normalizeSpec turns an unreadable spec into an empty one
    }
    return {
        id: r.id,
        name: r.name,
        description: r.description ?? undefined,
        spec: normalizeSpec(parsed),
        instanceId: r.instance_id ?? undefined,
        instanceName: r.instance_name ?? undefined,
        instanceHasKey: r.instance_id ? r.instance_key_hash != null : undefined,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }
}

export function create(row: {
    id: string
    name: string
    description?: string
    spec: DockerRunSpec
    instanceId?: string
    createdBy: number
    createdAt: string
}): void {
    prep(
        `INSERT INTO docker_snippet (id, name, description, spec, instance_id, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        row.id,
        row.name,
        row.description ?? null,
        JSON.stringify(row.spec),
        row.instanceId ?? null,
        row.createdBy,
        row.createdAt,
        row.createdAt,
    )
}

export function byId(id: string): DockerSnippet | undefined {
    const r = getRow<Raw>(`${SELECT} WHERE s.id = ?`, id)
    return r ? map(r) : undefined
}

export function list(): DockerSnippet[] {
    return allRows<Raw>(`${SELECT} ORDER BY s.name`).map(map)
}

export function nameTaken(name: string, excludeId?: string): boolean {
    const r = excludeId
        ? getRow<{ n: number }>('SELECT COUNT(*) AS n FROM docker_snippet WHERE name = ? AND id != ?', name, excludeId)
        : getRow<{ n: number }>('SELECT COUNT(*) AS n FROM docker_snippet WHERE name = ?', name)
    return (r?.n ?? 0) > 0
}

export function update(
    id: string,
    fields: {
        name?: string
        description?: string | null
        spec?: DockerRunSpec
        /** `null` clears the injection target; `undefined` leaves it unchanged. */
        instanceId?: string | null
        updatedAt: string
    },
): void {
    const sets: string[] = []
    const params: (string | null)[] = []
    if (fields.name !== undefined) {
        sets.push('name = ?')
        params.push(fields.name)
    }
    if (fields.description !== undefined) {
        sets.push('description = ?')
        params.push(fields.description)
    }
    if (fields.spec !== undefined) {
        sets.push('spec = ?')
        params.push(JSON.stringify(fields.spec))
    }
    if (fields.instanceId !== undefined) {
        sets.push('instance_id = ?')
        params.push(fields.instanceId)
    }
    sets.push('updated_at = ?')
    params.push(fields.updatedAt)
    params.push(id)
    prep(`UPDATE docker_snippet SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function remove(id: string): void {
    prep('DELETE FROM docker_snippet WHERE id = ?').run(id)
}
