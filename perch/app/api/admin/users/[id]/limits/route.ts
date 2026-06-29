// PUT    /api/admin/users/{id}/limits — set/replace a user's custom limit override.
// DELETE /api/admin/users/{id}/limits — clear it (revert to role/plan defaults).
//
// Both guarded by `authorize('owner')`. The body of PUT is a partial PlanLimits —
// only its present fields override; the rest inherit the default. Validation +
// audit live in the admin service; this route is the thin HTTP seam. Effective
// limits update immediately (resolved per request, §11), so no backfill is needed.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as admin from '@/server/services/admin'

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

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id } = await ctx.params
    const githubId = parseId(id)
    if (githubId === null) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })

    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const row = admin.setUserLimits(actor, githubId, body)
        return NextResponse.json(row)
    } catch (err) {
        const { status, code } = admin.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    const githubId = parseId(id)
    if (githubId === null) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })

    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const row = admin.clearUserLimits(actor, githubId)
        return NextResponse.json(row)
    } catch (err) {
        const { status, code } = admin.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
