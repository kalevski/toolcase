// POST /api/instances/{id}/clone — deep-copy an instance ({ name }): tags,
// vars (references shared), flags. The fetch key is never copied. Guarded by
// `authorize('standard', 'instances')`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as instances from '@/server/services/instances'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'instances')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { name?: unknown }
    try {
        body = (await req.json()) as { name?: unknown }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }
    if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json({ error: 'invalid_name' }, { status: 400 })
    }

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const cloned = instances.cloneInstance(actor, id, body.name)
        return NextResponse.json(cloned, { status: 201 })
    } catch (err) {
        const { status, code } = instances.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
