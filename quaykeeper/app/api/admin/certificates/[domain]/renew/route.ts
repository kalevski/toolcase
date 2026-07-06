// POST /api/admin/certificates/{domain}/renew — force-renew one certificate by name
//      (`POST /certs/{domain}/renew`). Owner-gated. `501 not_enabled` when `acme.enabled: false`;
//      `502 nginxpilot_error` (with the certbot reason as `message`) on a renewal failure.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as certs from '@/server/services/certs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ domain: string }> }

export async function POST(_req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { domain } = await ctx.params
    try {
        const certCtx = { githubId: authz.session.sub, login: authz.session.login, role: authz.role }
        await certs.renewOne(certCtx, domain)
        return NextResponse.json({ status: 'renewed', domain })
    } catch (err) {
        const { status, code, message } = certs.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}
