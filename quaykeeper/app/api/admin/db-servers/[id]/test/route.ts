// POST /api/admin/db-servers/{id}/test — live reachability/credential probe
// (quaykeeper_database_management.md §8). Returns { ok, error? } and updates the row's
// last_ok_at / last_error either way; a failed probe is a 200 with ok:false, never
// an error status (the health dot needs the payload).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as dbServers from '@/server/services/db-servers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        return NextResponse.json(await dbServers.testServer(actor, id))
    } catch (err) {
        const { status, code, detail } = dbServers.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
