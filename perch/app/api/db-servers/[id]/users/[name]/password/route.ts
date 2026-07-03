// POST /api/db-servers/{id}/users/{name}/password — reset a user's password
// ({ password? }; absent → generated). Same reveal-once rule as create: the
// plaintext appears only in this response, perch stores nothing
// (perch_database_management.md §8). Maintainer+; the admin account is locked.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as dbManage from '@/server/services/db-manage'
import { httpErrorFor } from '@/server/services/db-servers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; name: string }> }

export async function POST(req: Request, ctx: Ctx) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { password?: unknown }
    try {
        body = (await req.json()) as { password?: unknown }
    } catch {
        body = {}
    }

    const { id, name } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const result = await dbManage.resetPassword(actor, id, decodeURIComponent(name), body.password)
        return NextResponse.json(result)
    } catch (err) {
        const { status, code, detail } = httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
