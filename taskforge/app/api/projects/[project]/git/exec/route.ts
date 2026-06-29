import { guard, json, error, audit } from '@/server/web/http'
import { engine } from '@/server/services/execution-manager'
import { agentSessions } from '@/server/services/agent-sessions'
import { execTerminal, tokenizeCommand, GitError } from '@/server/infrastructure/git'
import { UnsafePathError } from '@/server/infrastructure/fs-workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COMMAND_MAX = 2000

/**
 * SEC-2 — git config can run arbitrary programs (aliases, core.pager,
 * core.sshCommand, core.fsmonitor, …). Even with no shell and GIT_PAGER/EDITOR
 * neutralized, `git -c alias.x='!sh -c id' x` or `git config core.pager '!cmd'`
 * is container-level RCE. Reject any `-c`/`--config` override token and the
 * `config` subcommand so the terminal can't reconfigure git mid-invocation.
 */
function rejectConfigOverrides(argv: string[]): string | null {
    for (const tok of argv) {
        // a leading `git` is stripped by execTerminal, but be defensive here too.
        if (tok === 'git') continue
        if (tok === '-c' || tok === '--config' || tok.startsWith('-c')) {
            return 'git -c/--config overrides are not permitted'
        }
        // first non-flag token is the subcommand; an alias-style `!…` config
        // value would have been caught above. Bare `config` lets a user persist
        // an alias/pager, so reject it outright.
        if (!tok.startsWith('-')) {
            if (tok === 'config') return 'git config is not permitted'
            break
        }
    }
    return null
}

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

    // SEC-2 — reject config-override / alias invocations before spawning git.
    let argv: string[]
    try {
        argv = tokenizeCommand(command)
    } catch (e) {
        if (e instanceof GitError) return error(e.message, 400)
        throw e
    }
    const rejection = rejectConfigOverrides(argv)
    if (rejection) return error(rejection, 400)

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
