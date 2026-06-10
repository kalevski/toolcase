import { guard, json, error, audit } from '@/server/web/http'
import { agentSessions, listAgentKinds } from '@/server/services/agent-sessions'
import { UnsafePathError } from '@/server/infrastructure/fs-workspace'
import type { AgentKind } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: { project: string; agent: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    if (!listAgentKinds().some((k) => k.kind === params.agent)) return error('unknown agent', 400)
    try {
        const snap = agentSessions.stop(params.project, params.agent as AgentKind)
        audit(auth, 'agent.stop', params.project, params.agent)
        return json(snap)
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
