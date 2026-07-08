// GET (detail + segments) / PATCH (rename) / DELETE — spec §8.

import { type NextRequest } from 'next/server'
import { guard, audit, json } from '@/server/web/http'
import * as transcriptions from '@/server/services/transcriptions'
import { TranscriptionError, httpErrorFor } from '@/server/services/transcriptions'
import { UnsafePathError } from '@/server/infrastructure/fs-media'
import { validateTitle } from '@/server/domain/upload-validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

function mapErr(err: unknown) {
    if (err instanceof UnsafePathError) return json({ error: 'not found' }, 404)
    if (err instanceof TranscriptionError) {
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
        const detail = await transcriptions.get(
            { githubId: auth.session.sub, login: auth.session.login, role: auth.role },
            id,
        )
        return json(detail)
    } catch (err) {
        return mapErr(err) ?? Promise.reject(err)
    }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const title = validateTitle(body?.title)
    if (!title.ok) return json({ error: title.error.message }, 422)
    try {
        transcriptions.rename(
            { githubId: auth.session.sub, login: auth.session.login, role: auth.role },
            id,
            title.value,
        )
        audit(auth, 'transcription.rename', `${id} → ${title.value}`)
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
        await transcriptions.remove(
            { githubId: auth.session.sub, login: auth.session.login, role: auth.role },
            id,
        )
        audit(auth, 'transcription.delete', id)
        return json({ ok: true })
    } catch (err) {
        return mapErr(err) ?? Promise.reject(err)
    }
}
