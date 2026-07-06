import { guard, json, error, errorFrom } from '@/server/web/http'
import { engine } from '@/server/services/execution-manager'
import { agentSessions } from '@/server/services/agent-sessions'
import {
    createOrSwitchBranch,
    switchBranch,
    deleteBranch,
    status,
} from '@/server/infrastructure/git'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Branch operations (§6.3):
 * - `{ name }`              → create (or switch to) `name`   (existing behavior)
 * - `{ switchTo }`          → switch to an existing branch
 * - `{ delete, force? }`    → delete a local branch
 */
export async function POST(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    if (engine.isLocked(params.project) || agentSessions.isBusy(params.project)) {
        return error('run in progress', 409)
    }

    const body = (await req.json().catch(() => ({}))) as {
        name?: string
        switchTo?: string
        delete?: string
        force?: boolean
    }

    try {
        if (body.delete) {
            await deleteBranch(params.project, body.delete, body.force === true)
        } else if (body.switchTo) {
            await switchBranch(params.project, body.switchTo)
        } else if (body.name) {
            await createOrSwitchBranch(params.project, body.name)
        } else {
            return error('branch name required', 400)
        }
        return json(await status(params.project))
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}
