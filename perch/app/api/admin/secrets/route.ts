// GET  /api/admin/secrets — keys-only SecretMeta[] (values never listed).
//      Maintainer+: matches wharf's developer role, which could reference a
//      secret by key without ever seeing its value (§7).
// POST /api/admin/secrets — create one ({ key, value, description? }); owner-only.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as configGlobals from '@/server/services/config-globals'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })
    return NextResponse.json(configGlobals.listSecrets())
}

export async function POST(req: Request) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { key?: string; value?: string; description?: string }
    try {
        body = (await req.json()) as { key?: string; value?: string; description?: string }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const created = configGlobals.createSecret(actor, {
            key: body.key ?? '',
            value: body.value ?? '',
            description: body.description,
        })
        return NextResponse.json(created, { status: 201 })
    } catch (err) {
        const { status, code } = configGlobals.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
