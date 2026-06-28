// Notes repository — SQL for the `note` table (planning §4 v7). The encrypted
// `content_enc` column NEVER appears on the mapped NoteMeta surface; the
// plaintext is served only by the audited reveal path via contentEnc(id).

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { NoteMeta } from '@/server/domain/types'

interface Raw {
    id: string
    project_id: string
    title: string
    content_enc: string
    created_by: number
    created_at: string
    updated_at: string
}

function map(r: Raw): NoteMeta {
    return {
        id: r.id,
        projectId: r.project_id,
        title: r.title,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }
}

export function listByProject(projectId: string): NoteMeta[] {
    return allRows<Raw>(
        'SELECT * FROM note WHERE project_id = ? ORDER BY created_at DESC',
        projectId,
    ).map(map)
}

export function byId(id: string): NoteMeta | undefined {
    const r = getRow<Raw>('SELECT * FROM note WHERE id = ?', id)
    return r ? map(r) : undefined
}

/** The sealed ciphertext for one note — for the audited reveal path only. */
export function contentEnc(id: string): string | undefined {
    const r = getRow<{ content_enc: string }>('SELECT content_enc FROM note WHERE id = ?', id)
    return r?.content_enc
}

export function insert(row: {
    id: string
    projectId: string
    title: string
    contentEnc: string
    createdBy: number
    createdAt: string
    updatedAt: string
}): void {
    prep(
        `INSERT INTO note (id, project_id, title, content_enc, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        row.id,
        row.projectId,
        row.title,
        row.contentEnc,
        row.createdBy,
        row.createdAt,
        row.updatedAt,
    )
}

export function update(
    id: string,
    fields: { title?: string; contentEnc?: string; updatedAt: string },
): void {
    const sets: string[] = []
    const params: (string | number)[] = []
    if (fields.title !== undefined) {
        sets.push('title = ?')
        params.push(fields.title)
    }
    if (fields.contentEnc !== undefined) {
        sets.push('content_enc = ?')
        params.push(fields.contentEnc)
    }
    sets.push('updated_at = ?')
    params.push(fields.updatedAt)
    params.push(id)
    prep(`UPDATE note SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function remove(id: string): void {
    prep('DELETE FROM note WHERE id = ?').run(id)
}
