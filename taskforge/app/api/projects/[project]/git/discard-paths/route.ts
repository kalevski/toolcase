import { guard, json, error, errorFrom } from '@/server/web/http'
import { engine } from '@/server/services/execution-manager'
import { agentSessions } from '@/server/services/agent-sessions'
import { discardPaths, status } from '@/server/infrastructure/git'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Per-file discard (§6.4): restore tracked paths, delete untracked ones. Destructive. */
export async function POST(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    if (engine.isLocked(params.project) || agentSessions.isBusy(params.project)) {
        return error('run in progress', 409)
    }

    const body = (await req.json().catch(() => ({}))) as { paths?: string[] }
    const paths = Array.isArray(body.paths)
        ? body.paths.filter((p): p is string => typeof p === 'string' && p.length > 0)
        : []
    if (paths.length === 0) return error('paths required', 400)

    try {
        await discardPaths(params.project, paths)
        return json(await status(params.project))
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}
