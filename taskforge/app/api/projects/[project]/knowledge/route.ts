import { guard, json, error, audit, errorFrom } from '@/server/web/http'
import { getKnowledge } from '@/server/services/projects'
import {
    projectExists,
    writeKnowledgeFile,
    listKnowledgeFiles,
} from '@/server/infrastructure/fs-workspace'
import { rebuildIndex } from '@/server/services/knowledge'
import { engine } from '@/server/services/execution-manager'
import { agentSessions } from '@/server/services/agent-sessions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        return json(await getKnowledge(params.project))
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

/** C2 — manual knowledge-doc creation: `{ slug, content }` → `<slug>.md`. */
export async function POST(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        if (
            engine.isLocked(params.project) ||
            agentSessions.snapshot(params.project, 'knowledge-writer').status === 'running'
        ) {
            return error('run or knowledge agent in progress', 409)
        }
        const body = (await req.json().catch(() => ({}))) as { slug?: string; content?: string }
        if (!body.slug || !SLUG_RE.test(body.slug)) return error('slug must be kebab-case', 400)
        if (body.slug === 'index') return error('index is managed automatically', 400)
        if (typeof body.content !== 'string' || !body.content.trim()) return error('content required', 400)
        const id = `${body.slug}.md`
        const existing = await listKnowledgeFiles(params.project)
        if (existing.some((f) => f.toLowerCase() === id.toLowerCase())) {
            return error(`${id} already exists`, 409)
        }
        await writeKnowledgeFile(params.project, id, body.content)
        await rebuildIndex(params.project)
        audit(auth, 'knowledge.create', params.project, id)
        return json({ id, docs: await getKnowledge(params.project) }, 201)
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}
