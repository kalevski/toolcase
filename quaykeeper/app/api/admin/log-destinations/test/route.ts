// POST /api/admin/log-destinations/test — test a CANDIDATE destination before saving
//      (body-based, G11): validate it, push one synthetic entry through the active
//      realm's daemon, and report the outcome. Nothing is persisted.
//
// Guarded by `authorize('owner')` — this fires arbitrary outbound HTTP from the edge
// host (SSRF surface), so it is owner-only exactly like create/edit (G21).
//
// Response: `{ ok: true }` on delivery, `{ ok: false, error }` when the destination
// rejected/was unreachable (mapped to 200 with the flag so the form can show it), or a
// 400 `{ error, detail }` when the candidate failed validation.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as logDests from '@/server/services/log-destinations'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
        const client = await realms.clientForActive(authz.session.sub, authz.role)
        return NextResponse.json(await logDests.test(client, body))
    } catch (err) {
        const { status, code, detail } = logDests.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
