// E2 — list the origin repo's open GitHub issues (import source).

import { guard, json, error, errorFrom } from '@/server/web/http'
import { projectExists } from '@/server/infrastructure/fs-workspace'
import { parseGithubRepo, listOpenIssues } from '@/server/infrastructure/github'
import { readProjectMeta } from '@/server/services/provision'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        const meta = await readProjectMeta(params.project)
        const gh = parseGithubRepo(meta.gitUrl)
        if (!gh) return error('project origin is not a GitHub repository', 400)
        return json(await listOpenIssues(gh.owner, gh.repo))
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}
