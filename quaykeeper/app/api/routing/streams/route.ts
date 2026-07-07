// GET    /api/routing/streams — list every configured L4 stream listener.
// POST   /api/routing/streams — create/replace a stream (JSON Stream body).
// DELETE /api/routing/streams?name=<name> — remove a stream.
//
// Guarded by `authorize('standard', 'routing')` — owners and maintainers, never a standard
// user. Every op runs against the caller's ACTIVE realm (multiple_realms.md §E.2). A
// stream that names a stream-upstream is validated against the stream-upstreams already
// in that realm's running config, so create the pool first (an unknown reference comes
// back as a 400 `nginxpilot_rejected`).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as routing from '@/server/services/routing'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('standard', 'routing')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    try {
        const client = await realms.clientForActive(authz.session.sub, authz.role)
        return NextResponse.json(await routing.listStreams(client))
    } catch (err) {
        const { status, code, detail } = routing.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}

export async function POST(req: Request) {
    const authz = await authorize('standard', 'routing')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    // The daemon's bootstrap escape hatch for a DNS record that lands later (A5).
    const skipTargetChecks = new URL(req.url).searchParams.get('skip_target_checks') === 'true'
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const client = await realms.clientForActive(authz.session.sub, authz.role)
        const { value, warnings } = await routing.createStream(client, actor, body, { skipTargetChecks })
        return NextResponse.json({ ...value, warnings }, { status: 201 })
    } catch (err) {
        const { status, code, detail } = routing.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}

export async function DELETE(req: Request) {
    const authz = await authorize('standard', 'routing')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const name = new URL(req.url).searchParams.get('name') ?? undefined
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const client = await realms.clientForActive(authz.session.sub, authz.role)
        await routing.deleteStream(client, actor, name)
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code, detail } = routing.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
