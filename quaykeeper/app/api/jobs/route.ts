// GET  /api/jobs — list scheduled jobs (owner).
// POST /api/jobs — create a job ({ name, description?, kind, script, schedule?, enabled?, timeoutSec? }).
//
// Owner-only: a job runs arbitrary code on the host, so this sits at the highest
// role (unlike the maintainer-gated snippets).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as jobs from '@/server/services/jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    return NextResponse.json(jobs.listJobs())
}

export async function POST(req: Request) {
    const authz = await authorize('owner')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    let body: jobs.CreateJobRequest
    try {
        body = (await req.json()) as jobs.CreateJobRequest
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    try {
        const actor = { githubId: authz.session.sub, login: authz.session.login }
        const created = jobs.createJob(actor, body)
        return NextResponse.json(created, { status: 201 })
    } catch (err) {
        const { status, code, message } = jobs.httpErrorFor(err)
        return NextResponse.json({ error: code, message }, { status })
    }
}
