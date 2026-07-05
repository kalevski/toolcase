// GET /api/instances/{id}/config — the resolved config (masked unless owner)
// plus per-key `pending` flags. Guarded by `authorize('maintainer')`; real
// secret values only for the owner role (§7).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as configVars from '@/server/services/config-vars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        const canReadSecrets = authz.role === 'owner'
        return NextResponse.json(configVars.resolveInstance(id, canReadSecrets))
    } catch (err) {
        const { status, code } = configVars.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
