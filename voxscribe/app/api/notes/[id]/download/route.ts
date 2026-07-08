// GET — raw .md, attachment filename `<date>-<slug>.md` (spec §4.5).

import { type NextRequest } from 'next/server'
import fs from 'node:fs'
import { Readable } from 'node:stream'
import { guard, json } from '@/server/web/http'
import * as notes from '@/server/services/notes'
import { NoteError, httpErrorFor } from '@/server/services/notes'
import { UnsafePathError } from '@/server/infrastructure/fs-media'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const { id } = await ctx.params
    try {
        const info = await notes.downloadInfo(
            { githubId: auth.session.sub, login: auth.session.login, role: auth.role },
            id,
        )
        const stream = fs.createReadStream(info.path)
        return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
            status: 200,
            headers: {
                'Content-Type': 'text/markdown; charset=utf-8',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(info.filename)}"`,
                'Cache-Control': 'private, no-store',
            },
        })
    } catch (err) {
        if (err instanceof UnsafePathError) return json({ error: 'not found' }, 404)
        if (err instanceof NoteError) {
            const mapped = httpErrorFor(err)
            return json(mapped.body, mapped.status)
        }
        throw err
    }
}
