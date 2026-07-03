// GET /api/routing/state-history?kind=<kind>&key=<key> — the persisted episode
// history for one managed-mode resource on the caller's ACTIVE realm
// (perch_better.md B1): every disabled / at_risk / cert-failure episode the status
// poller recorded, newest-first, with audit attribution ("last changed by @login").
// Omit kind/key for the realm's recent episodes across all resources.
// Guarded by `authorize('maintainer')`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as realms from '@/server/services/realms'
import * as stateRepo from '@/server/data/repositories/resource-state-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    try {
        const active = await realms.resolveActiveRealm(authz.session.sub, authz.role)
        const params = new URL(req.url).searchParams
        const kind = params.get('kind')
        const key = params.get('key')
        const episodes =
            kind && key ? stateRepo.history(active.id, kind, key) : stateRepo.recentForRealm(active.id)
        return NextResponse.json({ episodes })
    } catch (err) {
        const { status, code } = realms.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
