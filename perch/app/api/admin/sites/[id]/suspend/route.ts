// POST /api/admin/sites/{id}/suspend — suspend any site (owner moderation, §11/§13).
//
// Guarded by `authorize('owner')`. Drops the nginxpilot fragment + reloads so the site
// stops serving and marks it `suspended` (the row is kept — reversible), via the deploy
// service (§727). The moderation entry is audited against the acting owner in the service.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as admin from '@/server/services/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const site = await admin.suspendSite(actor, id)
        return NextResponse.json(site)
    } catch (err) {
        const { status, code } = admin.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
