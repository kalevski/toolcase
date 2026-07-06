import { guard, json, error, audit, errorFrom } from '@/server/web/http'
import { getTasks } from '@/server/services/projects'
import { projectExists, createTask } from '@/server/infrastructure/fs-workspace'
import { engine } from '@/server/services/execution-manager'
import { config } from '@/server/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        return json(await getTasks(params.project))
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}

const MODEL_ALIASES = ['fast', 'mid', 'deep']

/** A1 — manual task creation (no agent round-trip). */
export async function POST(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        if (engine.isLocked(params.project)) return error('a run is in progress', 409)

        const body = (await req.json().catch(() => ({}))) as {
            title?: string
            body?: string
            severity?: string
            project?: string
            model?: string
            depends?: string[]
        }
        if (!body.title?.trim()) return error('title required', 400)
        if (typeof body.body !== 'string' || !body.body.trim()) return error('body required', 400)
        if (body.model && !(config.modelCatalog.includes(body.model) || MODEL_ALIASES.includes(body.model))) {
            return error(`model not in catalog: ${body.model}`, 400)
        }

        const id = await createTask(params.project, {
            title: body.title.trim(),
            body: body.body,
            severity: body.severity?.trim() || undefined,
            project: body.project?.trim() || undefined,
            model: body.model || undefined,
            depends: Array.isArray(body.depends)
                ? body.depends.map((d) => String(d).trim()).filter(Boolean)
                : undefined,
        })
        audit(auth, 'task.create', params.project, id)
        return json({ id, tasks: await getTasks(params.project) }, 201)
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}
