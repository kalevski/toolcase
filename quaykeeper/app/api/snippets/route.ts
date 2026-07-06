// GET  /api/snippets — list saved docker-run snippets (maintainer+).
// POST /api/snippets — create a snippet ({ name, description?, spec, instanceId? }).
//
// Guarded by `authorize('maintainer')` — snippets sit at the same level as the
// Config subsystem whose instances they inject.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as snippets from '@/server/services/docker-snippets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    return NextResponse.json(snippets.listSnippets())
}

export async function POST(req: Request) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: snippets.CreateSnippetRequest
    try {
        body = (await req.json()) as snippets.CreateSnippetRequest
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const created = snippets.createSnippet(actor, body)
        return NextResponse.json(created, { status: 201 })
    } catch (err) {
        const { status, code, message } = snippets.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}
