// PATCH  /api/admin/secrets/{id} — set a new value and/or description.
// DELETE /api/admin/secrets/{id} — remove one; 409 `secret_referenced` (with
//        the referencing instances) if any env var still points at it.
//
// Owner-only (`authorize('owner')`).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as configGlobals from '@/server/services/config-globals'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { value?: string; description?: string | null }
    try {
        body = (await req.json()) as { value?: string; description?: string | null }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        return NextResponse.json(configGlobals.updateSecret(actor, id, body))
    } catch (err) {
        const { status, code } = configGlobals.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        configGlobals.deleteSecret(actor, id)
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code, data } = configGlobals.httpErrorFor(err)
        return NextResponse.json({ error: code, ...(data ?? {}) }, { status })
    }
}
