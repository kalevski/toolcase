// GET  /api/admin/log-destinations — list configured log-shipping destinations
//      (secrets as env/file refs only — safe to serialize).
// POST /api/admin/log-destinations — create a destination (JSON LogDestination body,
//      plus optional { scope, target }).
//
// Both guarded by `authorize('owner')` — every destination carries a URL and the
// pipeline egresses log data, so per G21 only the owner creates/edits. Validation,
// persistence, the daemon push (global scope) and the audit entry live in
// `services/log-destinations.ts`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as logDests from '@/server/services/log-destinations'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    return NextResponse.json(logDests.list())
}

export async function POST(req: Request) {
    const authz = await authorize('owner')
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
        const { value, warnings } = await logDests.create(client, actor, body)
        return NextResponse.json({ ...value, warnings }, { status: 201 })
    } catch (err) {
        const { status, code, detail } = logDests.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
