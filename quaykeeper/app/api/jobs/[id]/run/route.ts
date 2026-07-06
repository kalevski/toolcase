// POST /api/jobs/{id}/run — run a job's script on the host NOW and return the
// completed run (status + captured stdout/stderr + exit code + duration).
//
// Owner-only. Awaits the run to completion (bounded by the job's timeout) so the
// UI can show the output the moment the request resolves. A 409 means the job is
// already running (the in-process per-job lock).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as jobs from '@/server/services/jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: Request, ctx: Ctx) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const { id } = await ctx.params
    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const run = await jobs.runJob(id, 'manual', actor)
        return NextResponse.json(run, { status: 201 })
    } catch (err) {
        const { status, code, message } = jobs.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}
