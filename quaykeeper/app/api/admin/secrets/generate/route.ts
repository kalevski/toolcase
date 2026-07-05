// POST /api/admin/secrets/generate — generate + store a secret
// ({ key, kind, length?, charset?, description? }). The generated value is
// never returned — reveal it afterwards via the audited reveal endpoint.
//
// Owner-only (`authorize('owner')`).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as configGlobals from '@/server/services/config-globals'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: configGlobals.GenerateSecretRequest
    try {
        body = (await req.json()) as configGlobals.GenerateSecretRequest
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const created = configGlobals.generateSecretValue(actor, body)
        return NextResponse.json(created, { status: 201 })
    } catch (err) {
        const { status, code } = configGlobals.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
