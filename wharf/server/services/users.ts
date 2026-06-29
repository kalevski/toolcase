// Global users + roles service (planning §2.1, §10). Owner-only. Enforces the
// last-owner lockout guard (gap-9): the service refuses to demote or delete the
// final remaining owner.

import 'server-only'
import { tx } from '@/server/data/db'
import * as userRepo from '@/server/data/repositories/user-repo'
import type { AppUser, Role } from '@/server/domain/types'

export class LastOwnerError extends Error {}
export class UserNotFoundError extends Error {}

export function listUsers(): AppUser[] {
    return userRepo.list()
}

/** Promote/demote a user's GLOBAL role. Refuses to demote the last owner (gap-9). */
export function setGlobalRole(githubId: number, role: Role): AppUser {
    return tx(() => {
        const user = userRepo.get(githubId)
        if (!user) throw new UserNotFoundError()
        if (user.role === 'owner' && role !== 'owner' && userRepo.ownerCount() <= 1) {
            throw new LastOwnerError()
        }
        userRepo.setRole(githubId, role)
        return { ...user, role }
    })
}
