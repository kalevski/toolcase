// Feature-flags repository — SQL for the `feature_flag` + `feature_flag_value`
// tables (planning §4 v6, gap-7). The `value` column is stored as the raw
// serialized TEXT string; type coercion happens in the service layer.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { FeatureFlag, FlagType } from '@/server/domain/types'

// ── feature_flag ──────────────────────────────────────────────────────────────

interface FlagRaw {
    id: string
    project_id: string
    key: string
    description: string | null
    type: string
    created_at: string
}

function mapFlag(r: FlagRaw): FeatureFlag {
    return {
        id: r.id,
        projectId: r.project_id,
        key: r.key,
        description: r.description ?? undefined,
        type: r.type as FlagType,
        createdAt: r.created_at,
    }
}

export function listFlags(projectId: string): FeatureFlag[] {
    return allRows<FlagRaw>(
        'SELECT * FROM feature_flag WHERE project_id = ? ORDER BY key',
        projectId,
    ).map(mapFlag)
}

export function flagById(id: string): FeatureFlag | undefined {
    const r = getRow<FlagRaw>('SELECT * FROM feature_flag WHERE id = ?', id)
    return r ? mapFlag(r) : undefined
}

export function flagByKey(projectId: string, key: string): FeatureFlag | undefined {
    const r = getRow<FlagRaw>('SELECT * FROM feature_flag WHERE project_id = ? AND key = ?', projectId, key)
    return r ? mapFlag(r) : undefined
}

export function insertFlag(f: FeatureFlag): void {
    prep(
        `INSERT INTO feature_flag (id, project_id, key, description, type, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(f.id, f.projectId, f.key, f.description ?? null, f.type, f.createdAt)
}

export function updateFlag(id: string, fields: { description?: string; type?: FlagType }): void {
    const sets: string[] = []
    const params: (string | null)[] = []
    if (fields.description !== undefined) {
        sets.push('description = ?')
        params.push(fields.description || null)
    }
    if (fields.type !== undefined) {
        sets.push('type = ?')
        params.push(fields.type)
    }
    if (!sets.length) return
    params.push(id)
    prep(`UPDATE feature_flag SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function removeFlag(id: string): void {
    prep('DELETE FROM feature_flag WHERE id = ?').run(id)
}

// ── feature_flag_value (raw serialized TEXT in `value`) ─────────────────────────

export interface ValueRaw {
    id: string
    flag_id: string
    environment_id: string
    enabled: number
    value: string | null
    updated_at: string
}

/** Every value row across a project's flags (joined via flag.project_id). */
export function listValuesByProject(projectId: string): ValueRaw[] {
    return allRows<ValueRaw>(
        `SELECT v.* FROM feature_flag_value v
         JOIN feature_flag f ON f.id = v.flag_id
         WHERE f.project_id = ?`,
        projectId,
    )
}

export function listValuesForFlag(flagId: string): ValueRaw[] {
    return allRows<ValueRaw>('SELECT * FROM feature_flag_value WHERE flag_id = ?', flagId)
}

export function valueRow(flagId: string, environmentId: string): ValueRaw | undefined {
    return getRow<ValueRaw>(
        'SELECT * FROM feature_flag_value WHERE flag_id = ? AND environment_id = ?',
        flagId,
        environmentId,
    )
}

/** Insert-or-update by the (flag_id, environment_id) unique pair. */
export function upsertValue(row: {
    id: string
    flagId: string
    environmentId: string
    enabled: boolean
    value: string | null
    updatedAt: string
}): void {
    prep(
        `INSERT INTO feature_flag_value (id, flag_id, environment_id, enabled, value, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(flag_id, environment_id)
         DO UPDATE SET enabled = excluded.enabled, value = excluded.value, updated_at = excluded.updated_at`,
    ).run(
        row.id,
        row.flagId,
        row.environmentId,
        row.enabled ? 1 : 0,
        row.value,
        row.updatedAt,
    )
}
