import { guard, json, error } from '@/server/web/http'
import { engine } from '@/server/services/execution-manager'
import { agentSessions } from '@/server/services/agent-sessions'
import { stageAll, stagedDiff, commitAll, GitError } from '@/server/infrastructure/git'
import { aiCommitMessage } from '@/server/services/commit-message'
import { projectExists, UnsafePathError } from '@/server/infrastructure/fs-workspace'
import { config } from '@/server/config'
import { slog } from '@/server/infrastructure/server-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// The AI message mode spawns the agent once (60s cap inside aiCommitMessage).
export const maxDuration = 120

/** §6.2 — manual commit of the whole working tree, with optional AI message. */
export async function POST(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        if (engine.isLocked(params.project) || agentSessions.isBusy(params.project)) {
            return error('run in progress', 409)
        }

        const body = (await req.json().catch(() => ({}))) as {
            message?: string
            mode?: 'manual' | 'ai'
            model?: string
        }
        const mode = body.mode === 'ai' ? 'ai' : 'manual'

        await stageAll(params.project)
        const diff = await stagedDiff(params.project)
        if (!diff.trim()) return error('nothing to commit — working tree is clean', 400)

        let message: string
        if (mode === 'manual') {
            if (!body.message || !body.message.trim()) return error('message required', 400)
            message = body.message.trim()
        } else {
            const model = body.model || config.commitModel
            if (!config.modelCatalog.includes(model)) return error(`model not in catalog: ${model}`, 400)
            const ai = await aiCommitMessage(params.project, diff, model)
            if (!ai) return error('AI commit-message generation failed — write one manually', 502)
            message = ai
        }

        const sha = await commitAll(params.project, message)
        if (!sha) return error('nothing to commit — working tree is clean', 400)
        slog('info', 'api', 'manual commit', { project: params.project, sha, mode, by: auth.session.login })
        return json({ sha, message })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        if (e instanceof GitError) return error(e.message, 400)
        throw e
    }
}
