// POST /api/admin/certificates/renew — renew every certificate near expiry on the active realm
//      (`POST /certs/renew`). Returns certbot's plain-text summary as `{ output }`. Owner-gated.
//
// NOTE on routing: this static `renew` segment sits beside the dynamic `[domain]` segment. Next.js
// App Router resolves a static segment BEFORE a dynamic one, so `/api/admin/certificates/renew`
// always lands here, never on `[domain]`. (A cert can't be named "renew" anyway — domains need a dot.)

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as certs from '@/server/services/certs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    try {
        const ctx = { githubId: authz.session.sub, login: authz.session.login, role: authz.role }
        const output = await certs.renewAll(ctx)
        return NextResponse.json({ output })
    } catch (err) {
        const { status, code, message } = certs.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}
