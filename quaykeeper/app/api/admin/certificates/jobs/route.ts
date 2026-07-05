// GET /api/admin/certificates/jobs — the recent async certbot issuance jobs on the owner's
//      ACTIVE realm, newest first (impl §2). Jobs are ephemeral on the daemon (finished ones
//      are pruned after a TTL; a restart drops them), so this is a recent-history surface —
//      it lets a second admin (or a reopened tab) see an in-flight or recently failed
//      issuance instead of it being invisible outside the tab that started it.
//
// Owner-gated server-side via `authorize('owner')`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as certs from '@/server/services/certs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    try {
        const ctx = { githubId: authz.session.sub, login: authz.session.login, role: authz.role }
        return NextResponse.json({ jobs: await certs.listIssueJobs(ctx) })
    } catch (err) {
        const { status, code, message } = certs.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}
