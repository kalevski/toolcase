// Transcriptions service — the app core (spec §6.5). Ownership enforcement
// lives HERE: every query/mutation takes the actor and applies the ownership
// filter; routes only pass the authorized actor down.

import 'server-only'
import fsp from 'node:fs/promises'
import crypto from 'node:crypto'
import { Transform, type Readable } from 'node:stream'
import { config } from '@/server/config'
import { tx } from '@/server/data/db'
import * as repo from '@/server/data/repositories/transcription-repo'
import * as fsMedia from '@/server/infrastructure/fs-media'
import * as ffmpeg from '@/server/infrastructure/ffmpeg'
import { ID } from '@/server/infrastructure/ids'
import { isPresent } from '@/server/infrastructure/model-store'
import { publishJobUpdate } from '@/server/web/sse'
import { checkQuota } from '@/server/domain/quota'
import { canDelete, canRetry, queuePosition } from '@/server/domain/transcription'
import { parseWhisperJson } from '@/server/domain/format'
import {
    extensionOf,
    isAcceptedExtension,
    titleFromFilename,
    validateUploadOptions,
    type UploadOptionsInput,
} from '@/server/domain/upload-validation'
import type {
    Role,
    Transcription,
    TranscriptFormat,
    TranscriptionDetail,
    TranscriptionListItem,
    TranscriptionStatus,
} from '@/server/domain/types'

export interface Actor {
    githubId: number
    login: string
    role: Role
}

export type TranscriptionErrorCode =
    | 'not_found'
    | 'invalid'
    | 'quota_exceeded'
    | 'too_large'
    | 'duplicate'
    | 'no_audio'
    | 'too_long'
    | 'model_missing'
    | 'conflict'

export class TranscriptionError extends Error {
    constructor(
        public code: TranscriptionErrorCode,
        message: string,
        public status: number,
        public extra?: Record<string, unknown>,
    ) {
        super(message)
        this.name = 'TranscriptionError'
    }
}

/** Map a TranscriptionError to the `{ status, body }` a route returns. */
export function httpErrorFor(err: TranscriptionError): { status: number; body: Record<string, unknown> } {
    return { status: err.status, body: { error: err.message, code: err.code, ...err.extra } }
}

function isAdmin(actor: Actor): boolean {
    return actor.role === 'admin'
}

/** Ownership rule (spec §8): someone else's transcription is a 404, never a 403. */
function visible(actor: Actor, t: TranscriptionListItem): boolean {
    return isAdmin(actor) || t.ownerId === actor.githubId
}

// ── upload / create (spec §4.1, §7) ───────────────────────────────────────────

export interface UploadMeta extends UploadOptionsInput {
    filename: string
    force?: boolean
    /** Content-Length when the request carried one (pre-checked by the route). */
    declaredBytes?: number
}

/** Streaming sha256 + byte counter + mid-stream cap enforcement (spec §4.1). */
function meteredStream(cap: number) {
    const hash = crypto.createHash('sha256')
    let bytes = 0
    const transform = new Transform({
        transform(chunk: Buffer, _enc, cb) {
            bytes += chunk.length
            if (bytes > cap) {
                cb(new TranscriptionError('too_large', `upload exceeds ${Math.round(cap / 1024 / 1024)} MB cap`, 413))
                return
            }
            hash.update(chunk)
            cb(null, chunk)
        },
    })
    return { transform, digest: () => hash.digest('hex'), bytes: () => bytes }
}

/**
 * Create a transcription from an upload stream. Flow (spec §7): quota pre-check
 * (DB SUM) → stream to disk computing sha256 → ffprobe validation → per-owner
 * duplicate check → insert row (pending). Any failure after the file hits disk
 * deletes the media directory (all-or-nothing).
 */
export async function createFromUpload(
    actor: Actor,
    file: Readable,
    meta: UploadMeta,
): Promise<{ id: string }> {
    const ext = extensionOf(meta.filename)
    if (!ext || !isAcceptedExtension(ext)) {
        throw new TranscriptionError('invalid', `unsupported file type '.${ext ?? ''}'`, 422)
    }
    const options = validateUploadOptions(meta, config.allowedModels, config.defaultModel)
    if (!options.ok) throw new TranscriptionError('invalid', options.error.message, 422)

    // Model must be present on disk before the job can queue (spec §5.5 — 409
    // with a pointer to the model manager).
    if (!(await isPresent(options.value.model))) {
        throw new TranscriptionError(
            'model_missing',
            `model '${options.value.model}' is not downloaded — an admin can fetch it under Admin → Models`,
            409,
        )
    }

    // Quota pre-check from the DB (spec §6.5); admins exempt.
    const used = repo.sumMediaBytes(actor.githubId)
    const incoming = meta.declaredBytes ?? 0
    const quota = checkQuota(used, incoming, config.userQuotaBytes, actor.role)
    if (!quota.allowed) {
        throw new TranscriptionError(
            'quota_exceeded',
            `storage quota exceeded (${Math.round(used / 1024 / 1024)} MB used of ${Math.round(config.userQuotaBytes / 1024 / 1024)} MB)`,
            413,
        )
    }

    const id = ID.transcription()
    const dest = fsMedia.originalPath(id, ext)
    const meter = meteredStream(config.maxUploadBytes)

    try {
        await fsMedia.streamToFile(file.pipe(meter.transform), dest)
        const bytes = meter.bytes()
        const sha256 = meter.digest()

        // Post-stream quota check with the REAL size (Content-Length can lie or
        // be absent on chunked uploads).
        const finalQuota = checkQuota(used, bytes, config.userQuotaBytes, actor.role)
        if (!finalQuota.allowed) {
            throw new TranscriptionError('quota_exceeded', 'storage quota exceeded', 413)
        }

        // TRUE validation: ffprobe on the stored file (spec §4.1).
        let probed
        try {
            probed = await ffmpeg.probe(dest)
        } catch {
            throw new TranscriptionError('no_audio', 'file could not be decoded', 422)
        }
        if (!probed.hasAudio) {
            throw new TranscriptionError('no_audio', 'no decodable audio stream in the file', 422)
        }
        if (probed.durationSeconds !== null && probed.durationSeconds > config.maxDurationSeconds) {
            throw new TranscriptionError(
                'too_long',
                `audio is longer than the ${Math.round(config.maxDurationSeconds / 60)} minute cap`,
                422,
            )
        }

        // Per-owner duplicate check (spec §5.6): 409 { duplicateOf } unless force.
        const dup = repo.findDuplicate(actor.githubId, sha256)
        if (dup && !meta.force) {
            throw new TranscriptionError('duplicate', 'you already transcribed this file', 409, {
                duplicateOf: dup.id,
            })
        }

        const now = new Date().toISOString()
        const row: Transcription = {
            id,
            ownerId: actor.githubId,
            title: options.value.title || titleFromFilename(meta.filename),
            originalFilename: meta.filename.slice(0, 300),
            mediaExt: ext,
            mediaBytes: bytes,
            mediaSha256: sha256,
            durationSeconds: probed.durationSeconds,
            language: options.value.language,
            detectedLanguage: null,
            translate: options.value.translate,
            model: options.value.model,
            status: 'pending',
            progress: 0,
            error: null,
            createdAt: now,
            startedAt: null,
            finishedAt: null,
        }
        repo.insert(row)
        publishJobUpdate({ id, ownerId: actor.githubId, status: 'pending', progress: 0 })
        return { id }
    } catch (err) {
        // All-or-nothing: no orphaned files on any failure path.
        await fsMedia.removeMediaDir(id).catch(() => {})
        throw err
    }
}

// ── list / get ────────────────────────────────────────────────────────────────

export interface ListParams {
    status?: TranscriptionStatus
    language?: string
    model?: string
    q?: string
    /** Admin-only owner filter (github id). */
    owner?: number
    page: number
    pageSize: number
}

export interface ListResponse {
    items: TranscriptionListItem[]
    total: number
    page: number
    pageSize: number
}

export function list(actor: Actor, params: ListParams): ListResponse {
    const ownerId = isAdmin(actor) ? params.owner : actor.githubId
    const { items, total } = repo.list({
        ownerId,
        status: params.status,
        language: params.language,
        model: params.model,
        q: params.q,
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
    })
    // Queue positions for pending rows ("#3 in queue", spec §4.2).
    const pending = repo.pendingIdsOldestFirst()
    const withPositions = items.map((item) =>
        item.status === 'pending' ? { ...item, queuePosition: queuePosition(pending, item.id) } : item,
    )
    return { items: withPositions, total, page: params.page, pageSize: params.pageSize }
}

function mustGet(actor: Actor, id: string): TranscriptionListItem {
    fsMedia.assertTranscriptionId(id)
    const t = repo.get(id)
    if (!t || !visible(actor, t)) throw new TranscriptionError('not_found', 'not found', 404)
    return t
}

/** Detail + segments (parsed from transcript.json on request, spec §4.4). */
export async function get(actor: Actor, id: string): Promise<TranscriptionDetail> {
    const t = mustGet(actor, id)
    let segments: TranscriptionDetail['segments'] = []
    let text = ''
    if (t.status === 'done') {
        try {
            const raw = await fsp.readFile(fsMedia.transcriptPath(id, 'json'), 'utf8')
            segments = parseWhisperJson(raw).segments
        } catch {
            /* artifacts missing — segments stay empty */
        }
        try {
            text = await fsp.readFile(fsMedia.transcriptPath(id, 'txt'), 'utf8')
        } catch {
            /* ditto */
        }
    }
    const pending = repo.pendingIdsOldestFirst()
    return {
        ...t,
        ...(t.status === 'pending' ? { queuePosition: queuePosition(pending, id) } : {}),
        segments,
        text: text.trim(),
    }
}

// ── mutations ─────────────────────────────────────────────────────────────────

export function rename(actor: Actor, id: string, title: string): void {
    mustGet(actor, id)
    repo.rename(id, title)
}

/** failed → pending with a full field reset (spec §4.2). */
export function retry(actor: Actor, id: string): void {
    const t = mustGet(actor, id)
    if (!canRetry(t.status)) {
        throw new TranscriptionError('conflict', `cannot retry a ${t.status} transcription`, 409)
    }
    repo.resetToPending(id)
    publishJobUpdate({ id, ownerId: t.ownerId, status: 'pending', progress: 0 })
}

/** Delete row (+ FTS, same tx) then the media directory (spec §6.5). */
export async function remove(actor: Actor, id: string): Promise<void> {
    const t = mustGet(actor, id)
    if (!canDelete(t.status)) {
        throw new TranscriptionError('conflict', 'cannot delete while processing', 409)
    }
    tx(() => repo.remove(id))
    await fsMedia.removeMediaDir(id)
}

// ── downloads (spec §4.4) ─────────────────────────────────────────────────────

export interface ArtifactInfo {
    path: string
    size: number
    contentType: string
    filename: string
}

const TRANSCRIPT_TYPES: Record<TranscriptFormat, string> = {
    txt: 'text/plain; charset=utf-8',
    srt: 'application/x-subrip',
    vtt: 'text/vtt; charset=utf-8',
    json: 'application/json; charset=utf-8',
}

const AUDIO_TYPES: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    opus: 'audio/opus',
    webm: 'video/webm',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
}

/** Ownership-checked artifact lookup; the route streams it (Range on audio). */
export async function artifactInfo(
    actor: Actor,
    id: string,
    kind: 'audio' | TranscriptFormat,
): Promise<ArtifactInfo> {
    const t = mustGet(actor, id)
    if (kind === 'audio') {
        const p = fsMedia.originalPath(id, t.mediaExt)
        const stat = await fsp.stat(p).catch(() => null)
        if (!stat) throw new TranscriptionError('not_found', 'media file missing', 404)
        return {
            path: p,
            size: stat.size,
            contentType: AUDIO_TYPES[t.mediaExt] ?? 'application/octet-stream',
            filename: t.originalFilename,
        }
    }
    if (t.status !== 'done') throw new TranscriptionError('conflict', 'transcript not ready', 409)
    const p = fsMedia.transcriptPath(id, kind)
    const stat = await fsp.stat(p).catch(() => null)
    if (!stat) throw new TranscriptionError('not_found', 'transcript artifact missing', 404)
    const base = t.title.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'transcript'
    return { path: p, size: stat.size, contentType: TRANSCRIPT_TYPES[kind], filename: `${base}.${kind}` }
}
