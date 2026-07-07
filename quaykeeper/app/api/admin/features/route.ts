// GET /api/admin/features — the app-wide global feature flags (owner Settings).
// PUT /api/admin/features — replace some/all global flags ({ [featureKey]: boolean }).
//
// Both guarded by `authorize('owner')`. Global flags are the master switch per
// feature; a disabled feature is hidden AND its API is refused for every non-owner.
// Storage + audit live in `services/features.ts` (the `feature.<key>` app_setting rows).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as features from '@/server/services/features'
import { isFeatureKey, type FeatureKey } from '@/server/domain/features'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })
    return NextResponse.json(features.globalFlagsWithDefaults())
}

export async function PUT(req: Request) {
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

    const flags: Partial<Record<FeatureKey, boolean>> = {}
    for (const [key, value] of Object.entries(body)) {
        if (isFeatureKey(key) && typeof value === 'boolean') flags[key] = value
    }

    const actor = { githubId: authz.session.sub, login: authz.session.login }
    return NextResponse.json(features.setGlobalFlags(actor, flags))
}
