// D1 — telemetry aggregates for the Overview dashboard.

import { guard, json, error } from '@/server/web/http'
import { projectExists, UnsafePathError } from '@/server/infrastructure/fs-workspace'
import * as telemetryRepo from '@/server/data/repositories/telemetry-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        const days = Number(new URL(req.url).searchParams.get('days')) || 30
        return json(telemetryRepo.summary(params.project, Math.min(Math.max(days, 1), 365)))
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
