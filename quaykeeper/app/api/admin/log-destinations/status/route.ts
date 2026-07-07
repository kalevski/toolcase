// GET /api/admin/log-destinations/status[?realm=<id>] — per-destination shipping
//     stats + intake health from one realm's daemon (`GET /logs/status`). With
//     `?realm=` the stats come from that realm's client (the Servers-page binding
//     modal, D4 — stats are per fragment name on a specific daemon); without it,
//     from the caller's active realm.
//
// Guarded by `authorize('owner')`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as logDests from '@/server/services/log-destinations'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    try {
        const realmId = new URL(req.url).searchParams.get('realm')
        const client = realmId
            ? realms.clientFor(realmId)
            : await realms.clientForActive(authz.session.sub, authz.role)
        return NextResponse.json(await logDests.logsStatus(client))
    } catch (err) {
        const { status, code, detail } = logDests.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
