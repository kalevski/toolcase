// C3 — workspace search over tasks / knowledge / notes (FTS5).

import { guard, json, error, errorFrom } from '@/server/web/http'
import { projectExists } from '@/server/infrastructure/fs-workspace'
import * as searchRepo from '@/server/data/repositories/search-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
        if (!q) return json({ available: searchRepo.searchAvailable(), hits: [] })
        return json({
            available: searchRepo.searchAvailable(),
            hits: searchRepo.search(params.project, q),
        })
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}
