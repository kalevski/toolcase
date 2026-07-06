// GET  /api/admin/db-servers — list the registered database servers (masked, no credential).
// POST /api/admin/db-servers — register a server ({ name, kind, host, port?, tls?, adminUser,
//      adminPassword }).
//
// Both guarded by `authorize('owner')` — only the owner connects servers
// (quaykeeper_database_management.md §2). Validation, credential encryption, and the audit
// entry live in `services/db-servers.ts`. The password is write-only: it never comes
// back in any response.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as dbServers from '@/server/services/db-servers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    return NextResponse.json(dbServers.listServers())
}

export async function POST(req: Request) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: Record<string, unknown>
    try {
        body = (await req.json()) as Record<string, unknown>
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const created = dbServers.createServer(actor, body)
        return NextResponse.json(created, { status: 201 })
    } catch (err) {
        const { status, code, detail } = dbServers.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
