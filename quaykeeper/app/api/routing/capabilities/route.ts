// GET /api/routing/capabilities — the ACTIVE realm's daemon capability set (impl §6),
// derived from nginxpilot's self-describing `GET /schema` (a daemon-side test pins the
// document to the real route table). `{ capabilities: null }` means the schema probe
// /schema or is unreachable — clients must treat that as "unknown, assume everything",
// never as "no capabilities". Served from a short in-memory cache per realm.
//
// Guarded by `authorize('standard', 'routing')` — the routing surface's audience.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('standard', 'routing')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    try {
        const caps = await realms.capabilitiesForActive(authz.session.sub, authz.role)
        return NextResponse.json({ capabilities: caps })
    } catch {
        return NextResponse.json({ capabilities: null })
    }
}
