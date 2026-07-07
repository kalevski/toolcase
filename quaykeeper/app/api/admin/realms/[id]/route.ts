// PATCH  /api/admin/realms/{id} — rename ({ name }), rotate the token ({ token }), or set
//        as the global default ({ default: true }). Exactly one action per request.
// DELETE /api/admin/realms/{id} — remove a realm (blocked when it still has sites/base
//        domains, or is the default while other realms exist — see the removal guards).
//
// Both guarded by `authorize('owner')` (§0.6). Validation + audit live in
// `services/realms.ts`. The token is write-only — a rotate never echoes the value back.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { name?: unknown; token?: unknown; default?: unknown }
    try {
        body = (await req.json()) as { name?: unknown; token?: unknown; default?: unknown }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        let updated
        if (body.default === true) {
            updated = realms.setDefaultRealm(actor, id)
        } else if (typeof body.token === 'string') {
            updated = realms.rotateRealmToken(actor, id, body.token)
        } else if (typeof body.name === 'string') {
            updated = realms.renameRealm(actor, id, body.name)
        } else {
            return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
        }
        return NextResponse.json(updated)
    } catch (err) {
        const { status, code, detail } = realms.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        realms.removeRealm(actor, id)
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code, detail } = realms.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
