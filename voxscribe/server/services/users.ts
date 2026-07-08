// User administration (spec §6.5): admin CRUD on `app_user` roles with the
// last-admin-demotion guard.

import 'server-only'
import { tx } from '@/server/data/db'
import * as userRepo from '@/server/data/repositories/user-repo'
import type { AppUser, Role } from '@/server/domain/types'

export class UserError extends Error {
    constructor(
        message: string,
        public status: number,
    ) {
        super(message)
        this.name = 'UserError'
    }
}

export function listUsers(): AppUser[] {
    return userRepo.list()
}

const ASSIGNABLE: Role[] = ['guest', 'standard', 'admin']

/**
 * Change a user's role. Demoting the last admin would lock everyone out of
 * user management — refused with 409. Runs in a tx so two concurrent demotions
 * can't both pass the count check.
 */
export function setRole(githubId: number, role: Role): AppUser {
    if (!ASSIGNABLE.includes(role)) throw new UserError(`invalid role '${role}'`, 422)
    return tx(() => {
        const user = userRepo.get(githubId)
        if (!user) throw new UserError('user not found', 404)
        if (user.role === 'admin' && role !== 'admin' && userRepo.adminCount() <= 1) {
            throw new UserError('cannot demote the last admin', 409)
        }
        userRepo.setRole(githubId, role)
        return { ...user, role }
    })
}
