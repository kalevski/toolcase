// GET  /api/admin/realms — list the registered nginxpilot instances (masked, no token).
// POST /api/admin/realms — register a realm ({ name, adminUrl, token? }).
//
// Both guarded by `authorize('owner')` — only the owner manages realms (§0.6). Validation
// (URL/SSRF), token encryption, and the audit entry live in `services/realms.ts`. The
// token is write-only: it never comes back in any response (only `hasToken`).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    return NextResponse.json(realms.listRealms())
}

export async function POST(req: Request) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { name?: unknown; adminUrl?: unknown; token?: unknown }
    try {
        body = (await req.json()) as { name?: unknown; adminUrl?: unknown; token?: unknown }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const created = realms.createRealm(actor, body)
        return NextResponse.json(created, { status: 201 })
    } catch (err) {
        const { status, code } = realms.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
