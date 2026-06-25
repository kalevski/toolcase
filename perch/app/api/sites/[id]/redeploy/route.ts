// POST /api/sites/{id}/redeploy — force an immediate redeploy of one owned site
// (`POST /sync/{domain}`, §9 step 6 — the "Redeploy" button). Guarded by
// `authorize('standard')`; ownership is re-checked in the service (§13).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as sites from '@/server/services/sites'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const authz = await authorize('standard')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        const site = await sites.redeploySite({ sub: authz.session.sub, role: authz.role }, id)
        return NextResponse.json(site)
    } catch (err) {
        const { status, code } = sites.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
