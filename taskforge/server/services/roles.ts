// Role map (§4.3) — business rules over the user repository (SQLite).
// All SQL lives in repositories/user-repo.ts; this module holds the policy
// (bootstrap the first owner, block demoting the last owner).

import 'server-only'
import * as userRepo from '@/server/data/repositories/user-repo'
import type { Role, UserRecord } from '@/server/domain/types'

export async function listUsers(): Promise<UserRecord[]> {
    return userRepo.list()
}

export async function getUser(githubId: number): Promise<UserRecord | undefined> {
    return userRepo.get(githubId)
}

/** Authoritative role lookup, re-read each call (§4.1 step 6). */
export async function getRole(githubId: number): Promise<Role | null> {
    const user = await getUser(githubId)
    return user ? user.role : null
}

export interface GithubProfile {
    githubId: number
    login: string
    name: string
    avatarUrl?: string
}

/**
 * Resolve (or create) a user on login. First user when no owner exists becomes
 * `owner` (bootstrap); every subsequent new user lands as `guest`. Returns the
 * resolved record (with its role).
 */
export async function resolveOnLogin(profile: GithubProfile): Promise<UserRecord> {
    return userRepo.transaction(() => {
        const existing = userRepo.get(profile.githubId)
        if (existing) {
            userRepo.updateProfile(profile.githubId, profile.login, profile.name, profile.avatarUrl)
            return { ...existing, login: profile.login, name: profile.name, avatarUrl: profile.avatarUrl }
        }
        const role: Role = userRepo.ownerCount() === 0 ? 'owner' : 'guest'
        const record: UserRecord = {
            githubId: profile.githubId,
            login: profile.login,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            role,
            addedAt: new Date().toISOString(),
        }
        userRepo.insert(record)
        return record
    })
}

export class LastOwnerError extends Error {}
export class UnknownUserError extends Error {}

/** Owner sets a user's role. Blocks demoting the last remaining owner (§4.3). */
export async function setRole(githubId: number, role: Role): Promise<UserRecord> {
    return userRepo.transaction(() => {
        const user = userRepo.get(githubId)
        if (!user) throw new UnknownUserError(`Unknown user ${githubId}`)
        if (user.role === 'owner' && role !== 'owner' && userRepo.ownerCount() === 1) {
            throw new LastOwnerError('Cannot demote the last remaining owner')
        }
        userRepo.setRole(githubId, role)
        return { ...user, role }
    })
}
