// GET   /api/admin/users — enriched owner roster: each user + plan, level, usage,
//                          effective limits, and any custom override (§6/§13).
// PATCH /api/admin/users — change a user's role ({ githubId, role }).
//
// Both guarded by `authorize('owner')`. The owner uses GET to see who has accounts
// (their roles, levels, usage, and limits) alongside the global site-moderation
// view, and PATCH to grant `maintainer` (routing access + quota exemption, no admin)
// or `owner`, or to drop back to `standard`. The last owner can't be demoted (409,
// enforced in the service). Per-user limit overrides live at `…/{id}/limits`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as admin from '@/server/services/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    return NextResponse.json(admin.listUsersDetailed())
}

export async function PATCH(req: Request) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { githubId?: unknown; role?: unknown }
    try {
        body = (await req.json()) as { githubId?: unknown; role?: unknown }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const user = admin.setUserRole(actor, body.githubId, body.role)
        return NextResponse.json(user)
    } catch (err) {
        const { status, code } = admin.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
