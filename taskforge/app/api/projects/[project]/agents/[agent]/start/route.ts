import { guard, json, error, audit } from '@/server/web/http'
import { agentSessions, AgentBusyError, UnknownAgentError, listAgentKinds } from '@/server/services/agent-sessions'
import { projectExists, UnsafePathError } from '@/server/infrastructure/fs-workspace'
import { config } from '@/server/config'
import { slog } from '@/server/infrastructure/server-log'
import type { AgentKind } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ project: string; agent: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res

    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        // C4 — bundled kinds + admin-defined custom kinds are startable.
        if (!listAgentKinds().some((k) => k.kind === params.agent)) return error('unknown agent', 400)
        const agent = params.agent as AgentKind

        const body = (await req.json().catch(() => ({}))) as {
            prompt?: string
            model?: string
            targetNote?: string
        }
        if (!body.prompt || !body.prompt.trim()) return error('prompt required', 400)

        const model = body.model || config.defaultModel
        if (!config.modelCatalog.includes(model)) return error(`model not in catalog: ${model}`, 400)

        const targetNote = typeof body.targetNote === 'string' && body.targetNote ? body.targetNote : undefined
        if (targetNote && agent !== 'note-writer') return error('targetNote is note-writer only', 400)

        slog('info', 'api', `POST agents/${agent}/start`, {
            project: params.project,
            model,
            by: auth.session.login,
        })
        const snapshot = await agentSessions.start(params.project, agent, body.prompt.trim(), model, {
            targetNote,
        })
        audit(auth, 'agent.start', params.project, agent)
        // 202: accepted — output arrives via the project SSE stream.
        return json(snapshot, 202)
    } catch (e) {
        if (e instanceof AgentBusyError) return error(e.message, 409)
        if (e instanceof UnknownAgentError) return error('unknown agent', 400)
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
