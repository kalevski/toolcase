// A5 — archive done tasks: GET lists tasks/archive/, POST moves every done task
// there, PUT restores one back into the active queue.

import { guard, json, error, audit, errorFrom } from '@/server/web/http'
import {
    archiveDoneTasks,
    listArchivedTaskFiles,
    readArchivedTaskFile,
    restoreArchivedTask,
    extractTitle,
    projectExists,
} from '@/server/infrastructure/fs-workspace'
import { engine } from '@/server/services/execution-manager'
import { agentSessionsBusy } from '@/server/services/locks'
import { getTasks } from '@/server/services/projects'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        const ids = await listArchivedTaskFiles(params.project)
        const entries = await Promise.all(
            ids.map(async (id) => {
                try {
                    const content = await readArchivedTaskFile(params.project, id)
                    return { id, title: extractTitle(content, id) }
                } catch {
                    return { id, title: id }
                }
            }),
        )
        return json(entries)
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}

export async function POST(_req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        if (engine.isLocked(params.project) || agentSessionsBusy(params.project)) {
            return error('a run or agent is in progress', 409)
        }
        const moved = await archiveDoneTasks(params.project)
        audit(auth, 'task.archive', params.project, `${moved.length} task(s)`)
        return json({ moved, tasks: await getTasks(params.project) })
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}

/** Restore one archived task: `{ id }`. */
export async function PUT(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        if (engine.isLocked(params.project) || agentSessionsBusy(params.project)) {
            return error('a run or agent is in progress', 409)
        }
        const body = (await req.json().catch(() => ({}))) as { id?: string }
        if (!body.id) return error('id required', 400)
        await restoreArchivedTask(params.project, body.id)
        audit(auth, 'task.unarchive', params.project, body.id)
        return json({ tasks: await getTasks(params.project) })
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}
