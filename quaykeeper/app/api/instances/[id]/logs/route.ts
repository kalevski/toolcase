// GET  /api/instances/{id}/logs — this instance's log bindings (joined with
//      destination identity) plus the owner-defined destination options the
//      binding modal's select offers (id/name/type/url only — refs, no auth).
// POST /api/instances/{id}/logs — bind a destination to this instance
//      ({ destinationId, enabled?, shaping? }; upserts on the same destination).
//
// Guarded by `authorize('standard', 'instances')` like the other instance routes (D3):
// maintainers *choose* from owner-defined destinations; only the owner creates
// endpoints. Stored only — no daemon call; quaykeeper-client picks the change up
// via the agent snapshot's version bump on its next poll.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as instanceRepo from '@/server/data/repositories/instance-repo'
import * as logDests from '@/server/services/log-destinations'
import * as logBindings from '@/server/services/log-bindings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'instances')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    if (!instanceRepo.byId(id)) return NextResponse.json({ error: 'instance_not_found' }, { status: 404 })

    const destinations = logDests
        .list()
        .map((d) => ({ id: d.id, name: d.name, type: d.type, url: d.spec.url }))
    return NextResponse.json({ bindings: logBindings.listForInstance(id), destinations })
}

export async function POST(req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'instances')
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
        const value = logBindings.setInstanceBinding(actor, id, body)
        return NextResponse.json(value, { status: 201 })
    } catch (err) {
        const { status, code, detail } = logBindings.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
