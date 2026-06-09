import { guard, json, error } from '@/server/web/http'
import { engine } from '@/server/services/execution-manager'
import { removeKnowledge } from '@/server/services/knowledge'
import { getKnowledge } from '@/server/services/projects'
import { readKnowledgeFile, extractTitle, UnsafePathError } from '@/server/infrastructure/fs-workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

export async function DELETE(_req: Request, { params }: { params: { project: string; id: string[] } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const id = params.id.join('/')
    try {
        // don't touch the working tree while a run holds the lock
        if (engine.isLocked(params.project)) return error('run in progress', 409)
        if (id.toLowerCase() === 'index.md') return error('index is managed automatically', 400)

        await removeKnowledge(params.project, id)
        return json({ docs: await getKnowledge(params.project) })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
