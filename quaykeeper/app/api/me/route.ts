// GET /api/me — identity + effective limits + current usage for the signed-in
// user, so the client can gate UI on role, limits, and quota headroom
// (§7 step 4, §13). Guarded by `authorize('standard')`: 401 when unauthenticated,
// 403 for an authenticated-but-unprovisioned (`guest`) caller.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import { resolveLimits } from '@/server/services/plan'
import * as realms from '@/server/services/realms'
import * as features from '@/server/services/features'
import * as userRepo from '@/server/data/repositories/user-repo'
import * as siteRepo from '@/server/data/repositories/site-repo'
import { summarizeUsage } from '@/server/domain/usage'
import { accountLevel, type MeResponse, type Realm } from '@/server/domain/types'

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

    // Active realm + the switch set (multiple_realms.md §E.4). The owner gets the full realm
    // list (the switcher lists them); a non-owner never receives the others (they can't switch).
    const canSwitchRealms = realms.canSwitchRealms(authz.role)
    // No realm registered yet (fresh install, or the last one was removed) isn't fatal here —
    // `/api/me` gates the whole app shell, so throwing would lock even the owner out of the
    // admin/realms page that lets them add one. Fall back to `null`; the client handles it.
    let activeRealm: Realm | null = null
    try {
        activeRealm = await realms.resolveActiveRealm(user.githubId, authz.role)
    } catch (err) {
        if (!(err instanceof realms.RealmError)) throw err
    }
    const body: MeResponse = {
        githubId: user.githubId,
        login: user.login,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: authz.role,
        level: accountLevel(authz.role),
        limits: resolveLimits(user.login),
        usage: summarizeUsage(siteRepo.listByOwner(user.githubId)),
        features: features.resolveFeatures(user.githubId, authz.role),
        activeRealm,
        canSwitchRealms,
        ...(canSwitchRealms ? { realms: realms.realmsVisibleTo(user.githubId, authz.role) } : {}),
    }
    return NextResponse.json(body)
}
