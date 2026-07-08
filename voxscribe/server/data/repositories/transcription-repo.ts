// Transcription repository — all SQL for the `transcription` table and its FTS
// sidecar `transcript_fts` (spec §6.2). Ownership filtering is parameterized
// (`ownerId?`) — the SERVICE decides whether to pass it (standard user) or not
// (admin); this layer just executes.

import 'server-only'
import { prep, getRow, allRows, tx } from '@/server/data/db'
import type { Transcription, TranscriptionListItem, TranscriptionStatus } from '@/server/domain/types'

interface Raw {
    id: string
    owner_id: number
    title: string
    original_filename: string
    media_ext: string
    media_bytes: number
    media_sha256: string
    duration_seconds: number | null
    language: string
    detected_language: string | null
    translate: number
    model: string
    status: string
    progress: number
    error: string | null
    created_at: string
    started_at: string | null
    finished_at: string | null
    owner_login?: string
}

function map(r: Raw): TranscriptionListItem {
    return {
        id: r.id,
        ownerId: r.owner_id,
        title: r.title,
        originalFilename: r.original_filename,
        mediaExt: r.media_ext,
        mediaBytes: r.media_bytes,
        mediaSha256: r.media_sha256,
        durationSeconds: r.duration_seconds,
        language: r.language,
        detectedLanguage: r.detected_language,
        translate: Boolean(r.translate),
        model: r.model,
        status: r.status as TranscriptionStatus,
        progress: r.progress,
        error: r.error,
        createdAt: r.created_at,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
        ...(r.owner_login ? { ownerLogin: r.owner_login } : {}),
    }
}

const SELECT = `SELECT t.*, u.login AS owner_login FROM transcription t
                LEFT JOIN app_user u ON u.github_id = t.owner_id`

export function insert(t: Transcription): void {
    prep(
        `INSERT INTO transcription (
            id, owner_id, title, original_filename, media_ext, media_bytes, media_sha256,
            duration_seconds, language, detected_language, translate, model,
            status, progress, error, created_at, started_at, finished_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        t.id,
        t.ownerId,
        t.title,
        t.originalFilename,
        t.mediaExt,
        t.mediaBytes,
        t.mediaSha256,
        t.durationSeconds,
        t.language,
        t.detectedLanguage,
        t.translate ? 1 : 0,
        t.model,
        t.status,
        t.progress,
        t.error,
        t.createdAt,
        t.startedAt,
        t.finishedAt,
    )
}

export function get(id: string): TranscriptionListItem | undefined {
    const r = getRow<Raw>(`${SELECT} WHERE t.id = ?`, id)
    return r ? map(r) : undefined
}

export interface ListFilter {
    /** Restrict to one owner (standard users always; admins via `?owner=`). */
    ownerId?: number
    status?: TranscriptionStatus
    language?: string
    model?: string
    /** FTS query over transcript content + title substring match. */
    q?: string
    limit: number
    offset: number
}

/** Escape a user string for a safe FTS5 MATCH: each term becomes a quoted phrase. */
function ftsQuery(q: string): string {
    return q
        .split(/\s+/)
        .filter(Boolean)
        .map((term) => `"${term.replace(/"/g, '""')}"`)
        .join(' ')
}

export interface ListResult {
    items: TranscriptionListItem[]
    total: number
}

export function list(filter: ListFilter): ListResult {
    const where: string[] = []
    const params: any[] = []
    if (filter.ownerId !== undefined) {
        where.push('t.owner_id = ?')
        params.push(filter.ownerId)
    }
    if (filter.status) {
        where.push('t.status = ?')
        params.push(filter.status)
    }
    if (filter.language) {
        where.push('(t.language = ? OR t.detected_language = ?)')
        params.push(filter.language, filter.language)
    }
    if (filter.model) {
        where.push('t.model = ?')
        params.push(filter.model)
    }

    // Search: FTS over spoken content + title substring, with snippets for FTS
    // hits (spec §5.1). Snippets are fetched first, keyed by id.
    const snippets = new Map<string, string>()
    if (filter.q && filter.q.trim() !== '') {
        const match = ftsQuery(filter.q)
        if (match) {
            for (const row of allRows<{ transcription_id: string; snip: string }>(
                `SELECT transcription_id, snippet(transcript_fts, 1, '<mark>', '</mark>', '…', 12) AS snip
                 FROM transcript_fts WHERE transcript_fts MATCH ?`,
                match,
            )) {
                snippets.set(row.transcription_id, row.snip)
            }
        }
        const escaped = filter.q.trim().replace(/[\\%_]/g, '\\$&')
        if (snippets.size > 0) {
            const placeholders = [...snippets.keys()].map(() => '?').join(',')
            where.push(`(t.title LIKE ? ESCAPE '\\' OR t.id IN (${placeholders}))`)
            params.push(`%${escaped}%`, ...snippets.keys())
        } else {
            where.push(`t.title LIKE ? ESCAPE '\\'`)
            params.push(`%${escaped}%`)
        }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const totalRow = getRow<{ n: number }>(
        `SELECT COUNT(*) AS n FROM transcription t ${whereSql}`,
        ...params,
    )
    const rows = allRows<Raw>(
        `${SELECT} ${whereSql} ORDER BY t.created_at DESC, t.id DESC LIMIT ? OFFSET ?`,
        ...params,
        filter.limit,
        filter.offset,
    )
    const items = rows.map((r) => {
        const item = map(r)
        const snip = snippets.get(r.id)
        return snip ? { ...item, snippet: snip } : item
    })
    return { items, total: totalRow?.n ?? 0 }
}

/** Pending ids oldest-first (the claim order) — queue-position derivation. */
export function pendingIdsOldestFirst(): string[] {
    return allRows<{ id: string }>(
        `SELECT id FROM transcription WHERE status = 'pending' ORDER BY created_at, id`,
    ).map((r) => r.id)
}

/**
 * Claim the oldest pending job: atomically flips it to `processing` and returns
 * it. Runs inside `tx()` so two ticks can't claim the same row.
 */
export function claimOldestPending(now: string): TranscriptionListItem | undefined {
    return tx(() => {
        const row = getRow<{ id: string }>(
            `SELECT id FROM transcription WHERE status = 'pending' ORDER BY created_at, id LIMIT 1`,
        )
        if (!row) return undefined
        prep(
            `UPDATE transcription SET status = 'processing', progress = 0, error = NULL, started_at = ?, finished_at = NULL
             WHERE id = ? AND status = 'pending'`,
        ).run(now, row.id)
        return get(row.id)
    })
}

export function setProgress(id: string, progress: number): void {
    prep('UPDATE transcription SET progress = ? WHERE id = ?').run(progress, id)
}

export function markDone(
    id: string,
    finishedAt: string,
    durationSeconds: number | null,
    detectedLanguage: string | null,
): void {
    prep(
        `UPDATE transcription SET status = 'done', progress = 100, error = NULL, finished_at = ?,
            duration_seconds = COALESCE(?, duration_seconds), detected_language = ?
         WHERE id = ?`,
    ).run(finishedAt, durationSeconds, detectedLanguage, id)
}

export function markFailed(id: string, finishedAt: string, error: string): void {
    prep(`UPDATE transcription SET status = 'failed', error = ?, finished_at = ? WHERE id = ?`).run(
        error.slice(0, 500),
        finishedAt,
        id,
    )
}

/** Retry / crash-recovery reset (spec §4.2): back to pending with a clean slate. */
export function resetToPending(id: string): void {
    prep(
        `UPDATE transcription SET status = 'pending', progress = 0, error = NULL,
            started_at = NULL, finished_at = NULL
         WHERE id = ?`,
    ).run(id)
}

/** Ids stuck in `processing` (crash recovery, boot-time). */
export function stuckProcessingIds(): string[] {
    return allRows<{ id: string }>(`SELECT id FROM transcription WHERE status = 'processing'`).map((r) => r.id)
}

export function setDuration(id: string, durationSeconds: number): void {
    prep('UPDATE transcription SET duration_seconds = ? WHERE id = ?').run(durationSeconds, id)
}

export function rename(id: string, title: string): void {
    prep('UPDATE transcription SET title = ? WHERE id = ?').run(title, id)
}

export function remove(id: string): void {
    tx(() => {
        prep('DELETE FROM transcript_fts WHERE transcription_id = ?').run(id)
        prep('DELETE FROM transcription WHERE id = ?').run(id)
    })
}

/** Per-owner media usage for the quota check (spec §6.5) — the fs has no owner info. */
export function sumMediaBytes(ownerId: number): number {
    const r = getRow<{ n: number | null }>(
        'SELECT SUM(media_bytes) AS n FROM transcription WHERE owner_id = ?',
        ownerId,
    )
    return r?.n ?? 0
}

/** Per-owner duplicate lookup (spec §5.6): same hash, same owner, not failed. */
export function findDuplicate(ownerId: number, sha256: string): TranscriptionListItem | undefined {
    const r = getRow<Raw>(
        `${SELECT} WHERE t.owner_id = ? AND t.media_sha256 = ? AND t.status != 'failed'
         ORDER BY t.created_at DESC LIMIT 1`,
        ownerId,
        sha256,
    )
    return r ? map(r) : undefined
}

/** True when any `processing` job uses this model (blocks model deletion). */
export function modelInUse(model: string): boolean {
    const r = getRow<{ n: number }>(
        `SELECT COUNT(*) AS n FROM transcription WHERE status = 'processing' AND model = ?`,
        model,
    )
    return (r?.n ?? 0) > 0
}

// ── FTS sidecar ───────────────────────────────────────────────────────────────

export function ftsInsert(id: string, content: string): void {
    // Replace-not-append: a retried job re-indexes without duplicating rows.
    prep('DELETE FROM transcript_fts WHERE transcription_id = ?').run(id)
    prep('INSERT INTO transcript_fts (transcription_id, content) VALUES (?, ?)').run(id, content)
}

// ── dashboard aggregates (spec §6.5 stats) ────────────────────────────────────

export interface Aggregates {
    total: number
    minutes: number
    queued: number
    failed: number
    diskUsedBytes: number
}

export function aggregates(ownerId?: number): Aggregates {
    const where = ownerId !== undefined ? 'WHERE owner_id = ?' : ''
    const params = ownerId !== undefined ? [ownerId] : []
    const r = getRow<{
        total: number
        minutes: number | null
        queued: number
        failed: number
        disk: number | null
    }>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'done' THEN duration_seconds ELSE 0 END) / 60.0 AS minutes,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS queued,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
                SUM(media_bytes) AS disk
         FROM transcription ${where}`,
        ...params,
    )
    return {
        total: r?.total ?? 0,
        minutes: Math.round(r?.minutes ?? 0),
        queued: r?.queued ?? 0,
        failed: r?.failed ?? 0,
        diskUsedBytes: r?.disk ?? 0,
    }
}

/** The currently processing job (concurrency is 1, so at most one row). */
export function currentProcessing(ownerId?: number): TranscriptionListItem | undefined {
    const where = ownerId !== undefined ? `WHERE t.status = 'processing' AND t.owner_id = ?` : `WHERE t.status = 'processing'`
    const params = ownerId !== undefined ? [ownerId] : []
    const r = getRow<Raw>(`${SELECT} ${where} ORDER BY t.started_at LIMIT 1`, ...params)
    return r ? map(r) : undefined
}

/** All media directory ids — the sweep compares the fs against this set. */
export function allIds(): Set<string> {
    return new Set(allRows<{ id: string }>('SELECT id FROM transcription').map((r) => r.id))
}
