import { guard, json, error } from '@/server/web/http'
import { fileDiff, GitError } from '@/server/infrastructure/git'
import { projectExists, UnsafePathError } from '@/server/infrastructure/fs-workspace'

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
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        if (e instanceof GitError) return error(e.message, 400)
        throw e
    }
}
