import { guard, json, error, errorFrom } from '@/server/web/http'
import {
    readNoteFile,
    writeNoteFile,
    deleteNoteFile,
    extractTitle,
} from '@/server/infrastructure/fs-workspace'
import { getNotes } from '@/server/services/projects'
import { agentSessions } from '@/server/services/agent-sessions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Notes live outside repo/ and outside the task ledger, so manual edits are
// allowed even while the engine runs. They are blocked (409) only while the
// note-writer agent runs, to avoid clobbering its writes.
function noteAgentBusy(project: string): boolean {
    return agentSessions.snapshot(project, 'note-writer').status === 'running'
}

export async function GET(_req: Request, ctx: { params: Promise<{ project: string; id: string[] }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const id = params.id.join('/')
    try {
        const content = await readNoteFile(params.project, id)
        return json({ id, title: extractTitle(content, id), content })
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        return error('note not found', 404)
    }
}

/** Manual save; creates the note (and notes/) if missing. */
export async function PUT(req: Request, ctx: { params: Promise<{ project: string; id: string[] }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const id = params.id.join('/')
    try {
        if (noteAgentBusy(params.project)) return error('notes agent is running', 409)
        if (!id.toLowerCase().endsWith('.md')) return error('notes must be .md files', 400)
        const body = (await req.json().catch(() => ({}))) as { content?: string }
        if (typeof body.content !== 'string') return error('content required', 400)
        await writeNoteFile(params.project, id, body.content)
        return json({ id, notes: await getNotes(params.project) })
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ project: string; id: string[] }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const id = params.id.join('/')
    try {
        if (noteAgentBusy(params.project)) return error('notes agent is running', 409)
        await deleteNoteFile(params.project, id)
        return json({ notes: await getNotes(params.project) })
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}
