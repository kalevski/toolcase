import { guardProject, json, error, audit } from '@/server/web/http'
import { revealNote, NoteNotFoundError } from '@/server/services/notes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; noteId: string }> }

export async function GET(_req: Request, { params }: Ctx) {
    const { id, noteId } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    try {
        const content = revealNote(id, noteId)
        audit(auth, 'note.reveal', id, noteId)
        return json({ content })
    } catch (e) {
        if (e instanceof NoteNotFoundError) return error('not found', 404)
        throw e
    }
}
