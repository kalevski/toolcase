// GET    /api/instances/{id} — read one instance (tags, key status, last_fetch_at).
// PATCH  /api/instances/{id} — rename/description/tags ({ tags } is a replace-set array).
// DELETE /api/instances/{id} — delete an instance (cascades tags/vars/flags).
//
// All guarded by `authorize('standard', 'instances')`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as instances from '@/server/services/instances'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'instances')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        return NextResponse.json(instances.getInstance(id))
    } catch (err) {
        const { status, code } = instances.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}

export async function PATCH(req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'instances')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: instances.UpdateInstanceRequest
    try {
        body = (await req.json()) as instances.UpdateInstanceRequest
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        return NextResponse.json(instances.updateInstance(actor, id, body))
    } catch (err) {
        const { status, code } = instances.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'instances')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        instances.deleteInstance(actor, id)
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code } = instances.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
