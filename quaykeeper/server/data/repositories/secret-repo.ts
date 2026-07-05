// Secrets repository — all SQL for the `secret` table (move_wharf_to_perch.md
// §3). App-wide values encrypted at rest (AES-256-GCM ciphertext in
// `value_enc`). The Raw→meta map MUST NOT carry the ciphertext: the keys-only
// `SecretMeta` is the only shape that may leave this module by default. The raw
// ciphertext is exposed ONLY through `valueEnc(id)` (server-only, for the
// audited reveal endpoint / the instance fetch API).

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { SecretMeta } from '@/server/domain/types'

interface Raw {
    id: string
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
        key: r.key,
        description: r.description ?? undefined,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }
}

export interface SecretRow {
    id: string
    key: string
    valueEnc: string
    description?: string
    createdBy: number
    createdAt: string
    updatedAt: string
}

export function list(): SecretMeta[] {
    return allRows<Raw>('SELECT * FROM secret ORDER BY key').map(map)
}

export function byId(id: string): SecretMeta | undefined {
    const r = getRow<Raw>('SELECT * FROM secret WHERE id = ?', id)
    return r ? map(r) : undefined
}

export function byKey(key: string): SecretMeta | undefined {
    const r = getRow<Raw>('SELECT * FROM secret WHERE key = ?', key)
    return r ? map(r) : undefined
}

/** Server-only: the raw `value_enc` ciphertext for reveal / the fetch API. NOT in any shared type. */
export function valueEnc(id: string): string | undefined {
    const r = getRow<{ value_enc: string }>('SELECT value_enc FROM secret WHERE id = ?', id)
    return r?.value_enc
}

export function insert(row: SecretRow): void {
    prep(
        `INSERT INTO secret (id, key, value_enc, description, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(row.id, row.key, row.valueEnc, row.description ?? null, row.createdBy, row.createdAt, row.updatedAt)
}

export function update(id: string, fields: { valueEnc?: string; description?: string | null; updatedAt: string }): void {
    const sets: string[] = []
    const params: (string | null)[] = []
    if (fields.valueEnc !== undefined) {
        sets.push('value_enc = ?')
        params.push(fields.valueEnc)
    }
    if (fields.description !== undefined) {
        sets.push('description = ?')
        params.push(fields.description)
    }
    sets.push('updated_at = ?')
    params.push(fields.updatedAt)
    params.push(id)
    prep(`UPDATE secret SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function remove(id: string): void {
    prep('DELETE FROM secret WHERE id = ?').run(id)
}
