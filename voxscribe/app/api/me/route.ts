// GET /api/me — identity + role for the signed-in user (spec §8). Guarded by
// `authorize('standard')`: 401 unauthenticated, 403 for guests.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as userRepo from '@/server/data/repositories/user-repo'
import type { MeResponse } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('standard')
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
