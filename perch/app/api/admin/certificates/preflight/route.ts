// POST /api/admin/certificates/preflight — advisory pre-flight for one domain before
// issuing a certificate (perch_better.md B2): DNS resolution, ingress-IP match, and an
// HTTP-01 challenge-path probe, classified into a single verdict. Gates nothing — it
// exists to save rate-limited ACME attempts that were never going to pass.
// Owner-gated like the rest of the cert surface.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as certs from '@/server/services/certs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { domain?: unknown }
    try {
        body = (await req.json()) as typeof body
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }
    if (typeof body.domain !== 'string' || !body.domain.trim()) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
    }

    try {
        const ctx = { githubId: authz.session.sub, login: authz.session.login, role: authz.role }
        return NextResponse.json(await certs.preflight(ctx, body.domain))
    } catch (err) {
        const { status, code, message } = certs.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}
