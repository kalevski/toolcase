import { guard, json, error, audit, errorFrom } from '@/server/web/http'
import { engine } from '@/server/services/execution-manager'
import { agentSessions } from '@/server/services/agent-sessions'
import { push, status } from '@/server/infrastructure/git'
import { canPush } from '@/server/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    if (!canPush()) return error('no push credential configured', 412)
    if (engine.isLocked(params.project) || agentSessions.isBusy(params.project)) {
        return error('run in progress', 409)
    }

    try {
        await push(params.project)
        audit(auth, 'git.push', params.project)
        return json(await status(params.project))
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}
