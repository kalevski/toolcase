// GET /api/routing/vhost/{domain} — the exact rendered nginx `server{}` block for one
// domain on the caller's ACTIVE realm (impl §5). The daemon's `GET /vhost/{domain}`
// deliberately renders even a disabled resource — this is a preview surface, not the
// live config — so a maintainer can see exactly where their `advanced` lines land
// before the apply/quarantine cycle passes judgment.
//
// Guarded by `authorize('maintainer')` — owners and maintainers, never a standard user.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as routing from '@/server/services/routing'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ domain: string }> }) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    try {
        const { domain } = await params
        const client = await realms.clientForActive(authz.session.sub, authz.role)
        const text = await client.vhost(domain)
        return NextResponse.json({ domain, vhost: text })
    } catch (err) {
        const { status, code, detail } = routing.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
