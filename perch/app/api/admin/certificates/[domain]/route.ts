// PUT    /api/admin/certificates/{domain} — upload a manual cert/key pair ({ cert, key } PEM).
//        No certbot; works whenever `tls.cert_dir` is set. `501 not_enabled` when no cert dir.
// DELETE /api/admin/certificates/{domain} — delete a cert (certbot-managed or a manual pair; the
//        daemon picks the source). `404 not_found` when neither exists.
//
// Owner-gated via `authorize('owner')`. Validation (domain shape, PEM presence), audit, and error
// mapping live in `services/certs.ts`. The private key is accepted over this endpoint but NEVER
// logged or echoed back — exposing the admin port therefore requires nginxpilot's `admin.token_env`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as certs from '@/server/services/certs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ domain: string }> }

export async function PUT(req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { cert?: unknown; key?: unknown }
    try {
        body = (await req.json()) as { cert?: unknown; key?: unknown }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { domain } = await ctx.params
    try {
        const certCtx = { githubId: authz.session.sub, login: authz.session.login, role: authz.role }
        const result = await certs.uploadCertificate(certCtx, domain, {
            cert: typeof body.cert === 'string' ? body.cert : '',
            key: typeof body.key === 'string' ? body.key : '',
        })
        return NextResponse.json(result, { status: result.status === 'created' ? 201 : 200 })
    } catch (err) {
        const { status, code, message } = certs.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { domain } = await ctx.params
    try {
        const certCtx = { githubId: authz.session.sub, login: authz.session.login, role: authz.role }
        await certs.deleteCertificate(certCtx, domain)
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code, message } = certs.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}
