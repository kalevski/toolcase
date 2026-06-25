// GET /api/admin/users — list every signed-in user (owner roster, §6/§13).
//
// Guarded by `authorize('owner')`. The owner uses this to see who has accounts
// (and their roles) alongside the global site-moderation view. Read-only.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as admin from '@/server/services/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    return NextResponse.json(admin.listUsers())
}
