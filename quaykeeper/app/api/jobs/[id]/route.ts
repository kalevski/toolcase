// GET    /api/jobs/{id} — read one job plus its recent run history ({ job, runs }).
// PATCH  /api/jobs/{id} — update fields (name/description/kind/script/schedule/enabled/timeoutSec).
// DELETE /api/jobs/{id} — delete a job (its runs cascade).
//
// All owner-only. A bare `{ enabled }` PATCH is the list's quick toggle.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as jobs from '@/server/services/jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        return NextResponse.json(jobs.getJobWithRuns(id))
    } catch (err) {
        const { status, code, message } = jobs.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}

export async function PATCH(req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: jobs.UpdateJobRequest & { enabled?: unknown }
    try {
        body = (await req.json()) as jobs.UpdateJobRequest
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const { id } = await ctx.params
    const actor = { githubId: authz.session.sub, login: authz.session.login }
    try {
        // A lone `{ enabled }` body is the list's quick switch — a full re-validate
        // would reject it (no name/kind/script), so route it to the dedicated toggle.
        const keys = Object.keys(body)
        if (keys.length === 1 && keys[0] === 'enabled') {
            return NextResponse.json(jobs.setEnabled(actor, id, Boolean(body.enabled)))
        }
        return NextResponse.json(jobs.updateJob(actor, id, body))
    } catch (err) {
        const { status, code, message } = jobs.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        jobs.deleteJob(actor, id)
        return new NextResponse(null, { status: 204 })
    } catch (err) {
        const { status, code, message } = jobs.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}
