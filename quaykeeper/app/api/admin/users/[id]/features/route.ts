// PUT /api/admin/users/{id}/features — set/replace a user's per-user feature
// overrides ({ [featureKey]: boolean | null }). A boolean pins the feature on/off
// for this user; `null` clears the override so it follows the global default.
//
// Guarded by `authorize('owner')`. Overrides only apply to non-owners (owners are
// never gated). Persist + audit live in `services/features.ts`. Returns the stored
// override map.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as features from '@/server/services/features'
import * as userRepo from '@/server/data/repositories/user-repo'
import { isFeatureKey, type FeatureKey } from '@/server/domain/features'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** Parse the `{id}` path segment to the integer github id, or `null` if malformed. */
function parseId(id: string): number | null {
    const n = Number(id)
    return Number.isInteger(n) ? n : null
}

export async function PUT(req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: Record<string, unknown>
    try {
        body = (await req.json()) as Record<string, unknown>
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }
    if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
    }

    const { id } = await ctx.params
    const githubId = parseId(id)
    if (githubId === null) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })

    const target = userRepo.get(githubId)
    if (!target) return NextResponse.json({ error: 'user_not_found' }, { status: 404 })

    const overrides: Partial<Record<FeatureKey, boolean>> = {}
    for (const [key, value] of Object.entries(body)) {
        if (!isFeatureKey(key)) continue
        // null ⇒ clear override; boolean ⇒ pin on/off.
        overrides[key] = value === null ? undefined : Boolean(value)
    }

    const actor = { githubId: authz.session.sub, login: authz.session.login }
    const stored = features.setUserOverrides(actor, githubId, target.login, overrides)
    return NextResponse.json(stored)
}
