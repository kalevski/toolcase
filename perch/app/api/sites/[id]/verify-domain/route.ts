// POST /api/sites/{id}/verify-domain — custom-domain DNS check for one owned site
// (§10, §729). Resolves the domain server-side and confirms it points at the ingress
// IP before any cert is issued (§16: prevents domain takeover); on success the vhost +
// cert are installed and the site marked live. Guarded by `authorize('standard')`;
// ownership is re-checked in the service (§13). A subdomain site is rejected 400.

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
        const result = await sites.verifyDomain({ sub: authz.session.sub, role: authz.role }, id)
        return NextResponse.json(result)
    } catch (err) {
        const { status, code } = sites.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
