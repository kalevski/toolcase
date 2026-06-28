// Backup snapshots repository — SQL for the `backup` table (planning §4 v10, §8.7).

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { Backup } from '@/server/domain/types'

interface Raw {
    id: string
    path: string
    size_bytes: number
    encrypted: number
    kind: string
    key_id: string | null
    created_at: string
    created_by: number | null
}

function map(r: Raw): Backup {
    return {
        id: r.id,
        path: r.path,
        sizeBytes: r.size_bytes,
        encrypted: r.encrypted === 1,
        kind: r.kind as Backup['kind'],
        keyId: r.key_id ?? undefined,
        createdAt: r.created_at,
        createdBy: r.created_by ?? undefined,
    }
}

export function insert(b: Backup): void {
    prep(
        `INSERT INTO backup (id, path, size_bytes, encrypted, kind, key_id, created_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        b.id,
        b.path,
        b.sizeBytes,
        b.encrypted ? 1 : 0,
        b.kind,
        b.keyId ?? null,
        b.createdAt,
        b.createdBy ?? null,
    )
}

export function list(): Backup[] {
    return allRows<Raw>('SELECT * FROM backup ORDER BY created_at DESC').map(map)
}

export function byId(id: string): Backup | undefined {
    const r = getRow<Raw>('SELECT * FROM backup WHERE id = ?', id)
    return r ? map(r) : undefined
}

export function remove(id: string): void {
    prep('DELETE FROM backup WHERE id = ?').run(id)
}
