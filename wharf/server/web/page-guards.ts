// Server-component guards (blueprint §web, planning §10). Re-read the role from
// the DB each render so promotions/demotions take effect without re-login.

import 'server-only'
import { redirect } from 'next/navigation'
import { getSession, getRole } from '@/server/services/auth'
import * as userRepo from '@/server/data/repositories/user-repo'
import { ROLE_RANK, type MeResponse, type Role } from '@/server/domain/types'

/** Require a valid session; returns the current user (`MeResponse`). */
export async function requireSession(): Promise<MeResponse> {
    const session = await getSession()
    if (!session) redirect('/login')
    const user = userRepo.get(session.sub)
    return {
        githubId: session.sub,
        login: user?.login ?? session.login,
        name: user?.name ?? session.login,
        avatarUrl: user?.avatarUrl,
        role: user?.role ?? 'guest',
    }
}

/**
 * Require at least a global `minRole`. A guest is sent to /no-access; an
 * under-privileged authenticated user is sent home.
 */
export async function requireRole(minRole: Role): Promise<MeResponse> {
    const me = await requireSession()
    if (ROLE_RANK[me.role] < ROLE_RANK[minRole]) {
        if (me.role === 'guest') redirect('/no-access')
        redirect('/')
    }
    return me
}

/** True when the user can see the app at all (owner, or a member of ≥1 project). */
export async function hasAnyAccess(githubId: number): Promise<boolean> {
    if (getRole(githubId) === 'owner') return true
    const { listForUser } = await import('@/server/data/repositories/project-repo')
    return listForUser(githubId).length > 0
}

/**
 * Gate an app page: require a session, then require access (owner, or a member of
 * ≥1 project). A signed-in guest with no membership is routed to /no-access
 * (planning §2.1). Returns the current user for the shell.
 */
export async function requireAppAccess(): Promise<MeResponse> {
    const me = await requireSession()
    if (!(await hasAnyAccess(me.githubId))) redirect('/no-access')
    return me
}
