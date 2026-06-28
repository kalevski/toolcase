// Users / roles repository — all SQL for the `app_user` table (planning §4 v1).
// Raw snake_case rows mapped to the camelCase `AppUser` domain type. Business
// rules (bootstrap the first owner via `ownerCount`, block last-owner demotion)
// live in a service, not here.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { AppUser, Role } from '@/server/domain/types'

interface Raw {
    github_id: number
    login: string
    name: string
    avatar_url: string | null
    role: string
    added_at: string
}

function map(r: Raw): AppUser {
    return {
        githubId: r.github_id,
        login: r.login,
        name: r.name,
        avatarUrl: r.avatar_url ?? undefined,
        role: r.role as Role,
        addedAt: r.added_at,
    }
}

/** Every signed-in user, oldest first (so the bootstrap owner leads). */
export function list(): AppUser[] {
    return allRows<Raw>('SELECT * FROM app_user ORDER BY added_at').map(map)
}

export function insert(user: AppUser): void {
    prep(
        `INSERT INTO app_user (github_id, login, name, avatar_url, role, added_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(user.githubId, user.login, user.name, user.avatarUrl ?? null, user.role, user.addedAt)
}

/** Refresh the mutable GitHub profile fields; role and added_at untouched. */
export function updateProfile(githubId: number, login: string, name: string, avatarUrl?: string): void {
    prep(`UPDATE app_user SET login = ?, name = ?, avatar_url = ? WHERE github_id = ?`).run(
        login,
        name,
        avatarUrl ?? null,
        githubId,
    )
}

export function get(githubId: number): AppUser | undefined {
    const r = getRow<Raw>('SELECT * FROM app_user WHERE github_id = ?', githubId)
    return r ? map(r) : undefined
}

export function getByLogin(login: string): AppUser | undefined {
    const r = getRow<Raw>('SELECT * FROM app_user WHERE login = ? ORDER BY added_at DESC LIMIT 1', login)
    return r ? map(r) : undefined
}

/** Count `owner`-role users — `resolveOnLogin` bootstraps the first sign-in to owner. */
export function ownerCount(): number {
    const r = getRow<{ n: number }>(`SELECT COUNT(*) AS n FROM app_user WHERE role = 'owner'`)
    return r?.n ?? 0
}

/** Promote/demote a user. `authorize` re-reads the role each request. */
export function setRole(githubId: number, role: Role): void {
    prep('UPDATE app_user SET role = ? WHERE github_id = ?').run(role, githubId)
}
