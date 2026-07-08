// GET /api/notes — list with multi-tag AND filter, date range, FTS search.
// POST /api/notes — create (JSON body). Spec §4.5, §8.

import { type NextRequest } from 'next/server'
import { guard, audit, json } from '@/server/web/http'
import * as notes from '@/server/services/notes'
import { NoteError, httpErrorFor } from '@/server/services/notes'
import { normalizeTag } from '@/server/domain/note-validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export async function GET(req: NextRequest) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const url = new URL(req.url)
    const tagsCsv = url.searchParams.get('tags') ?? ''
    const tags = tagsCsv
        .split(',')
        .map((t) => normalizeTag(t))
        .filter(Boolean)
    const ownerRaw = url.searchParams.get('owner')
    const result = notes.list(
        { githubId: auth.session.sub, login: auth.session.login, role: auth.role },
        {
            tags: tags.length ? tags : undefined,
            from: url.searchParams.get('from') ?? undefined,
            to: url.searchParams.get('to') ?? undefined,
            q: url.searchParams.get('q') ?? undefined,
            owner: ownerRaw ? Number(ownerRaw) || undefined : undefined,
            page: Math.max(1, Number(url.searchParams.get('page')) || 1),
            pageSize: PAGE_SIZE,
        },
    )
    return json(result)
}

export async function POST(req: NextRequest) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const body = await req.json().catch(() => ({}))
    try {
        const { id } = await notes.create(
            { githubId: auth.session.sub, login: auth.session.login, role: auth.role },
            { title: body?.title, date: body?.date, tags: body?.tags, content: body?.content },
        )
        audit(auth, 'note.create', id)
        return json({ id }, 201)
    } catch (err) {
        if (err instanceof NoteError) {
            const mapped = httpErrorFor(err)
            return json(mapped.body, mapped.status)
        }
        throw err
    }
}
