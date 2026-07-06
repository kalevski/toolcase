// B1 — run history list for a project.

import { guard, json, error, errorFrom } from '@/server/web/http'
import { projectExists } from '@/server/infrastructure/fs-workspace'
import * as runRepo from '@/server/data/repositories/run-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        const limit = Number(new URL(req.url).searchParams.get('limit')) || 50
        return json(runRepo.list(params.project, Math.min(limit, 200)))
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}
