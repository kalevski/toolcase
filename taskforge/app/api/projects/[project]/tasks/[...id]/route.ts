import { guard, json, error, audit } from '@/server/web/http'
import {
    readTaskFile,
    parseTask,
    updateTaskModel,
    editTaskContent,
    deleteTaskFile,
    reconcileTasks,
    UnsafePathError,
} from '@/server/infrastructure/fs-workspace'
import { clearTelemetry } from '@/server/infrastructure/logs'
import { engine } from '@/server/services/execution-manager'
import { agentSessionsBusy } from '@/server/services/locks'
import { config } from '@/server/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { project: string; id: string[] } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const id = params.id.join('/')
    try {
        const content = await readTaskFile(params.project, id)
        const parsed = parseTask(content, id)
        return json({ id, content, ...parsed })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        return error('task not found', 404)
    }
}

const MODEL_ALIASES = ['fast', 'mid', 'deep']

/**
 * §9 — pin (or clear, with null/'') the task's preferred model, and/or
 * A1 — replace the task body (`{ content }`). Both 409 while the task runs.
 */
export async function PATCH(req: Request, { params }: { params: { project: string; id: string[] } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const id = params.id.join('/')

    const body = (await req.json().catch(() => ({}))) as { model?: string | null; content?: string }
    if (body.model === undefined && body.content === undefined) {
        return error('model or content required', 400)
    }

    // refuse while this exact task is in flight
    const snap = engine.snapshot(params.project)
    if (snap.state !== 'IDLE' && snap.current === id) return error('task is currently running', 409)

    try {
        if (body.content !== undefined) {
            if (typeof body.content !== 'string' || !body.content.trim()) {
                return error('content must be a non-empty string', 400)
            }
            await editTaskContent(params.project, id, body.content)
            audit(auth, 'task.edit', params.project, id)
        }
        if (body.model !== undefined) {
            const model = body.model === null || body.model === '' ? null : body.model
            if (model !== null) {
                const known = config.modelCatalog.includes(model) || MODEL_ALIASES.includes(model)
                if (!known) return error(`model not in catalog: ${model}`, 400)
            }
            await updateTaskModel(params.project, id, model)
        }
        const content = await readTaskFile(params.project, id)
        return json({ id, content, ...parseTask(content, id) })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        return error('task not found', 404)
    }
}

/** A3 — delete one task file (its telemetry history is removed with it). */
export async function DELETE(_req: Request, { params }: { params: { project: string; id: string[] } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const id = params.id.join('/')
    try {
        if (engine.isLocked(params.project) || agentSessionsBusy(params.project)) {
            return error('a run or agent is in progress', 409)
        }
        await deleteTaskFile(params.project, id)
        await clearTelemetry(params.project, [id])
        await reconcileTasks(params.project)
        audit(auth, 'task.delete', params.project, id)
        return json({ ok: true })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
