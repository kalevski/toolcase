// GET /api/db-servers/{id}/grants — the full access matrix in one round trip:
//     { databases, users, grants } (users minus the locked admin/superusers, §10).
// PUT /api/db-servers/{id}/grants — set one cell: { user, database, level } where
//     level ∈ none | read | readwrite | owner, OR { user, database, operations }
//     where operations ⊆ DB_OPERATIONS (the detailed editor). Applying either is
//     a full reset+grant, so it is idempotent and overwrites `custom` only
//     explicitly (§3).
//
// Maintainer+ (quaykeeper_database_management.md §2, §8).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as dbManage from '@/server/services/db-manage'
import { httpErrorFor } from '@/server/services/db-servers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        return NextResponse.json(await dbManage.grantMatrix(id))
    } catch (err) {
        const { status, code, detail } = httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}

export async function PUT(req: Request, ctx: Ctx) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { user?: unknown; database?: unknown; level?: unknown; operations?: unknown }
    try {
        body = (await req.json()) as {
            user?: unknown
            database?: unknown
            level?: unknown
            operations?: unknown
        }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        return NextResponse.json(await dbManage.setAccess(actor, id, body))
    } catch (err) {
        const { status, code, detail } = httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
