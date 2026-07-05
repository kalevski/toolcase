// GET /api/routing/status — the managed-mode live resource states for the caller's
// ACTIVE realm (A7). Unlike POST /api/routing/nginx-test (a dry run), this reflects
// what the daemon is *serving right now*, overlaid with the reconcile loop's
// `at_risk` verdicts — a resource that is live but would fail the next apply, with
// the `nginx -t` reason and how long it has been failing (`since`). Guarded by
// `authorize('maintainer')`.
//
// Response shape (always 200 unless auth/daemon fails):
//   { managed: false }                — daemon not in managed mode
//   { managed: true, resources, disabled_count, at_risk_count, reconcile? }

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as routing from '@/server/services/routing'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    try {
        const client = await realms.clientForActive(authz.session.sub, authz.role)
        const managed = await routing.nginxStatus(client)
        if (!managed) return NextResponse.json({ managed: false })
        return NextResponse.json(managed)
    } catch (err) {
        const { status, code, detail } = routing.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
