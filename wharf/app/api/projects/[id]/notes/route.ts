import { guardProject, json, error, audit } from '@/server/web/http'
import { listNotes, createNote } from '@/server/services/notes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    return json(listNotes(id))
}

export async function POST(req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as { title?: string; content?: string }
    const title = (body.title ?? '').trim()
    if (!title) return error('title required', 400)
    const note = createNote(id, { title, content: body.content ?? '' }, auth.session.sub)
    audit(auth, 'note.create', id, note.id)
    return json(note, 201)
}
