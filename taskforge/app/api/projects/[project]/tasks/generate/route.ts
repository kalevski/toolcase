import { guard, json, error } from '@/server/http'
import { engine } from '@/server/execution-manager'
import { generateTasks } from '@/server/generate'
import { getTasks } from '@/server/projects'
import { config } from '@/server/config'
import { projectExists, UnsafePathError } from '@/server/fs-workspace'
import { slog } from '@/server/server-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request, { params }: { params: { project: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res

    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        // don't mutate a live queue (§7.1)
        if (engine.isLocked(params.project)) return error('run in progress', 409)

        const body = (await req.json().catch(() => ({}))) as { prompt?: string; model?: string }
        if (!body.prompt || !body.prompt.trim()) return error('prompt required', 400)

        const model = body.model || config.defaultModel
        if (!config.modelCatalog.includes(model)) return error(`model not in catalog: ${model}`, 400)

        slog('info', 'api', `POST tasks/generate`, { project: params.project, model, by: auth.session.login })
        const result = await generateTasks(params.project, body.prompt.trim(), model)
        slog('info', 'api', `generated ${result.created.length} task(s)`, {
            project: params.project,
            timedOut: result.timedOut,
        })
        const tasks = await getTasks(params.project)
        return json({ created: result.created, timedOut: result.timedOut, tasks })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
