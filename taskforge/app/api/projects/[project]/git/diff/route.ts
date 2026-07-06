import { guard, json, error, errorFrom } from '@/server/web/http'
import { fileDiff } from '@/server/infrastructure/git'
import { projectExists } from '@/server/infrastructure/fs-workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Before (HEAD) / after (working tree) content of one repo file, for DiffViewer. */
export async function GET(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const path = new URL(req.url).searchParams.get('path')
    if (!path) return error('path required', 400)
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        return json(await fileDiff(params.project, path))
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}
