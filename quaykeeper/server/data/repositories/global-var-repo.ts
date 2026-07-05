// Global-variables repository — all SQL for the `global_var` table
// (move_wharf_to_perch.md §3). Plain-text, app-wide key/value pairs.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { GlobalVar } from '@/server/domain/types'

interface Raw {
    id: string
    key: string
    value: string
    description: string | null
    created_at: string
    updated_at: string
}

function map(r: Raw): GlobalVar {
    return {
        id: r.id,
        key: r.key,
        value: r.value,
        description: r.description ?? undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }
}

export function list(): GlobalVar[] {
    return allRows<Raw>('SELECT * FROM global_var ORDER BY key').map(map)
}

export function byId(id: string): GlobalVar | undefined {
    const r = getRow<Raw>('SELECT * FROM global_var WHERE id = ?', id)
    return r ? map(r) : undefined
}

export function byKey(key: string): GlobalVar | undefined {
    const r = getRow<Raw>('SELECT * FROM global_var WHERE key = ?', key)
    return r ? map(r) : undefined
}

export function insert(row: GlobalVar): void {
    prep(
        `INSERT INTO global_var (id, key, value, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(row.id, row.key, row.value, row.description ?? null, row.createdAt, row.updatedAt)
}

export function update(id: string, fields: { value?: string; description?: string | null; updatedAt: string }): void {
    const sets: string[] = []
    const params: (string | null)[] = []
    if (fields.value !== undefined) {
        sets.push('value = ?')
        params.push(fields.value)
    }
    if (fields.description !== undefined) {
        sets.push('description = ?')
        params.push(fields.description)
    }
    sets.push('updated_at = ?')
    params.push(fields.updatedAt)
    params.push(id)
    prep(`UPDATE global_var SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function remove(id: string): void {
    prep('DELETE FROM global_var WHERE id = ?').run(id)
}
