// Note validation + tag normalization (spec §4.5, §6.3) — pure and
// client-shared so the editor shows the same errors the API enforces.

import type { ValidationResult } from './upload-validation'

export const NOTE_TITLE_MAX_CHARS = 200
export const NOTE_MAX_TAGS = 20
export const NOTE_CONTENT_MAX_BYTES = 1024 * 1024 // 1 MB hard cap (not env — a note that big is a mistake)
export const TAG_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/

export interface NoteInput {
    title?: unknown
    date?: unknown
    tags?: unknown
    content?: unknown
}

export interface ValidNote {
    title: string
    /** 'YYYY-MM-DD'. */
    date: string
    /** Normalized, deduplicated, sorted. */
    tags: string[]
    content: string
    contentBytes: number
}

/**
 * Normalize a raw tag: trim, lowercase, collapse whitespace/underscores to `-`,
 * squeeze repeated dashes, strip leading/trailing dashes. Returns '' when
 * nothing survives — the caller then rejects it against TAG_PATTERN.
 */
export function normalizeTag(raw: string): string {
    return raw
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '')
}

/** A calendar-valid 'YYYY-MM-DD' (rejects 2026-02-31 and friends). */
export function isValidNoteDate(raw: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false
    const [y, m, d] = raw.split('-').map(Number)
    if (m < 1 || m > 12 || d < 1) return false
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return d <= daysInMonth
}

/** UTF-8 byte length, isomorphic (TextEncoder exists in browsers and Node). */
export function byteLength(text: string): number {
    return new TextEncoder().encode(text).length
}

export function validateNote(input: NoteInput): ValidationResult<ValidNote> {
    if (typeof input.title !== 'string' || input.title.trim() === '') {
        return { ok: false, error: { field: 'title', message: 'title is required' } }
    }
    const title = input.title.trim()
    if (title.length > NOTE_TITLE_MAX_CHARS) {
        return {
            ok: false,
            error: { field: 'title', message: `title must be at most ${NOTE_TITLE_MAX_CHARS} characters` },
        }
    }

    if (typeof input.date !== 'string' || !isValidNoteDate(input.date)) {
        return { ok: false, error: { field: 'date', message: 'date must be a valid YYYY-MM-DD' } }
    }

    const rawTags = input.tags === undefined || input.tags === null ? [] : input.tags
    if (!Array.isArray(rawTags) || rawTags.some((t) => typeof t !== 'string')) {
        return { ok: false, error: { field: 'tags', message: 'tags must be an array of strings' } }
    }
    const tags: string[] = []
    for (const raw of rawTags as string[]) {
        const tag = normalizeTag(raw)
        if (!TAG_PATTERN.test(tag)) {
            return {
                ok: false,
                error: {
                    field: 'tags',
                    message: `invalid tag '${raw}' — tags are lowercase letters, digits and dashes (max 40 chars)`,
                },
            }
        }
        if (!tags.includes(tag)) tags.push(tag)
    }
    if (tags.length > NOTE_MAX_TAGS) {
        return { ok: false, error: { field: 'tags', message: `at most ${NOTE_MAX_TAGS} tags` } }
    }
    tags.sort()

    if (typeof input.content !== 'string') {
        return { ok: false, error: { field: 'content', message: 'content must be a string' } }
    }
    const contentBytes = byteLength(input.content)
    if (contentBytes > NOTE_CONTENT_MAX_BYTES) {
        return { ok: false, error: { field: 'content', message: 'content exceeds 1 MB' } }
    }

    return { ok: true, value: { title, date: input.date, tags, content: input.content, contentBytes } }
}

/** Download filename: `<date>-<title-slug>.md` (spec §4.5). */
export function noteDownloadFilename(noteDate: string, title: string): string {
    const slug =
        title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || 'note'
    return `${noteDate}-${slug}.md`
}
