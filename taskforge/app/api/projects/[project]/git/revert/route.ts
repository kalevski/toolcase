import { guard, json, error, errorFrom } from '@/server/web/http'
import { engine } from '@/server/services/execution-manager'
import { agentSessions } from '@/server/services/agent-sessions'
import { revertCommit, status } from '@/server/infrastructure/git'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    if (engine.isLocked(params.project) || agentSessions.isBusy(params.project)) {
        return error('run in progress', 409)
    }

    const body = (await req.json().catch(() => ({}))) as { sha?: string }
    if (!body.sha) return error('sha required', 400)

    try {
        await revertCommit(params.project, body.sha)
        return json(await status(params.project))
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}
