// A2 — queue reordering. Takes the full ordered list of pending task ids and
// renumbers their files (done/error keep their numbers; telemetry re-keys).

import { guard, json, error, audit } from '@/server/web/http'
import {
    reorderPendingTasks,
    projectExists,
    ReorderError,
    UnsafePathError,
} from '@/server/infrastructure/fs-workspace'
import { engine } from '@/server/services/execution-manager'
import { agentSessionsBusy, withProjectLock } from '@/server/services/locks'
import { getTasks } from '@/server/services/projects'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        if (engine.isLocked(params.project) || agentSessionsBusy(params.project)) {
            return error('a run or agent is in progress', 409)
        }
        const body = (await req.json().catch(() => ({}))) as { ids?: string[] }
        const ids = Array.isArray(body.ids)
            ? body.ids.filter((i): i is string => typeof i === 'string' && i.length > 0)
            : []
        if (!ids.length) return error('ids required', 400)

        // Serialize against any concurrent reorder for the same project — the
        // two-phase rename uses fixed temp names that would otherwise collide.
        const mapping = await withProjectLock(params.project, () =>
            reorderPendingTasks(params.project, ids),
        )
        audit(auth, 'task.reorder', params.project, `${Object.keys(mapping).length} renamed`)
        return json({ mapping, tasks: await getTasks(params.project) })
    } catch (e) {
        if (e instanceof ReorderError) return error(e.message, 400)
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
