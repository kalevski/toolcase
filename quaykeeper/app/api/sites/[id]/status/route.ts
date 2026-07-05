// GET /api/sites/{id}/status — proxy nginxpilot's `GET /status` for one owned site's
// domain (§4 Channel B, §13). Returns the stored row plus the live per-site status entry
// (null until nginxpilot has seen the domain). Guarded by `authorize('standard')`;
// ownership is re-checked in the service (§13).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as sites from '@/server/services/sites'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const authz = await authorize('standard')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        const result = await sites.siteStatus({ sub: authz.session.sub, role: authz.role }, id)
        return NextResponse.json(result)
    } catch (err) {
        const { status, code } = sites.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
