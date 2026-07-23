// GET /api/sites/overview — the sites-page payload: the caller's stored sites plus
// realm labels, every unmanaged site discovered live on the connected nginxpilot
// instances (owner-only), and any instance discovery couldn't reach. The plain
// `GET /api/sites` list stays as-is for callers that only need the stored rows.
//
// Guarded by `authorize('standard')`; the per-role visibility rules live in
// `services/sites.ts` (`sitesOverview`).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as sites from '@/server/services/sites'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('standard')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    try {
        const overview = await sites.sitesOverview({ sub: authz.session.sub, role: authz.role })
        return NextResponse.json(overview)
    } catch (err) {
        const { status, code } = sites.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
