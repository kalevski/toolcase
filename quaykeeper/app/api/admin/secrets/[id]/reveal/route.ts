// GET /api/admin/secrets/{id}/reveal — the decrypted value, audited. Owner-only
// (`authorize('owner')`).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as configGlobals from '@/server/services/config-globals'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        return NextResponse.json(configGlobals.revealSecret(actor, id))
    } catch (err) {
        const { status, code } = configGlobals.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
