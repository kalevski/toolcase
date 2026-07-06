// GET /api/admin/sites — list every site (global owner moderation view, §13).
//
// Guarded by `authorize('owner')`. Unlike `GET /api/sites` (which scopes to the
// caller's own sites), this returns all tenants' sites for moderation.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as admin from '@/server/services/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    return NextResponse.json(admin.listAllSites())
}
