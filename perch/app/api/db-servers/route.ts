// GET /api/db-servers — the registered database servers for the management pages
// (perch_database_management.md §8). Maintainer+; the DTO is already masked (no
// credential), so the same shape the owner sees is safe here.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as dbServers from '@/server/services/db-servers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    return NextResponse.json(dbServers.listServers())
}
