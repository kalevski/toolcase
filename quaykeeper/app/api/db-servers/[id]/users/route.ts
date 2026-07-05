// GET  /api/db-servers/{id}/users — live user list (catalog read, §3).
// POST /api/db-servers/{id}/users — create a user ({ name, password? }). No password
//      → one is generated (secret-gen); the response carries the plaintext exactly
//      ONCE and quaykeeper keeps no copy (quaykeeper_database_management.md §8).
//
// Maintainer+ (§2). Guardrails + audit in `services/db-manage.ts`.

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
        return NextResponse.json(await dbManage.listUsers(id))
    } catch (err) {
        const { status, code, detail } = httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}

export async function POST(req: Request, ctx: Ctx) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { name?: unknown; password?: unknown }
    try {
        body = (await req.json()) as { name?: unknown; password?: unknown }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const created = await dbManage.createUser(actor, id, body)
        return NextResponse.json(created, { status: 201 })
    } catch (err) {
        const { status, code, detail } = httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
