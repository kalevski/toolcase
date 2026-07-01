// GET  /api/admin/certificates — list the TLS certificates nginxpilot has discovered in its
//      cert directory, for the owner's ACTIVE realm (multiple_realms.md §E.2). Metadata only —
//      never key material.
// POST /api/admin/certificates — issue a certificate via certbot
//      ({ domains, cert_name?, email?, provider?, staging? }). `email` / `provider` are optional
//      per-issue overrides (blank → the daemon's acme.email / acme.dns.provider config defaults).
//      `501 not_enabled` when the realm's nginxpilot has `acme.enabled: false`.
//
// Both owner-gated server-side via `authorize('owner')`; a non-owner is rejected before reaching
// nginxpilot. Validation + audit + error mapping live in `services/certs.ts`. A `502` means the
// realm's nginxpilot couldn't be reached (or refused the admin token); the daemon's own reason for
// a rejected issue is forwarded as `message` (owner-only surface).

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
        return NextResponse.json(await certs.listCertificates(ctx))
    } catch (err) {
        const { status, code, message } = certs.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}

export async function POST(req: Request) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: {
        domains?: unknown
        cert_name?: unknown
        email?: unknown
        provider?: unknown
        staging?: unknown
    }
    try {
        body = (await req.json()) as typeof body
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    try {
        const ctx = { githubId: authz.session.sub, login: authz.session.login, role: authz.role }
        const domains = Array.isArray(body.domains)
            ? body.domains.map(String)
            : typeof body.domains === 'string'
              ? body.domains
              : []
        const result = await certs.issueCertificate(ctx, {
            domains,
            certName: typeof body.cert_name === 'string' ? body.cert_name : undefined,
            email: typeof body.email === 'string' ? body.email : undefined,
            provider: typeof body.provider === 'string' ? body.provider : undefined,
            staging: body.staging === true,
        })
        // 202 Accepted — issuance runs async on the daemon; `result.job_id` is polled via
        // GET /api/admin/certificates/jobs/{id}.
        return NextResponse.json(result, { status: 202 })
    } catch (err) {
        const { status, code, message } = certs.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}
