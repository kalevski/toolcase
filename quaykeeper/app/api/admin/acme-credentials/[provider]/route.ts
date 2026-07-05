// PUT    /api/admin/acme-credentials/{provider} — store/replace a DNS-provider credential. Accepts
//        the raw passthrough ({ credentials }) or convenience fields ({ token } | { access_key,
//        secret_key } | { service_account_json }). `400 not_enabled`/`bad_request` (from the daemon)
//        when `acme` is off or the body doesn't match the provider.
// DELETE /api/admin/acme-credentials/{provider} — remove a stored credential (`404` when absent).
//
// Owner-gated. The secret material is accepted here but NEVER logged, echoed, or audited (only the
// provider name) — exposing nginxpilot's admin port requires its `admin.token_env`. Validation +
// audit + error mapping live in `services/certs.ts`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as certs from '@/server/services/certs'
import type { AcmeCredentialRequest } from '@/server/domain/cert-input'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ provider: string }> }

export async function PUT(req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: AcmeCredentialRequest
    try {
        body = (await req.json()) as AcmeCredentialRequest
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { provider } = await ctx.params
    try {
        const certCtx = { githubId: authz.session.sub, login: authz.session.login, role: authz.role }
        const result = await certs.setCredentials(certCtx, provider, body)
        return NextResponse.json(result, { status: result.status === 'created' ? 201 : 200 })
    } catch (err) {
        const { status, code, message } = certs.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { provider } = await ctx.params
    try {
        const certCtx = { githubId: authz.session.sub, login: authz.session.login, role: authz.role }
        await certs.deleteCredentials(certCtx, provider)
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code, message } = certs.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}
