// Users / roles repository — all SQL for the `app_user` table.
// Replaces the on-disk `.auth/roles.json`. Business rules (bootstrap first admin,
// block last-admin demotion) live in roles.ts, which calls this layer.

import 'server-only'
import { prep, tx, getRow, allRows } from '@/server/data/db'
import type { Role, UserRecord } from '@/server/domain/types'

interface Raw {
    github_id: number
    login: string
    name: string
    avatar_url: string | null
    role: string
    added_at: string
}

function map(r: Raw): UserRecord {
    return {
        githubId: r.github_id,
        login: r.login,
        name: r.name,
        avatarUrl: r.avatar_url ?? undefined,
        role: r.role as Role,
        addedAt: r.added_at,
    }
}

export function list(): UserRecord[] {
    return allRows<Raw>('SELECT * FROM app_user ORDER BY added_at').map(map)
}

export function get(githubId: number): UserRecord | undefined {
    const r = getRow<Raw>('SELECT * FROM app_user WHERE github_id = ?', githubId)
    return r ? map(r) : undefined
}

export function adminCount(): number {
    const r = getRow<{ n: number }>(`SELECT COUNT(*) AS n FROM app_user WHERE role = 'admin'`)
    return r?.n ?? 0
}

export function insert(rec: UserRecord): void {
    prep(
        `INSERT INTO app_user (github_id, login, name, avatar_url, role, added_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(rec.githubId, rec.login, rec.name, rec.avatarUrl ?? null, rec.role, rec.addedAt)
}

/** Refresh display fields on an existing user (login/name/avatar), keeping role. */
export function updateProfile(githubId: number, login: string, name: string, avatarUrl?: string): void {
    prep('UPDATE app_user SET login = ?, name = ?, avatar_url = ? WHERE github_id = ?').run(
        login,
        name,
        avatarUrl ?? null,
        githubId,
    )
}

export function setRole(githubId: number, role: Role): void {
    prep('UPDATE app_user SET role = ? WHERE github_id = ?').run(role, githubId)
}

/** Run a read-modify-write against the user table atomically. */
export function transaction<T>(fn: () => T): T {
    return tx(fn)
}
