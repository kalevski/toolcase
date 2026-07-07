// POST /api/instances/{id}/vars/import — persist resolved import entries
// ({ entries: [{ key, source, value? | globalVarId? | secretId? }] }). The
// client parses the .env blob and builds the re-point-to-global/secret preview
// itself (env-file.ts is pure/isomorphic); this just persists the result,
// skipping keys that already exist on the instance.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as configVars from '@/server/services/config-vars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'instances')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { entries?: configVars.ImportEntry[] }
    try {
        body = (await req.json()) as { entries?: configVars.ImportEntry[] }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }
    if (!Array.isArray(body.entries)) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
    }

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        return NextResponse.json(configVars.importVars(actor, id, body.entries))
    } catch (err) {
        const { status, code } = configVars.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
