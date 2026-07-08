// GET (metadata + markdown content) / PATCH (update) / DELETE — spec §4.5, §8.

import { type NextRequest } from 'next/server'
import { guard, audit, json } from '@/server/web/http'
import * as notes from '@/server/services/notes'
import { NoteError, httpErrorFor } from '@/server/services/notes'
import { UnsafePathError } from '@/server/infrastructure/fs-media'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

function mapErr(err: unknown) {
    if (err instanceof UnsafePathError) return json({ error: 'not found' }, 404)
    if (err instanceof NoteError) {
        const mapped = httpErrorFor(err)
        return json(mapped.body, mapped.status)
    }
    return null
}

export async function GET(_req: NextRequest, ctx: Ctx) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const { id } = await ctx.params
    try {
        const note = await notes.get(
            { githubId: auth.session.sub, login: auth.session.login, role: auth.role },
            id,
        )
        return json(note)
    } catch (err) {
        return mapErr(err) ?? Promise.reject(err)
    }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    try {
        await notes.update(
            { githubId: auth.session.sub, login: auth.session.login, role: auth.role },
            id,
            { title: body?.title, date: body?.date, tags: body?.tags, content: body?.content },
        )
        audit(auth, 'note.update', id)
        return json({ ok: true })
    } catch (err) {
        return mapErr(err) ?? Promise.reject(err)
    }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const { id } = await ctx.params
    try {
        await notes.remove({ githubId: auth.session.sub, login: auth.session.login, role: auth.role }, id)
        audit(auth, 'note.delete', id)
        return json({ ok: true })
    } catch (err) {
        return mapErr(err) ?? Promise.reject(err)
    }
}
