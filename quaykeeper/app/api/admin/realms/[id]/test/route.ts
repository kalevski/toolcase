// POST /api/admin/realms/{id}/test — live-check a realm's URL + credentials
// (multiple_realms.md §C.1). Hits the instance's `healthz` + `status`; the service folds
// any unreachable/auth failure into `{ ok: false, error }` so the UI's health dot can
// render it. Owner-only (`authorize('owner')`).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as realms from '@/server/services/realms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        return NextResponse.json(await realms.testRealm(id))
    } catch (err) {
        const { status, code, detail } = realms.httpErrorFor(err)
        return NextResponse.json({ error: code, detail }, { status })
    }
}
