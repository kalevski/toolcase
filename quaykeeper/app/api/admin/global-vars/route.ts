// GET  /api/admin/global-vars — list the global-variable pool. Maintainer+: a
//      global var is plaintext by design (never a secret), and maintainers
//      need to see the pool to reference one when creating an env var (§10).
// POST /api/admin/global-vars — create one ({ key, value, description? }); owner-only.
//
// move_wharf_to_perch.md §7.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as configGlobals from '@/server/services/config-globals'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })
    return NextResponse.json(configGlobals.listGlobalVars())
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
        const created = configGlobals.createGlobalVar(actor, {
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
