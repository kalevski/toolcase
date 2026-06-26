// GET    /api/routing/proxies — list every configured reverse-proxy vhost.
// POST   /api/routing/proxies — create/replace a proxy (JSON Proxy body).
// DELETE /api/routing/proxies?domain=<domain> — remove a proxy.
//
// Guarded by `authorize('maintainer')` — owners and maintainers, never a standard
// user. A proxy that names an upstream is validated against the upstreams already in
// nginxpilot's running config, so create the upstream first (an unknown reference
// comes back as a 400 `nginxpilot_rejected`).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as routing from '@/server/services/routing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    try {
        return NextResponse.json(await routing.listProxies())
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
        const proxy = await routing.createProxy(actor, body)
        return NextResponse.json(proxy, { status: 201 })
    } catch (err) {
        const { status, code } = routing.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}

export async function DELETE(req: Request) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const domain = new URL(req.url).searchParams.get('domain') ?? undefined
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        await routing.deleteProxy(actor, domain)
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code } = routing.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
