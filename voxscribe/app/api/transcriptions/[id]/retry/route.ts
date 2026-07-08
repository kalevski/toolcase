// POST — failed → pending (spec §4.2, §8).

import { type NextRequest } from 'next/server'
import { guard, audit, json } from '@/server/web/http'
import * as transcriptions from '@/server/services/transcriptions'
import { TranscriptionError, httpErrorFor } from '@/server/services/transcriptions'
import { UnsafePathError } from '@/server/infrastructure/fs-media'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const { id } = await ctx.params
    try {
        transcriptions.retry({ githubId: auth.session.sub, login: auth.session.login, role: auth.role }, id)
        audit(auth, 'transcription.retry', id)
        return json({ ok: true })
    } catch (err) {
        if (err instanceof UnsafePathError) return json({ error: 'not found' }, 404)
        if (err instanceof TranscriptionError) {
            const mapped = httpErrorFor(err)
            return json(mapped.body, mapped.status)
        }
        throw err
    }
}
