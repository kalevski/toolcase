import { guard, json, error, errorFrom } from '@/server/web/http'
import { unpushedCommits, recentCommits } from '@/server/infrastructure/git'
import { projectExists } from '@/server/infrastructure/fs-workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        const rawLimit = Number(new URL(req.url).searchParams.get('limit'))
        const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 15
        const [unpushed, recent] = await Promise.all([
            unpushedCommits(params.project),
            recentCommits(params.project, limit),
        ])
        return json({ unpushed, recent })
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        return error('git log failed', 500)
    }
}
