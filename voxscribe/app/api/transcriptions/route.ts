// GET /api/transcriptions — list (own; admin: all + ?owner=), FTS q, filters.
// POST /api/transcriptions — multipart upload → 201 { id }; duplicate & no
// force → 409 { duplicateOf } (spec §4.1, §8).
//
// The multipart body is parsed STREAMING with busboy over the raw request
// stream — never `req.formData()`, which materializes file parts in memory and
// breaks the RAM budget at 500 MB uploads (spec §7). API contract: option
// fields precede the file part (the upload client appends them first).

import { type NextRequest } from 'next/server'
import { Readable } from 'node:stream'
import Busboy from 'busboy'
import { guard, audit, json, error } from '@/server/web/http'
import { config } from '@/server/config'
import * as transcriptions from '@/server/services/transcriptions'
import { TranscriptionError, httpErrorFor } from '@/server/services/transcriptions'
import type { TranscriptionStatus } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25
const STATUSES: TranscriptionStatus[] = ['pending', 'processing', 'done', 'failed']

export async function GET(req: NextRequest) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res

    const url = new URL(req.url)
    const statusRaw = url.searchParams.get('status') ?? undefined
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    const ownerRaw = url.searchParams.get('owner')
    const result = transcriptions.list(
        { githubId: auth.session.sub, login: auth.session.login, role: auth.role },
        {
            status: STATUSES.includes(statusRaw as TranscriptionStatus)
                ? (statusRaw as TranscriptionStatus)
                : undefined,
            language: url.searchParams.get('language') ?? undefined,
            model: url.searchParams.get('model') ?? undefined,
            q: url.searchParams.get('q') ?? undefined,
            owner: ownerRaw ? Number(ownerRaw) || undefined : undefined,
            page,
            pageSize: PAGE_SIZE,
        },
    )
    return json(result)
}

export async function POST(req: NextRequest) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const actor = { githubId: auth.session.sub, login: auth.session.login, role: auth.role }

    const contentType = req.headers.get('content-type') ?? ''
    if (!contentType.startsWith('multipart/form-data')) {
        return error('expected multipart/form-data', 415)
    }

    // Early cap rejection on Content-Length when present; the mid-stream byte
    // counter in the service covers chunked bodies (spec §4.1). The multipart
    // envelope adds a little overhead, so allow 1 MB of slack.
    const declared = Number(req.headers.get('content-length')) || undefined
    if (declared && declared > config.maxUploadBytes + 1024 * 1024) {
        return error(`upload exceeds ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB cap`, 413)
    }

    if (!req.body) return error('empty body', 422)

    const fields: Record<string, string> = {}
    let uploadResult: Promise<{ id: string }> | null = null

    const bb = Busboy({ headers: { 'content-type': contentType }, limits: { files: 1 } })
    const parsed = new Promise<void>((resolve, reject) => {
        bb.on('field', (name, value) => {
            fields[name] = value
        })
        bb.on('file', (_name, stream, info) => {
            // Fields arrive before the file (client appends options first);
            // start the service pipeline immediately so the file streams straight
            // to disk. On a service error, drain the rest so busboy can finish.
            uploadResult = transcriptions
                .createFromUpload(actor, stream, {
                    filename: info.filename || 'upload',
                    title: fields.title,
                    language: fields.language,
                    model: fields.model,
                    translate: fields.translate === 'true' || fields.translate === '1',
                    force: fields.force === 'true' || fields.force === '1',
                    declaredBytes: declared,
                })
                .catch((err) => {
                    stream.resume()
                    throw err
                })
        })
        bb.on('error', reject)
        bb.on('close', resolve)
    })

    try {
        const body = Readable.fromWeb(req.body as any)
        const piping = new Promise<void>((resolve, reject) => {
            body.on('error', reject)
            bb.on('error', reject)
            body.pipe(bb)
            bb.on('close', resolve)
        })
        await Promise.all([parsed, piping])
        if (!uploadResult) return error('no file in upload', 422)
        const { id } = await uploadResult
        audit(auth, 'transcription.create', id)
        return json({ id }, 201)
    } catch (err) {
        if (err instanceof TranscriptionError) {
            const mapped = httpErrorFor(err)
            return json(mapped.body, mapped.status)
        }
        throw err
    }
}
