// GET    /api/admin/realms/{id}/log-bindings — this realm's log binding(s), joined
//        with destination identity (the Servers-page modal shows the first — the UI
//        is one-destination-per-realm).
// PUT    /api/admin/realms/{id}/log-bindings — set the realm's binding
//        ({ destinationId, enabled?, shaping? }). Pushes/retracts the fragment on
//        THAT realm's own nginxpilot; rolls the row back if the daemon rejects it.
// DELETE /api/admin/realms/{id}/log-bindings — clear the realm's binding(s):
//        retract the fragment (best-effort), then drop the row.
//
// All guarded by `authorize('owner')` (realm bindings drive the shared edge).
// Validation, the daemon push/retract and audit live in `services/log-bindings.ts`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as logBindings from '@/server/services/log-bindings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    return NextResponse.json(logBindings.listForRealm(id))
}

export async function PUT(req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { destinationId?: unknown; enabled?: unknown; shaping?: unknown }
    try {
        body = (await req.json()) as { destinationId?: unknown; enabled?: unknown; shaping?: unknown }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const value = await logBindings.setRealmBinding(actor, id, body)
        return NextResponse.json(value)
    } catch (err) {
        const { status, code, detail } = logBindings.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        for (const binding of logBindings.listForRealm(id)) {
            await logBindings.removeRealmBinding(actor, binding.id)
        }
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code, detail } = logBindings.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
