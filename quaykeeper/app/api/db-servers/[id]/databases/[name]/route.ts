// DELETE /api/db-servers/{id}/databases/{name} — drop a database
// (quaykeeper_database_management.md §8). Maintainer+; the UI gates this behind a
// type-the-name confirmation, the API behind identifier validation (system
// databases are unnameable targets) and the audit trail.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as dbManage from '@/server/services/db-manage'
import { httpErrorFor } from '@/server/services/db-servers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; name: string }> }

export async function DELETE(_req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'databases')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id, name } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        await dbManage.dropDatabase(actor, id, decodeURIComponent(name))
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code, detail } = httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
