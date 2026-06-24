// B6 — "Redo with feedback": append a ## Feedback section (with the previous
// error inlined), reset the task to pending, and optionally start a
// single-task run (reusing the resetTasks + onlyTasks mechanics).

import { guard, json, error, audit } from '@/server/web/http'
import {
    readTaskFile,
    writeTaskFile,
    parseTask,
    updateTaskStatus,
    removeCompleted,
    reconcileTasks,
    projectExists,
    UnsafePathError,
} from '@/server/infrastructure/fs-workspace'
import { clearTelemetry } from '@/server/infrastructure/logs'
import { engine, DirtyTreeError, LockHeldError } from '@/server/services/execution-manager'
import { agentSessionsBusy } from '@/server/services/locks'
import { effectiveSettings } from '@/server/services/settings'
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

        const body = (await req.json().catch(() => ({}))) as {
            id?: string
            text?: string
            rerun?: boolean
            model?: string
        }
        if (!body.id) return error('id required', 400)
        if (!body.text?.trim()) return error('feedback text required', 400)

        const id = body.id
        let content: string
        try {
            content = await readTaskFile(params.project, id)
        } catch {
            return error('task not found', 404)
        }
        const parsed = parseTask(content, id)

        const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
        const section = [
            '',
            `## Feedback (${stamp})`,
            '',
            ...(parsed.error ? [`Previous attempt failed with: ${parsed.error}`, ''] : []),
            body.text.trim(),
            '',
        ].join('\n')
        await writeTaskFile(params.project, id, content.trimEnd() + '\n' + section)

        // back to pending: reopen header+row, drop from ledger, clear stale telemetry
        await updateTaskStatus(params.project, id, 'open')
        await removeCompleted(params.project, [id])
        await clearTelemetry(params.project, [id])
        await reconcileTasks(params.project)
        audit(auth, 'task.feedback', params.project, `${id}${body.rerun ? ' (rerun)' : ''}`)

        if (body.rerun) {
            try {
                const snapshot = await engine.start(params.project, {
                    model: body.model || effectiveSettings(params.project).defaultModel,
                    onlyTasks: [id],
                    resetTasks: [id],
                    startedBy: `user:${auth.session.login}`,
                })
                return json({ id, started: true, snapshot, tasks: await getTasks(params.project) })
            } catch (e) {
                if (e instanceof DirtyTreeError) {
                    return json(
                        { id, started: false, error: 'dirty tree', dirtyFiles: e.files, tasks: await getTasks(params.project) },
                        412,
                    )
                }
                if (e instanceof LockHeldError) {
                    return json({ id, started: false, error: 'busy', tasks: await getTasks(params.project) }, 409)
                }
                throw e
            }
        }

        return json({ id, started: false, tasks: await getTasks(params.project) })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
