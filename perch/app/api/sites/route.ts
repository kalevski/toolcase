// GET /api/sites  — list the caller's sites (the owner role sees all).
// POST /api/sites — create a site: quota-gated (§728), source + hostname validated
//                   (§729), then provisioned via the deploy service (§727).
//
// Both guarded by `authorize('standard')`; the per-site ownership rule and all
// orchestration live in `services/sites.ts` (§13). See §9, §13.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as sites from '@/server/services/sites'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('standard')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const list = sites.listSites({ sub: authz.session.sub, role: authz.role })
    return NextResponse.json(list)
}

export async function POST(req: Request) {
    const authz = await authorize('standard')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: sites.CreateSiteRequest
    try {
        body = (await req.json()) as sites.CreateSiteRequest
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    try {
        const site = await sites.createSite({ sub: authz.session.sub, role: authz.role }, body)
        return NextResponse.json(site, { status: 201 })
    } catch (err) {
        const { status, code } = sites.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
