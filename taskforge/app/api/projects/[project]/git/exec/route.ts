import { guard, json, error, audit } from '@/server/web/http'
import { engine } from '@/server/services/execution-manager'
import { agentSessions } from '@/server/services/agent-sessions'
import { execTerminal, GitError } from '@/server/infrastructure/git'
import { UnsafePathError } from '@/server/infrastructure/fs-workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COMMAND_MAX = 2000

/** Git-page terminal: run one user-typed git command inside the repo checkout. */
export async function POST(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    // the command may touch the working tree or refs — never while a run/agent is active.
    if (engine.isLocked(params.project) || agentSessions.isBusy(params.project)) {
        return error('run in progress', 409)
    }

    const body = (await req.json().catch(() => ({}))) as { command?: string }
    const command = typeof body.command === 'string' ? body.command.trim() : ''
    if (!command) return error('command required', 400)
    if (command.length > COMMAND_MAX) return error('command too long', 400)

    try {
        const result = await execTerminal(params.project, command)
        audit(auth, 'git.terminal', params.project, command.slice(0, 200))
        return json(result)
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        if (e instanceof GitError) return error(e.message, 400)
        throw e
    }
}
