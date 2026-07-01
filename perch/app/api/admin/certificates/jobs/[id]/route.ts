// GET /api/admin/certificates/jobs/{id} — poll one async certbot issuance job on the owner's
//      ACTIVE realm. `POST /api/admin/certificates` is async (202 + job id); the UI polls this
//      until the job is terminal (`succeeded` / `failed`). The certbot reason for a failure is
//      carried on the job's `error` field (owner-only surface). `404 not_found` for an unknown or
//      pruned job; `502` when the realm's nginxpilot couldn't be reached.
//
// Owner-gated server-side via `authorize('owner')`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as certs from '@/server/services/certs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    try {
        const { id } = await params
        const ctx = { githubId: authz.session.sub, login: authz.session.login, role: authz.role }
        return NextResponse.json(await certs.getIssueJob(ctx, id))
    } catch (err) {
        const { status, code, message } = certs.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}
