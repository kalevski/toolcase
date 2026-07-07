// GET    /api/routing/access-lists — list every configured access list (hashes masked).
// POST   /api/routing/access-lists — create/replace an access list (JSON AccessList body).
// DELETE /api/routing/access-lists?name=<name> — remove one (409 while referenced).
//
// Guarded by `authorize('standard', 'routing')` — owners and maintainers, never a standard
// user. Every op runs against the caller's ACTIVE realm (multiple_realms.md §E.2).
// Passwords NEVER ride these endpoints — the dedicated
// PUT /api/routing/access-lists/{name}/users/{username} sets them.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as routing from '@/server/services/routing'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('standard', 'routing')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    try {
        const client = await realms.clientForActive(authz.session.sub, authz.role)
        return NextResponse.json(await routing.listAccessLists(client))
    } catch (err) {
        const { status, code, detail } = routing.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}

export async function POST(req: Request) {
    const authz = await authorize('standard', 'routing')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const client = await realms.clientForActive(authz.session.sub, authz.role)
        const { value, warnings } = await routing.createAccessList(client, actor, body)
        return NextResponse.json({ ...value, warnings }, { status: 201 })
    } catch (err) {
        const { status, code, detail } = routing.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}

export async function DELETE(req: Request) {
    const authz = await authorize('standard', 'routing')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const name = new URL(req.url).searchParams.get('name') ?? undefined
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const client = await realms.clientForActive(authz.session.sub, authz.role)
        await routing.deleteAccessList(client, actor, name)
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code, detail } = routing.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
