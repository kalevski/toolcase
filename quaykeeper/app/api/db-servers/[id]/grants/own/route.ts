// POST /api/db-servers/{id}/grants/own — reassign real catalog ownership of
// every object in { user, database } to `user` (postgres only; the "Take full
// ownership" button, stronger than the Owner access level — see
// services/db-manage.ts `takeOwnership`).
//
// Maintainer+ (quaykeeper_database_management.md §2, §8).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as dbManage from '@/server/services/db-manage'
import { httpErrorFor } from '@/server/services/db-servers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'databases')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { user?: unknown; database?: unknown }
    try {
        body = (await req.json()) as { user?: unknown; database?: unknown }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        return NextResponse.json(await dbManage.takeOwnership(actor, id, body))
    } catch (err) {
        const { status, code, detail } = httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
