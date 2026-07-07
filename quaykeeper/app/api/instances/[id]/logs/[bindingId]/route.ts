// PATCH  /api/instances/{id}/logs/{bindingId} — update a binding's enabled flag /
//        shaping ({ enabled?, shaping? }).
// DELETE /api/instances/{id}/logs/{bindingId} — unbind the destination.
//
// Guarded by `authorize('standard', 'instances')` (D3). Stored only — the agent snapshot's
// version bump propagates the change to quaykeeper-client on its next poll.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as logBindings from '@/server/services/log-bindings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; bindingId: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'instances')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { enabled?: unknown; shaping?: unknown }
    try {
        body = (await req.json()) as { enabled?: unknown; shaping?: unknown }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id, bindingId } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const value = logBindings.updateInstanceBinding(actor, id, bindingId, body)
        return NextResponse.json(value)
    } catch (err) {
        const { status, code, detail } = logBindings.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'instances')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id, bindingId } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        logBindings.removeInstanceBinding(actor, id, bindingId)
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code, detail } = logBindings.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
