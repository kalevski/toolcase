// GET    /api/sites/{id} — read one owned site.
// PATCH  /api/sites/{id} — update branch / subdir / hostname of one owned site (§9 step 6).
// DELETE /api/sites/{id} — delete one owned site (fragment + custom vhost/cert teardown).
//
// All guarded by `authorize('standard')`; ownership is re-checked in the service
// (`site.owner_id === session.sub`, owner role bypasses, §13). A foreign/missing id is
// rejected 403/404 by the service — never trust the client-supplied id alone (§16).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as sites from '@/server/services/sites'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
    const authz = await authorize('standard')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        const site = sites.getSite({ sub: authz.session.sub, role: authz.role }, id)
        return NextResponse.json(site)
    } catch (err) {
        const { status, code } = sites.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}

export async function PATCH(req: Request, ctx: Ctx) {
    const authz = await authorize('standard')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: sites.UpdateSiteRequest
    try {
        body = (await req.json()) as sites.UpdateSiteRequest
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id } = await ctx.params
    try {
        const site = await sites.updateSite({ sub: authz.session.sub, role: authz.role }, id, body)
        return NextResponse.json(site)
    } catch (err) {
        const { status, code } = sites.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const authz = await authorize('standard')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        await sites.deleteSite({ sub: authz.session.sub, role: authz.role }, id)
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code } = sites.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
