// POST /api/sites/adopt — take over a site discovered live on a connected nginxpilot
// instance (the sites page's "Found on your instances" section). Owner-only, mirroring
// discovery itself: an unmanaged fragment belongs to no tenant, so only the operator
// may claim one. The body carries only the realm + domain identity — the config is
// re-read from the daemon in `services/sites.ts`, never client-supplied.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as sites from '@/server/services/sites'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: sites.AdoptSiteRequest
    try {
        body = (await req.json()) as sites.AdoptSiteRequest
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    try {
        const site = await sites.adoptSite({ sub: authz.session.sub, role: authz.role }, body)
        return NextResponse.json(site, { status: 201 })
    } catch (err) {
        const { status, code } = sites.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
