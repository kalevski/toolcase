// PUT /api/routing/access-lists/{name}/users/{username} — (re)set one basic-auth
// user's password (C1). The plaintext travels this one path only: browser →
// Quaykeeper → daemon, where it is hashed (apr1) server-side into the list's
// fragment. Never logged, never audited beyond "password set for user X",
// never readable back. Guarded by `authorize('standard', 'routing')`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as routing from '@/server/services/routing'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PUT(req: Request, ctx: { params: Promise<{ name: string; username: string }> }) {
    const authz = await authorize('standard', 'routing')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { password?: unknown }
    try {
        body = (await req.json()) as typeof body
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    try {
        const { name, username } = await ctx.params
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const client = await realms.clientForActive(authz.session.sub, authz.role)
        await routing.setAccessListPassword(client, actor, name, username, body.password)
        return NextResponse.json({ status: 'updated' })
    } catch (err) {
        const { status, code, detail } = routing.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
