// GET    /api/routing/upstreams — list every configured nginx upstream pool.
// POST   /api/routing/upstreams — create/replace an upstream (JSON Upstream body).
// DELETE /api/routing/upstreams?name=<name> — remove an upstream (409 if still in use).
//
// Guarded by `authorize('maintainer')` — owners and maintainers, never a standard
// user. Maintainers operate the reverse-proxy routing surface but have no access to
// the owner-only `/api/admin/**` endpoints.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as routing from '@/server/services/routing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    try {
        return NextResponse.json(await routing.listUpstreams())
    } catch (err) {
        const { status, code } = routing.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}

export async function POST(req: Request) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const upstream = await routing.createUpstream(actor, body)
        return NextResponse.json(upstream, { status: 201 })
    } catch (err) {
        const { status, code } = routing.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}

export async function DELETE(req: Request) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const name = new URL(req.url).searchParams.get('name') ?? undefined
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        await routing.deleteUpstream(actor, name)
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code } = routing.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
