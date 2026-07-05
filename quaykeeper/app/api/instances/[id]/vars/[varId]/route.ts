// PATCH  /api/instances/{id}/vars/{varId} — update source/value/reference/description.
// DELETE /api/instances/{id}/vars/{varId} — remove one env var.
//
// Guarded by `authorize('maintainer')`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as configVars from '@/server/services/config-vars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; varId: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: configVars.UpdateVarRequest
    try {
        body = (await req.json()) as configVars.UpdateVarRequest
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id, varId } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        return NextResponse.json(configVars.updateVar(actor, id, varId, body))
    } catch (err) {
        const { status, code } = configVars.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id, varId } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        configVars.deleteVar(actor, id, varId)
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code } = configVars.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
