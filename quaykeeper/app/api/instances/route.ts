// GET  /api/instances?tag=<t> — list instances (maintainer+), optionally filtered to one tag.
// POST /api/instances        — create an instance ({ name, description?, tags? }).
//
// Guarded by `authorize('standard', 'instances')` — the Config subsystem sits at the same
// level as Routing (move_wharf_to_perch.md §7).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as instances from '@/server/services/instances'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const authz = await authorize('standard', 'instances')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const tag = new URL(req.url).searchParams.get('tag') ?? undefined
    return NextResponse.json(instances.listInstances(tag))
}

export async function POST(req: Request) {
    const authz = await authorize('standard', 'instances')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: instances.CreateInstanceRequest
    try {
        body = (await req.json()) as instances.CreateInstanceRequest
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const created = instances.createInstance(actor, body)
        return NextResponse.json(created, { status: 201 })
    } catch (err) {
        const { status, code } = instances.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
