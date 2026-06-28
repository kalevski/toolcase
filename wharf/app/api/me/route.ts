// GET /api/me — identity + global role for the signed-in user, so the client can
// gate nav. Guarded by `authorize('guest')`: any valid session passes (owner or
// guest); 401 when unauthenticated.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as userRepo from '@/server/data/repositories/user-repo'
import { type MeResponse } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('guest')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const user = userRepo.get(authz.session.sub)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body: MeResponse = {
        githubId: user.githubId,
        login: user.login,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: authz.role,
    }
    return NextResponse.json(body)
}
