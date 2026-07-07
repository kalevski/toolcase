// GET  /api/db-servers/{id}/databases — live database list (read from the server's
//      catalog, never stored — quaykeeper_database_management.md §3).
// POST /api/db-servers/{id}/databases — create a database ({ name }).
//
// Maintainer+ (§2). Identifier validation, guardrails, probe bookkeeping, and audit
// live in `services/db-manage.ts`; driver failures map to 502.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as dbManage from '@/server/services/db-manage'
import { httpErrorFor } from '@/server/services/db-servers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'databases')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        return NextResponse.json(await dbManage.listDatabases(id))
    } catch (err) {
        const { status, code, detail } = httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}

export async function POST(req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'databases')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { name?: unknown }
    try {
        body = (await req.json()) as { name?: unknown }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const created = await dbManage.createDatabase(actor, id, body.name)
        return NextResponse.json(created, { status: 201 })
    } catch (err) {
        const { status, code, detail } = httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
