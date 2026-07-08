// GET ?format=txt|srt|vtt|json — download a transcript artifact (spec §4.4).

import { type NextRequest } from 'next/server'
import fs from 'node:fs'
import { Readable } from 'node:stream'
import { guard, json } from '@/server/web/http'
import * as transcriptions from '@/server/services/transcriptions'
import { TranscriptionError, httpErrorFor } from '@/server/services/transcriptions'
import { UnsafePathError } from '@/server/infrastructure/fs-media'
import type { TranscriptFormat } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FORMATS: TranscriptFormat[] = ['txt', 'srt', 'vtt', 'json']

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const { id } = await ctx.params
    const format = new URL(req.url).searchParams.get('format') ?? 'txt'
    if (!FORMATS.includes(format as TranscriptFormat)) return json({ error: 'invalid format' }, 422)

    try {
        const info = await transcriptions.artifactInfo(
            { githubId: auth.session.sub, login: auth.session.login, role: auth.role },
            id,
            format as TranscriptFormat,
        )
        const stream = fs.createReadStream(info.path)
        return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
            status: 200,
            headers: {
                'Content-Type': info.contentType,
                'Content-Length': String(info.size),
                'Content-Disposition': `attachment; filename="${encodeURIComponent(info.filename)}"`,
                'Cache-Control': 'private, no-store',
            },
        })
    } catch (err) {
        if (err instanceof UnsafePathError) return json({ error: 'not found' }, 404)
        if (err instanceof TranscriptionError) {
            const mapped = httpErrorFor(err)
            return json(mapped.body, mapped.status)
        }
        throw err
    }
}
