// GET /api/admin/acme-credentials — list the stored ACME DNS-provider credentials for the owner's
//     ACTIVE realm (`GET /acme/credentials`). Metadata ONLY (provider + mechanism + mtime) — the
//     secret bytes never leave the daemon. Owner-gated; an empty/disabled store returns `[]`.

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
        return NextResponse.json(await certs.listCredentials(ctx))
    } catch (err) {
        const { status, code, message } = certs.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}
