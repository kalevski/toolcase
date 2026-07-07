// GET    /api/snippets/{id} — read one snippet (spec + joined instance name/key state).
// PATCH  /api/snippets/{id} — rename/description/spec/instanceId.
// DELETE /api/snippets/{id} — delete a snippet.
//
// All guarded by `authorize('standard', 'snippets')`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as snippets from '@/server/services/docker-snippets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'snippets')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        return NextResponse.json(snippets.getSnippet(id))
    } catch (err) {
        const { status, code, message } = snippets.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}

export async function PATCH(req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'snippets')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: snippets.UpdateSnippetRequest
    try {
        body = (await req.json()) as snippets.UpdateSnippetRequest
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        return NextResponse.json(snippets.updateSnippet(actor, id, body))
    } catch (err) {
        const { status, code, message } = snippets.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'snippets')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        snippets.deleteSnippet(actor, id)
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code, message } = snippets.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}
