// GET  /api/admin/log-destinations — list the reusable destination endpoints
//      (secrets as env/file refs only — safe to serialize) with their usedBy counts.
// POST /api/admin/log-destinations — create an endpoint (JSON DestinationEndpoint
//      body: name/type/url/tenant/TLS/auth). Persist-only — a bare endpoint ships
//      nothing until a realm or instance binds it, so no daemon is touched.
//
// Both guarded by `authorize('owner')` — every destination carries a URL and the
// pipeline egresses log data, so per G21 only the owner creates/edits endpoints.
// Validation, persistence and the audit entry live in `services/log-destinations.ts`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as logDests from '@/server/services/log-destinations'

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
        const value = logDests.create(actor, body)
        return NextResponse.json(value, { status: 201 })
    } catch (err) {
        const { status, code, detail } = logDests.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
