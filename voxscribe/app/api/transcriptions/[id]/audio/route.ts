// GET — stream the original media with Range support for the synced player
// (spec §4.4). Streams from disk, zero-copy.

import { type NextRequest } from 'next/server'
import fs from 'node:fs'
import { Readable } from 'node:stream'
import { guard, json } from '@/server/web/http'
import * as transcriptions from '@/server/services/transcriptions'
import { TranscriptionError, httpErrorFor } from '@/server/services/transcriptions'
import { UnsafePathError } from '@/server/infrastructure/fs-media'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const { id } = await ctx.params

    let info: transcriptions.ArtifactInfo
    try {
        info = await transcriptions.artifactInfo(
            { githubId: auth.session.sub, login: auth.session.login, role: auth.role },
            id,
            'audio',
        )
    } catch (err) {
        if (err instanceof UnsafePathError) return json({ error: 'not found' }, 404)
        if (err instanceof TranscriptionError) {
            const mapped = httpErrorFor(err)
            return json(mapped.body, mapped.status)
        }
        throw err
    }

    const range = req.headers.get('range')
    const common = {
        'Accept-Ranges': 'bytes',
        'Content-Type': info.contentType,
        'Cache-Control': 'private, no-store',
    }

    if (range) {
        const m = range.match(/^bytes=(\d*)-(\d*)$/)
        if (!m || (m[1] === '' && m[2] === '')) {
            return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${info.size}` } })
        }
        let start: number
        let end: number
        if (m[1] === '') {
            // suffix range: last N bytes
            const suffix = Math.min(Number(m[2]), info.size)
            start = info.size - suffix
            end = info.size - 1
        } else {
            start = Number(m[1])
            end = m[2] === '' ? info.size - 1 : Math.min(Number(m[2]), info.size - 1)
        }
        if (start > end || start >= info.size) {
            return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${info.size}` } })
        }
        const stream = fs.createReadStream(info.path, { start, end })
        return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
            status: 206,
            headers: {
                ...common,
                'Content-Range': `bytes ${start}-${end}/${info.size}`,
                'Content-Length': String(end - start + 1),
            },
        })
    }

    const stream = fs.createReadStream(info.path)
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
        status: 200,
        headers: {
            ...common,
            'Content-Length': String(info.size),
            'Content-Disposition': `attachment; filename="${encodeURIComponent(info.filename)}"`,
        },
    })
}
