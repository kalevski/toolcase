import { guard, json, error, errorFrom } from '@/server/web/http'
import { status } from '@/server/infrastructure/git'
import { projectExists } from '@/server/infrastructure/fs-workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        return json(await status(params.project))
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        return error('git status failed', 500)
    }
}
