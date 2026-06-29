import { guardProject, json, error, audit } from '@/server/web/http'
import { updateNote, deleteNote, NoteNotFoundError } from '@/server/services/notes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; noteId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
    const { id, noteId } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as { title?: string; content?: string }
    try {
        const note = updateNote(id, noteId, body)
        audit(auth, 'note.update', id, noteId)
        return json(note)
    } catch (e) {
        if (e instanceof NoteNotFoundError) return error('not found', 404)
        throw e
    }
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const { id, noteId } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    try {
        deleteNote(id, noteId)
        audit(auth, 'note.delete', id, noteId)
        return json({ ok: true })
    } catch (e) {
        if (e instanceof NoteNotFoundError) return error('not found', 404)
        throw e
    }
}
