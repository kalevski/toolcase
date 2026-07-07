// GET /api/base-domains — list the subdomain pool the *caller* may use for the
// create-site wizard's hostname step (§10, §14). The wizard needs the available
// base domains to build a `{ kind: 'subdomain', label, baseDomain }` payload, but
// the management routes under `/api/admin/base-domains` are owner-only. This is the
// read-only, standard-accessible projection of that list — guarded by
// `authorize('standard')`. Every base domain is offered to every user (no audience
// tier). Never exposes the create/delete management surface.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as admin from '@/server/services/admin'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('standard')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    // Scope the wizard's base-domain pool to the caller's active/assigned realm (§E.2).
    try {
        const active = await realms.resolveActiveRealm(authz.session.sub, authz.role)
        return NextResponse.json(admin.listBaseDomainsFor(authz.session.login, active.id))
    } catch (err) {
        const { status, code, detail } = realms.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
