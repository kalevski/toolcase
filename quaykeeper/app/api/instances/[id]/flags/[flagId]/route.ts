// PATCH  /api/instances/{id}/flags/{flagId} — toggle/rename ({ enabled?, description? }).
// DELETE /api/instances/{id}/flags/{flagId} — remove one flag.
//
// Guarded by `authorize('maintainer')`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as flagRepo from '@/server/data/repositories/flag-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; flagId: string }> }

function owned(id: string, flagId: string) {
    const flag = flagRepo.byId(flagId)
    return flag && flag.instanceId === id ? flag : undefined
}

export async function PATCH(req: Request, ctx: Ctx) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { enabled?: unknown; description?: unknown }
    try {
        body = (await req.json()) as { enabled?: unknown; description?: unknown }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id, flagId } = await ctx.params
    const flag = owned(id, flagId)
    if (!flag) return NextResponse.json({ error: 'flag_not_found' }, { status: 404 })

    flagRepo.update(flagId, {
        enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
        description:
            'description' in body ? (typeof body.description === 'string' ? body.description.trim() || null : null) : undefined,
        updatedAt: new Date().toISOString(),
    })
    auditRepo.append({
        githubId: authz.session.sub,
        login: authz.session.login,
        action: 'flag.update',
        detail: `instance:${id} ${flag.key}`,
    })
    return NextResponse.json(flagRepo.byId(flagId))
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id, flagId } = await ctx.params
    const flag = owned(id, flagId)
    if (!flag) return NextResponse.json({ error: 'flag_not_found' }, { status: 404 })

    flagRepo.remove(flagId)
    auditRepo.append({
        githubId: authz.session.sub,
        login: authz.session.login,
        action: 'flag.delete',
        detail: `instance:${id} ${flag.key}`,
    })
    return new NextResponse(null, { status: 204 })
}
