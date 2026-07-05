// PATCH  /api/admin/db-servers/{id} — edit any subset of { name, host, port, tls,
//        adminUser, adminPassword }; an absent/empty password keeps the stored one.
//        `kind` is immutable (re-register for a different engine).
// DELETE /api/admin/db-servers/{id} — remove the registry row (the server itself is
//        untouched).
//
// Both guarded by `authorize('owner')` (quaykeeper_database_management.md §2). Validation +
// audit live in `services/db-servers.ts`; the credential is write-only.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as dbServers from '@/server/services/db-servers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: Record<string, unknown>
    try {
        body = (await req.json()) as Record<string, unknown>
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        return NextResponse.json(dbServers.updateServer(actor, id, body))
    } catch (err) {
        const { status, code, detail } = dbServers.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        dbServers.removeServer(actor, id)
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code, detail } = dbServers.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
