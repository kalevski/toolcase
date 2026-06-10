// A3 — bulk task operations: { op: 'delete'|'reset'|'pin', ids, model? }.
// Atomic enough for local files: each id is processed via the existing
// single-task primitives; partial failures are reported per id.
// (Bulk re-run is wired client-side straight to run/start with onlyTasks.)

import { guard, json, error, audit } from '@/server/web/http'
import {
    deleteTaskFile,
    updateTaskStatus,
    updateTaskModel,
    removeCompleted,
    reconcileTasks,
    projectExists,
    UnsafePathError,
} from '@/server/infrastructure/fs-workspace'
import { clearTelemetry } from '@/server/infrastructure/logs'
import { engine } from '@/server/services/execution-manager'
import { agentSessionsBusy } from '@/server/services/locks'
import { getTasks } from '@/server/services/projects'
import { config } from '@/server/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MODEL_ALIASES = ['fast', 'mid', 'deep']

export async function POST(req: Request, { params }: { params: { project: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        if (engine.isLocked(params.project) || agentSessionsBusy(params.project)) {
            return error('a run or agent is in progress', 409)
        }

        const body = (await req.json().catch(() => ({}))) as {
            op?: string
            ids?: string[]
            model?: string | null
        }
        const ids = Array.isArray(body.ids)
            ? body.ids.filter((i): i is string => typeof i === 'string' && i.length > 0)
            : []
        if (!ids.length) return error('ids required', 400)
        if (ids.length > 500) return error('too many ids', 400)

        const failed: string[] = []

        switch (body.op) {
            case 'delete': {
                for (const id of ids) {
                    try {
                        await deleteTaskFile(params.project, id)
                    } catch {
                        failed.push(id)
                    }
                }
                await clearTelemetry(params.project, ids)
                break
            }
            case 'reset': {
                // like reset-errors, but for an arbitrary selection
                for (const id of ids) {
                    try {
                        await updateTaskStatus(params.project, id, 'open')
                    } catch {
                        failed.push(id)
                    }
                }
                await removeCompleted(params.project, ids)
                await clearTelemetry(params.project, ids)
                break
            }
            case 'pin': {
                const model = body.model === null || body.model === '' ? null : (body.model ?? null)
                if (model !== null && !(config.modelCatalog.includes(model) || MODEL_ALIASES.includes(model))) {
                    return error(`model not in catalog: ${model}`, 400)
                }
                for (const id of ids) {
                    try {
                        await updateTaskModel(params.project, id, model)
                    } catch {
                        failed.push(id)
                    }
                }
                break
            }
            default:
                return error('op must be delete|reset|pin', 400)
        }

        await reconcileTasks(params.project)
        audit(auth, `task.bulk.${body.op}`, params.project, `${ids.length} task(s)`)
        return json({ ok: failed.length === 0, failed, tasks: await getTasks(params.project) })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
