// Feature-flags repository — all SQL for the `feature_flag` table
// (move_wharf_to_perch.md §3, §5). Boolean-only, defined directly on the
// instance: no shared catalog, no per-environment values.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { FeatureFlag } from '@/server/domain/types'

interface Raw {
    id: string
    instance_id: string
    key: string
    enabled: number
    description: string | null
    created_at: string
    updated_at: string
}

function map(r: Raw): FeatureFlag {
    return {
        id: r.id,
        instanceId: r.instance_id,
        key: r.key,
        enabled: r.enabled === 1,
        description: r.description ?? undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }
}

export function listByInstance(instanceId: string): FeatureFlag[] {
    return allRows<Raw>('SELECT * FROM feature_flag WHERE instance_id = ? ORDER BY key', instanceId).map(map)
}

export function byId(id: string): FeatureFlag | undefined {
    const r = getRow<Raw>('SELECT * FROM feature_flag WHERE id = ?', id)
    return r ? map(r) : undefined
}

export function byInstanceAndKey(instanceId: string, key: string): FeatureFlag | undefined {
    const r = getRow<Raw>('SELECT * FROM feature_flag WHERE instance_id = ? AND key = ?', instanceId, key)
    return r ? map(r) : undefined
}

export function insert(row: {
    id: string
    instanceId: string
    key: string
    enabled: boolean
    description?: string
    createdAt: string
    updatedAt: string
}): void {
    prep(
        `INSERT INTO feature_flag (id, instance_id, key, enabled, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(row.id, row.instanceId, row.key, row.enabled ? 1 : 0, row.description ?? null, row.createdAt, row.updatedAt)
}

export function update(
    id: string,
    fields: { enabled?: boolean; description?: string | null; updatedAt: string },
): void {
    const sets: string[] = []
    const params: (string | number | null)[] = []
    if (fields.enabled !== undefined) {
        sets.push('enabled = ?')
        params.push(fields.enabled ? 1 : 0)
    }
    if (fields.description !== undefined) {
        sets.push('description = ?')
        params.push(fields.description)
    }
    sets.push('updated_at = ?')
    params.push(fields.updatedAt)
    params.push(id)
    prep(`UPDATE feature_flag SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function remove(id: string): void {
    prep('DELETE FROM feature_flag WHERE id = ?').run(id)
}
