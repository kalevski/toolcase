// Secrets repository — SQL for the `secret` table (planning §4 v4). Project-level
// values encrypted at rest (AES-256-GCM ciphertext in `value_enc`). The Raw→meta
// map MUST NOT carry the ciphertext or plaintext: the keys-only `SecretMeta` is the
// only shape that may leave this module by default. The raw ciphertext is exposed
// ONLY through `valueEnc(id)` (server-only, for the audited reveal endpoint / Agent
// API). Devops-only at the route layer.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { SecretMeta } from '@/server/domain/types'

interface Raw {
    id: string
    project_id: string
    key: string
    value_enc: string
    description: string | null
    created_by: number
    created_at: string
    updated_at: string
}

/** Map a row to keys-only metadata — deliberately omits `value_enc`. */
function map(r: Raw): SecretMeta {
    return {
        id: r.id,
        projectId: r.project_id,
        key: r.key,
        description: r.description ?? undefined,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }
}

/** One inserted secret row (the service supplies the already-encrypted value). */
export interface SecretRow {
    id: string
    projectId: string
    key: string
    valueEnc: string
    description?: string
    createdBy: number
    createdAt: string
    updatedAt: string
}

export function listByProject(projectId: string): SecretMeta[] {
    return allRows<Raw>(
        'SELECT * FROM secret WHERE project_id = ? ORDER BY key',
        projectId,
    ).map(map)
}

export function byId(id: string): SecretMeta | undefined {
    const r = getRow<Raw>('SELECT * FROM secret WHERE id = ?', id)
    return r ? map(r) : undefined
}

export function byKey(projectId: string, key: string): SecretMeta | undefined {
    const r = getRow<Raw>('SELECT * FROM secret WHERE project_id = ? AND key = ?', projectId, key)
    return r ? map(r) : undefined
}

/** Server-only: the raw `value_enc` ciphertext for reveal/agent. NOT in any shared type. */
export function valueEnc(id: string): string | undefined {
    const r = getRow<{ value_enc: string }>('SELECT value_enc FROM secret WHERE id = ?', id)
    return r?.value_enc
}

export function insert(row: SecretRow): void {
    prep(
        `INSERT INTO secret (id, project_id, key, value_enc, description, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        row.id,
        row.projectId,
        row.key,
        row.valueEnc,
        row.description ?? null,
        row.createdBy,
        row.createdAt,
        row.updatedAt,
    )
}

export function update(
    id: string,
    fields: { valueEnc?: string; description?: string; updatedAt: string },
): void {
    const sets: string[] = []
    const params: (string | number | null)[] = []
    if (fields.valueEnc !== undefined) {
        sets.push('value_enc = ?')
        params.push(fields.valueEnc)
    }
    if (fields.description !== undefined) {
        sets.push('description = ?')
        params.push(fields.description || null)
    }
    sets.push('updated_at = ?')
    params.push(fields.updatedAt)
    params.push(id)
    prep(`UPDATE secret SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function remove(id: string): void {
    prep('DELETE FROM secret WHERE id = ?').run(id)
}

export function idsByProject(projectId: string): string[] {
    return allRows<{ id: string }>('SELECT id FROM secret WHERE project_id = ?', projectId).map(
        (r) => r.id,
    )
}

export function countByProject(projectId: string): number {
    const r = getRow<{ n: number }>('SELECT COUNT(*) AS n FROM secret WHERE project_id = ?', projectId)
    return r?.n ?? 0
}
