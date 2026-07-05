// GET  /api/instances/{id}/vars — rows for editing (secret sources masked by
//      omission — the value is simply absent for non-literal rows).
// POST /api/instances/{id}/vars — create one ({ key, source, value? | globalVarId? | secretId? }).
//
// Guarded by `authorize('maintainer')`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as configVars from '@/server/services/config-vars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        return NextResponse.json(configVars.listVars(id))
    } catch (err) {
        const { status, code } = configVars.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}

export async function POST(req: Request, ctx: Ctx) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: configVars.CreateVarRequest
    try {
        body = (await req.json()) as configVars.CreateVarRequest
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const created = configVars.createVar(actor, id, body)
        return NextResponse.json(created, { status: 201 })
    } catch (err) {
        const { status, code } = configVars.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
