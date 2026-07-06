import { guard, json, error, errorFrom } from '@/server/web/http'
import { engine } from '@/server/services/execution-manager'
import { agentSessions } from '@/server/services/agent-sessions'
import {
    fetchRemote,
    pull,
    discardAll,
    stashPush,
    stashPop,
    stashDrop,
    status,
} from '@/server/infrastructure/git'
import type { GitOp } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface OpBody {
    op?: string
    /** stash-pop / stash-drop */
    index?: number
    /** stash-push */
    message?: string
}

const OPS: Record<GitOp, (project: string, body: OpBody) => Promise<void>> = {
    fetch: (p) => fetchRemote(p),
    pull: (p) => pull(p),
    discard: (p) => discardAll(p),
    'stash-push': (p, b) => stashPush(p, b.message),
    'stash-pop': (p, b) => stashPop(p, typeof b.index === 'number' ? b.index : 0),
    'stash-drop': (p, b) => stashDrop(p, typeof b.index === 'number' ? b.index : 0),
}

export async function POST(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    // every op touches the working tree or refs — never while a run/agent is active.
    if (engine.isLocked(params.project) || agentSessions.isBusy(params.project)) {
        return error('run in progress', 409)
    }

    const body = (await req.json().catch(() => ({}))) as OpBody
    const op = body.op as GitOp | undefined
    if (!op || !(op in OPS)) return error('unknown git op', 400)

    try {
        await OPS[op](params.project, body)
        return json(await status(params.project))
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}
