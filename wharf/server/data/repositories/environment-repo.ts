// Environments repository — SQL for the `environment` table (planning §4 v3).

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { Environment } from '@/server/domain/types'

interface Raw {
    id: string
    project_id: string
    name: string
    sort_order: number
    strict_required: number
    created_at: string
}

function map(r: Raw): Environment {
    return {
        id: r.id,
        projectId: r.project_id,
        name: r.name,
        sortOrder: r.sort_order,
        strictRequired: r.strict_required === 1,
        createdAt: r.created_at,
    }
}

export function create(e: Environment): void {
    prep(
        `INSERT INTO environment (id, project_id, name, sort_order, strict_required, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(e.id, e.projectId, e.name, e.sortOrder, e.strictRequired ? 1 : 0, e.createdAt)
}

export function byId(id: string): Environment | undefined {
    const r = getRow<Raw>('SELECT * FROM environment WHERE id = ?', id)
    return r ? map(r) : undefined
}

export function byProjectAndName(projectId: string, name: string): Environment | undefined {
    const r = getRow<Raw>('SELECT * FROM environment WHERE project_id = ? AND name = ?', projectId, name)
    return r ? map(r) : undefined
}

export function listByProject(projectId: string): Environment[] {
    return allRows<Raw>(
        'SELECT * FROM environment WHERE project_id = ? ORDER BY sort_order, created_at',
        projectId,
    ).map(map)
}

export function update(
    id: string,
    fields: { name?: string; sortOrder?: number; strictRequired?: boolean },
): void {
    const sets: string[] = []
    const params: (string | number)[] = []
    if (fields.name !== undefined) {
        sets.push('name = ?')
        params.push(fields.name)
    }
    if (fields.sortOrder !== undefined) {
        sets.push('sort_order = ?')
        params.push(fields.sortOrder)
    }
    if (fields.strictRequired !== undefined) {
        sets.push('strict_required = ?')
        params.push(fields.strictRequired ? 1 : 0)
    }
    if (!sets.length) return
    params.push(id)
    prep(`UPDATE environment SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function remove(id: string): void {
    prep('DELETE FROM environment WHERE id = ?').run(id)
}

export function countByProject(projectId: string): number {
    const r = getRow<{ n: number }>('SELECT COUNT(*) AS n FROM environment WHERE project_id = ?', projectId)
    return r?.n ?? 0
}

export function maxSortOrder(projectId: string): number {
    const r = getRow<{ m: number | null }>(
        'SELECT MAX(sort_order) AS m FROM environment WHERE project_id = ?',
        projectId,
    )
    return r?.m ?? -1
}
