import { guard, json, error } from '@/server/http'
import { engine } from '@/server/execution-manager'
import { addKnowledge } from '@/server/knowledge'
import { getKnowledge } from '@/server/projects'
import { config } from '@/server/config'
import { projectExists, UnsafePathError } from '@/server/fs-workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(_req: Request, { params }: { params: { project: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        return json(await getKnowledge(params.project))
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}

export async function POST(req: Request, { params }: { params: { project: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        // don't write to the working tree while a run holds the lock
        if (engine.isLocked(params.project)) return error('run in progress', 409)

        const body = (await req.json().catch(() => ({}))) as { prompt?: string; model?: string }
        if (!body.prompt || !body.prompt.trim()) return error('prompt required', 400)

        const model = body.model || config.defaultModel
        if (!config.modelCatalog.includes(model)) return error(`model not in catalog: ${model}`, 400)

        const result = await addKnowledge(params.project, body.prompt.trim(), model)
        const docs = await getKnowledge(params.project)
        return json({ created: result.files, timedOut: result.timedOut, docs })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
