// GET /api/admin/users/{id}/realms — list a user's realm grants (with their default marked).
// PUT /api/admin/users/{id}/realms — replace the whole grant set + default
//     ({ realmIds: string[], defaultRealmId?: string | null }).
//
// Both guarded by `authorize('owner')` (multiple_realms.md §F.2). Validation, the
// "default must be granted" rule, the block-if-the-user-owns-sites-there guard (§10.3),
// and the audit entry all live in `services/realms.ts`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** Parse the `{id}` path segment to the integer github id, or `null` if malformed. */
function parseId(id: string): number | null {
    const n = Number(id)
    return Number.isInteger(n) ? n : null
}

export async function GET(_req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    const githubId = parseId(id)
    if (githubId === null) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })

    return NextResponse.json(realms.listUserRealms(githubId))
}

export async function PUT(req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { realmIds?: unknown; defaultRealmId?: unknown }
    try {
        body = (await req.json()) as { realmIds?: unknown; defaultRealmId?: unknown }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id } = await ctx.params
    const githubId = parseId(id)
    if (githubId === null) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })

    if (!Array.isArray(body.realmIds) || body.realmIds.some((r) => typeof r !== 'string')) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
    }
    const defaultRealmId = typeof body.defaultRealmId === 'string' ? body.defaultRealmId : null

    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const grants = realms.replaceUserRealms(
            actor,
            githubId,
            body.realmIds as string[],
            defaultRealmId,
        )
        return NextResponse.json(grants)
    } catch (err) {
        const { status, code } = realms.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
