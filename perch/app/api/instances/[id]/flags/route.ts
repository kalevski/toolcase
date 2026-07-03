// GET  /api/instances/{id}/flags — list boolean flags.
// POST /api/instances/{id}/flags — create one ({ key, enabled?, description? }).
//
// Guarded by `authorize('maintainer')`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as flagRepo from '@/server/data/repositories/flag-repo'
import * as instanceRepo from '@/server/data/repositories/instance-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import { ID } from '@/server/infrastructure/ids'
import { isValidKey } from '@/server/domain/config-input'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    if (!instanceRepo.byId(id)) return NextResponse.json({ error: 'instance_not_found' }, { status: 404 })
    return NextResponse.json(flagRepo.listByInstance(id))
}

export async function POST(req: Request, ctx: Ctx) {
    const authz = await authorize('maintainer')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: { key?: unknown; enabled?: unknown; description?: unknown }
    try {
        body = (await req.json()) as { key?: unknown; enabled?: unknown; description?: unknown }
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id } = await ctx.params
    if (!instanceRepo.byId(id)) return NextResponse.json({ error: 'instance_not_found' }, { status: 404 })

    const key = typeof body.key === 'string' ? body.key.trim() : ''
    if (!isValidKey(key)) return NextResponse.json({ error: 'invalid_key' }, { status: 400 })
    if (flagRepo.byInstanceAndKey(id, key)) {
        return NextResponse.json({ error: 'key_taken' }, { status: 409 })
    }

    const now = new Date().toISOString()
    const flagId = ID.flag()
    flagRepo.insert({
        id: flagId,
        instanceId: id,
        key,
        enabled: body.enabled === true,
        description: typeof body.description === 'string' ? body.description.trim() || undefined : undefined,
        createdAt: now,
        updatedAt: now,
    })
    auditRepo.append({
        githubId: authz.session.sub,
        login: authz.session.login,
        action: 'flag.create',
        detail: `instance:${id} ${key}`,
    })
    return NextResponse.json(flagRepo.byId(flagId), { status: 201 })
}
