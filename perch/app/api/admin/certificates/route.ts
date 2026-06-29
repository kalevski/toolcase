// GET /api/admin/certificates — list the TLS certificates nginxpilot has discovered
// in its cert directory, for the owner's ACTIVE realm (multiple_realms.md §E.2). Read-only
// and owner-gated server-side via `authorize('owner')`; a non-owner session is rejected
// 401/403 and never reaches nginxpilot. Returns cert metadata only — never key material.
// A 502 means the realm's nginxpilot couldn't be reached (or refused the admin token).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    try {
        const client = await realms.clientForActive(authz.session.sub, authz.role)
        return NextResponse.json(await client.listCertificates())
    } catch (err) {
        const { status, code } = realms.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
