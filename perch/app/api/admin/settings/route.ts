// GET /api/admin/settings — read the full effective instance settings (§13).
// PUT /api/admin/settings — replace any subset of settings ({ appName?, tagline?,
//     theme?, brandColor?, ingressIpv4?, ingressIpv6? }). Returns the new effective
//     record. An empty ingress IP clears that override back to the env default.
//
// Both guarded by `authorize('owner')` — a non-owner session is rejected 401/403 and
// never reaches the service. Validation + the audit entry live in `services/settings.ts`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as settings from '@/server/services/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    return NextResponse.json(settings.getSettings())
}

export async function PUT(req: Request) {
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
        const updated = settings.updateSettings(actor, body)
        return NextResponse.json(updated)
    } catch (err) {
        const { status, code } = settings.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
