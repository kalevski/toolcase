import { guard, json, error } from '@/server/web/http'
import { projectExists, UnsafePathError } from '@/server/infrastructure/fs-workspace'
import { writeProjectClaudeMd } from '@/server/services/provision'
import { engine } from '@/server/services/execution-manager'
import { agentSessions } from '@/server/services/agent-sessions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Reset the root CLAUDE.md to the canonical template (§8 — instant, no agent). */
export async function POST(_req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        if (engine.isLocked(params.project) || agentSessions.isBusy(params.project)) {
            return error('run in progress', 409)
        }
        await writeProjectClaudeMd(params.project)
        return json({ ok: true })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
