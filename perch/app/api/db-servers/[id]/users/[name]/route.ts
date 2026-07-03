// DELETE /api/db-servers/{id}/users/{name} — drop a user
// (perch_database_management.md §8). Maintainer+. The registry admin account and
// superusers are locked (409) in `services/db-manage.ts`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as dbManage from '@/server/services/db-manage'
import { httpErrorFor } from '@/server/services/db-servers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; name: string }> }

export async function DELETE(_req: Request, ctx: Ctx) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id, name } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        await dbManage.dropUser(actor, id, decodeURIComponent(name))
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code, detail } = httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
