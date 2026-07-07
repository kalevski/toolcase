// GET    /api/routing/redirects — list every configured redirection host.
// POST   /api/routing/redirects — create/replace a redirect (JSON Redirect body).
// DELETE /api/routing/redirects?domain=<domain> — remove a redirect.
//
// Guarded by `authorize('standard', 'routing')` — owners and maintainers, never a standard
// user. Every op runs against the caller's ACTIVE realm (multiple_realms.md §E.2).
// Redirect domains share the site/proxy domain namespace (a duplicate comes back as
// a 400 `nginxpilot_rejected`); wildcard domains (*.example.com) are supported.

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
        return NextResponse.json(await routing.listRedirects(client))
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
        const { value, warnings } = await routing.createRedirect(client, actor, body, { skipTargetChecks })
        return NextResponse.json({ ...value, warnings }, { status: 201 })
    } catch (err) {
        const { status, code, detail } = routing.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}

export async function DELETE(req: Request) {
    const authz = await authorize('standard', 'routing')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const domain = new URL(req.url).searchParams.get('domain') ?? undefined
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const client = await realms.clientForActive(authz.session.sub, authz.role)
        await routing.deleteRedirect(client, actor, domain)
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code, detail } = routing.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
