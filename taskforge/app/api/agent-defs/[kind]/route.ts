import { guard, json, error, audit } from '@/server/web/http'
import * as agentDefRepo from '@/server/data/repositories/agent-def-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, ctx: { params: Promise<{ kind: string }> }) {
    const params = await ctx.params
    const auth = await guard('admin')
    if ('res' in auth) return auth.res
    if (!agentDefRepo.get(params.kind)) return error('unknown agent kind', 404)
    agentDefRepo.remove(params.kind)
    audit(auth, 'agent-def.delete', null, params.kind)
    return json({ ok: true })
}
