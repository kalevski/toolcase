// Database-server registry repository — all SQL for the `db_server` table
// (perch_database_management.md §4, §7). The one stored piece of the database-
// management subsystem: everything else (databases/users/grants) is read live
// from the target server. `admin_password_enc` is ciphertext (cipher.ts); the
// service layer owns encrypt/decrypt — this module never sees a plaintext.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { DbServer, DbServerKind, DbServerTls } from '@/server/domain/types'

/** The stored row: the client DTO plus the encrypted admin credential. */
export interface StoredDbServer extends DbServer {
    adminPasswordEnc: string
}

interface Raw {
    id: string
    name: string
    kind: string
    host: string
    port: number
    tls: string
    admin_user: string
    admin_password_enc: string
    last_ok_at: string | null
    last_error: string | null
    created_at: string
    updated_at: string
}

function map(r: Raw): StoredDbServer {
    return {
        id: r.id,
        name: r.name,
        kind: r.kind as DbServerKind,
        host: r.host,
        port: r.port,
        tls: r.tls as DbServerTls,
        adminUser: r.admin_user,
        adminPasswordEnc: r.admin_password_enc,
        lastOkAt: r.last_ok_at ?? undefined,
        lastError: r.last_error ?? undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }
}

export function list(): StoredDbServer[] {
    return allRows<Raw>('SELECT * FROM db_server ORDER BY name').map(map)
}

export function byId(id: string): StoredDbServer | undefined {
    const r = getRow<Raw>('SELECT * FROM db_server WHERE id = ?', id)
    return r ? map(r) : undefined
}

export function byName(name: string): StoredDbServer | undefined {
    const r = getRow<Raw>('SELECT * FROM db_server WHERE name = ?', name)
    return r ? map(r) : undefined
}

export function insert(row: StoredDbServer): void {
    prep(
        `INSERT INTO db_server (id, name, kind, host, port, tls, admin_user, admin_password_enc,
                                last_ok_at, last_error, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        row.id,
        row.name,
        row.kind,
        row.host,
        row.port,
        row.tls,
        row.adminUser,
        row.adminPasswordEnc,
        row.lastOkAt ?? null,
        row.lastError ?? null,
        row.createdAt,
        row.updatedAt,
    )
}

/** Partial edit — `kind` is deliberately immutable (a registered server never
 *  changes engine; re-register instead). Absent fields keep their value. */
export function update(
    id: string,
    fields: {
        name?: string
        host?: string
        port?: number
        tls?: DbServerTls
        adminUser?: string
        adminPasswordEnc?: string
        updatedAt: string
    },
): void {
    const sets: string[] = []
    const params: (string | number)[] = []
    if (fields.name !== undefined) {
        sets.push('name = ?')
        params.push(fields.name)
    }
    if (fields.host !== undefined) {
        sets.push('host = ?')
        params.push(fields.host)
    }
    if (fields.port !== undefined) {
        sets.push('port = ?')
        params.push(fields.port)
    }
    if (fields.tls !== undefined) {
        sets.push('tls = ?')
        params.push(fields.tls)
    }
    if (fields.adminUser !== undefined) {
        sets.push('admin_user = ?')
        params.push(fields.adminUser)
    }
    if (fields.adminPasswordEnc !== undefined) {
        sets.push('admin_password_enc = ?')
        params.push(fields.adminPasswordEnc)
    }
    sets.push('updated_at = ?')
    params.push(fields.updatedAt)
    params.push(id)
    prep(`UPDATE db_server SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

/** Record the outcome of a probe/operation: success stamps `last_ok_at` and
 *  clears the error; failure stores the (sanitized) message and keeps the last
 *  success timestamp for the "worked until…" health display. */
export function recordProbe(id: string, ok: boolean, error?: string): void {
    const now = new Date().toISOString()
    if (ok) {
        prep('UPDATE db_server SET last_ok_at = ?, last_error = NULL WHERE id = ?').run(now, id)
    } else {
        prep('UPDATE db_server SET last_error = ? WHERE id = ?').run(error ?? 'unknown error', id)
    }
}

export function remove(id: string): void {
    prep('DELETE FROM db_server WHERE id = ?').run(id)
}

export function count(): number {
    return getRow<{ n: number }>('SELECT COUNT(*) AS n FROM db_server')?.n ?? 0
}
