// GET /api/admin/audit — read the append-only audit log (§12), paged for the audit table
// (impl §8): returns `{ entries, total }` where `total` counts every match ignoring paging.
//
// Guarded by `authorize('owner')`. Optional query filters mirror the repository's
// `AuditFilter`: `?login=`, `?site=`, `?action=` (prefix), `?key=` (object key),
// `?limit=` (clamped to 500 in the repo), `?offset=` (offset paging),
// `?order=asc|desc` (id order; default desc).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as admin from '@/server/services/admin'
import type { AuditFilter } from '@/server/data/repositories/audit-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Parse a positive integer query param, or undefined when absent/invalid. */
function intParam(value: string | null): number | undefined {
    if (value === null) return undefined
    const n = Number(value)
    return Number.isInteger(n) && n >= 0 ? n : undefined
}

export async function GET(req: Request) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const q = new URL(req.url).searchParams
    const filter: AuditFilter = {
        login: q.get('login') ?? undefined,
        site: q.get('site') ?? undefined,
        action: q.get('action') ?? undefined,
        key: q.get('key') ?? undefined,
        limit: intParam(q.get('limit')),
        offset: intParam(q.get('offset')),
        order: q.get('order') === 'asc' ? 'asc' : undefined,
    }
    return NextResponse.json({ entries: admin.listAudit(filter), total: admin.countAudit(filter) })
}
