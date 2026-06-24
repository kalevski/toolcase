// Server-component guards. Re-read the role from roles.json each render so
// promotions/demotions take effect without re-login (§4.1, §5.2).

import 'server-only'
import { redirect } from 'next/navigation'
import { getSession } from '@/server/services/auth'
import { getUser } from '@/server/services/roles'
import { ROLE_RANK, type MeResponse, type Role } from '@/server/domain/types'

/** Require a valid session; returns the current user (`MeResponse`). */
export async function requireSession(): Promise<MeResponse> {
    const session = await getSession()
    if (!session) redirect('/login')
    const user = await getUser(session.sub)
    return {
        githubId: session.sub,
        login: user?.login ?? session.login,
        name: user?.name ?? session.login,
        avatarUrl: user?.avatarUrl,
        role: user?.role ?? 'guest',
    }
}

/**
 * Require at least `minRole`. Guests are sent to /no-access; an authenticated
 * but under-privileged user (e.g. standard hitting /users) is sent home.
 */
export async function requireRole(minRole: Role): Promise<MeResponse> {
    const me = await requireSession()
    if (ROLE_RANK[me.role] < ROLE_RANK[minRole]) {
        if (me.role === 'guest') redirect('/no-access')
        redirect('/')
    }
    return me
}
