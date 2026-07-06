// PATCH  /api/admin/log-destinations/{id} — replace a destination (name is immutable;
//        send the full LogDestination + { scope, target }).
// DELETE /api/admin/log-destinations/{id} — remove the row and (global scope) retract
//        its daemon fragment.
//
// Both guarded by `authorize('owner')` (G21). Validation + the daemon push/retract +
// audit live in `services/log-destinations.ts`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as logDests from '@/server/services/log-destinations'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const client = await realms.clientForActive(authz.session.sub, authz.role)
        const { value, warnings } = await logDests.update(client, actor, id, body)
        return NextResponse.json({ ...value, warnings })
    } catch (err) {
        const { status, code, detail } = logDests.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const client = await realms.clientForActive(authz.session.sub, authz.role)
        await logDests.remove(client, actor, id)
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code, detail } = logDests.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
