// GET /api/base-domains — list the owner-registered subdomain pool for the
// create-site wizard's hostname step (§10, §14). The wizard needs the available
// base domains to build a `{ kind: 'subdomain', label, baseDomain }` payload, but
// the management routes under `/api/admin/base-domains` are owner-only. This is the
// read-only, standard-accessible projection of that same list — guarded by
// `authorize('standard')`; it exposes only what a signed-in user needs to pick a
// subdomain, and never the create/delete management surface.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as admin from '@/server/services/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('standard')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    return NextResponse.json(admin.listBaseDomains())
}
