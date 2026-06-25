// GET /api/admin/plan-tiers — read the owner-editable `$ → plan` mapping (§8).
// PUT /api/admin/plan-tiers — replace the whole mapping ({ minCents, plan }[]).
//
// Both guarded by `authorize('owner')`. The replace round-trips: the GET shape (a
// cheapest-first `PlanTier[]`) is exactly what PUT accepts, and the change applies to
// effective plans immediately (they're computed, never stored — §8/§12). Validation +
// audit live in `services/admin.ts`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as admin from '@/server/services/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    return NextResponse.json(admin.getPlanTiers())
}

export async function PUT(req: Request) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    // Accept either the bare array (the shape GET returns — round-trip) or a
    // `{ tiers: [...] }` envelope; the service validates it either way.
    const input = Array.isArray(body) ? body : (body as { tiers?: unknown })?.tiers

    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const tiers = admin.replacePlanTiers(actor, input)
        return NextResponse.json(tiers)
    } catch (err) {
        const { status, code } = admin.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
