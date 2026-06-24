// E2 — list the origin repo's open GitHub issues (import source).

import { guard, json, error } from '@/server/web/http'
import { projectExists, UnsafePathError } from '@/server/infrastructure/fs-workspace'
import { parseGithubRepo, listOpenIssues, GithubError } from '@/server/infrastructure/github'
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
        if (e instanceof GithubError) return error(e.message, e.status === 401 || e.status === 403 ? 502 : 502)
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
