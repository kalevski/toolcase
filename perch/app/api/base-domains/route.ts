// GET /api/base-domains — list the subdomain pool the *caller* may use for the
// create-site wizard's hostname step (§10, §14). The wizard needs the available
// base domains to build a `{ kind: 'subdomain', label, baseDomain }` payload, but
// the management routes under `/api/admin/base-domains` are owner-only. This is the
// read-only, standard-accessible projection of that list — guarded by
// `authorize('standard')` and filtered to the caller's audience tier: a free-plan
// user sees only `free` domains, a paid user `free` + `paid`, and a maintainer/owner
// every tier (§10). Never exposes the create/delete management surface.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as admin from '@/server/services/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('standard')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    return NextResponse.json(admin.listBaseDomainsFor(authz.session.login))
}
