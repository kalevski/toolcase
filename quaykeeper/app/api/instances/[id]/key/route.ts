// POST   /api/instances/{id}/key — mint/rotate the fetch key; raw secret returned once.
// DELETE /api/instances/{id}/key — revoke the fetch key.
//
// Guarded by `authorize('maintainer')`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as instances from '@/server/services/instances'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, ctx: Ctx) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const body = (await req.json().catch(() => ({}))) as { expiresAt?: string | null }
    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const secret = instances.mintKey(actor, id, body.expiresAt ?? null)
        return NextResponse.json({ secret })
    } catch (err) {
        const { status, code } = instances.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        instances.revokeKey(actor, id)
        return NextResponse.json({ ok: true })
    } catch (err) {
        const { status, code } = instances.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
