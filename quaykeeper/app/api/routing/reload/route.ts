// POST /api/routing/reload — trigger a full config re-read + apply on the caller's
// ACTIVE realm (the daemon's `POST /reload`; impl "minor"). The daemon stages the
// rendered config, gates it behind `nginx -t`, and rolls back on failure — so this is
// safe, but it is still a live state change: owner-only, unlike the maintainer-level
// dry-run (`POST /api/routing/nginx-test`).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as routing from '@/server/services/routing'
import * as realms from '@/server/services/realms'
import * as auditRepo from '@/server/data/repositories/audit-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    try {
        const client = await realms.clientForActive(authz.session.sub, authz.role)
        await client.reload()
        auditRepo.append({
            githubId: authz.session.sub,
            login: authz.session.login,
            action: 'routing.reload',
            detail: 'manual config reload',
        })
        return NextResponse.json({ status: 'reloaded' })
    } catch (err) {
        const { status, code, detail } = routing.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
