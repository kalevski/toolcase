// C4 — custom agent kinds (admin-defined): GET list (standard), POST upsert (admin).

import { guard, json, error, audit } from '@/server/web/http'
import * as agentDefRepo from '@/server/data/repositories/agent-def-repo'
import { listAgentKinds } from '@/server/services/agent-sessions'
import type { AgentDef } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    return json(listAgentKinds())
}

export async function POST(req: Request) {
    const auth = await guard('admin')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as Partial<Omit<AgentDef, 'createdAt'>>
    if (!body.kind || !body.label) return error('kind and label required', 400)
    try {
        const def = agentDefRepo.upsert({
            kind: body.kind,
            label: body.label,
            promptPreamble: body.promptPreamble ?? '',
            target: (body.target as AgentDef['target']) ?? 'project',
            post: body.post ?? 'none',
        })
        audit(auth, 'agent-def.save', null, def.kind)
        return json(def, 201)
    } catch (e) {
        if (e instanceof agentDefRepo.InvalidAgentDefError) return error(e.message, 400)
        throw e
    }
}
