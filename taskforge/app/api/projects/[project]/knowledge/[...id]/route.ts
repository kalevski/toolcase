import { guard, json, error, audit } from '@/server/web/http'
import { engine } from '@/server/services/execution-manager'
import { removeKnowledge, rebuildIndex } from '@/server/services/knowledge'
import { getKnowledge } from '@/server/services/projects'
import { agentSessions } from '@/server/services/agent-sessions'
import {
    readKnowledgeFile,
    writeKnowledgeFile,
    extractTitle,
    UnsafePathError,
} from '@/server/infrastructure/fs-workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// C2 — edits are blocked while the knowledge-writer streams (it may rewrite the
// same doc) or while a run holds the lock (the post-task auto-update does too).
function knowledgeBusy(project: string): boolean {
    return (
        engine.isLocked(project) || agentSessions.snapshot(project, 'knowledge-writer').status === 'running'
    )
}

export async function GET(_req: Request, { params }: { params: { project: string; id: string[] } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const id = params.id.join('/')
    try {
        const content = await readKnowledgeFile(params.project, id)
        return json({ id, title: extractTitle(content, id), content, isIndex: id.toLowerCase() === 'index.md' })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        return error('doc not found', 404)
    }
}

/** C2 — manual save of a knowledge doc; the index rebuilds so summaries propagate. */
export async function PUT(req: Request, { params }: { params: { project: string; id: string[] } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const id = params.id.join('/')
    try {
        if (knowledgeBusy(params.project)) return error('run or knowledge agent in progress', 409)
        if (id.toLowerCase() === 'index.md') return error('index is managed automatically', 400)
        if (!id.toLowerCase().endsWith('.md')) return error('knowledge docs must be .md files', 400)
        const body = (await req.json().catch(() => ({}))) as { content?: string }
        if (typeof body.content !== 'string' || !body.content.trim()) return error('content required', 400)
        await writeKnowledgeFile(params.project, id, body.content)
        await rebuildIndex(params.project)
        audit(auth, 'knowledge.edit', params.project, id)
        return json({ id, docs: await getKnowledge(params.project) })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}

export async function DELETE(_req: Request, { params }: { params: { project: string; id: string[] } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const id = params.id.join('/')
    try {
        // don't touch the working tree while a run holds the lock
        if (engine.isLocked(params.project)) return error('run in progress', 409)
        if (id.toLowerCase() === 'index.md') return error('index is managed automatically', 400)

        await removeKnowledge(params.project, id)
        audit(auth, 'knowledge.delete', params.project, id)
        return json({ docs: await getKnowledge(params.project) })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
