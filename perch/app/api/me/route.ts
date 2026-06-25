// GET /api/me — identity + effective plan + current usage for the signed-in
// user, so the client can gate UI on role, plan, limits, and quota headroom
// (§7 step 4, §13). Guarded by `authorize('standard')`: 401 when unauthenticated,
// 403 for an authenticated-but-unprovisioned (`guest`) caller.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import { resolveLimits, resolvePlan } from '@/server/services/plan'
import * as userRepo from '@/server/data/repositories/user-repo'
import * as siteRepo from '@/server/data/repositories/site-repo'
import { summarizeUsage } from '@/server/domain/usage'
import type { MeResponse } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('standard')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    // Freshly-read user row: authoritative profile fields (name/avatar aren't in
    // the session) alongside the re-read role. Passing `standard` guarantees the
    // row exists; guard defensively in case it was deleted mid-request.
    const user = userRepo.get(authz.session.sub)
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body: MeResponse = {
        githubId: user.githubId,
        login: user.login,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: authz.role,
        plan: resolvePlan(user.login),
        limits: resolveLimits(user.login),
        usage: summarizeUsage(siteRepo.listByOwner(user.githubId)),
    }
    return NextResponse.json(body)
}
