// Shared domain types (spec §6.3). Client-shared — NO node imports and no
// 'server-only' marker: these types flow into 'use client' components.

// ── roles / identity ──────────────────────────────────────────────────────────

export type Role = 'guest' | 'standard' | 'admin'

export const ROLE_RANK: Record<Role, number> = { guest: 0, standard: 1, admin: 2 }

export const ROLE_LABEL: Record<Role, string> = {
    guest: 'Guest',
    standard: 'Standard',
    admin: 'Admin',
}

export interface SessionPayload {
    /** GitHub numeric id. */
    sub: number
    login: string
    role: Role
    iat: number
    exp: number
}

export interface AppUser {
    githubId: number
    login: string
    name: string
    avatarUrl?: string
    role: Role
    addedAt: string
}

export interface MeResponse {
    githubId: number
    login: string
    name: string
    avatarUrl?: string
    role: Role
}

// ── audit ─────────────────────────────────────────────────────────────────────

export interface AuditEntry {
    id: number
    at: string
    githubId: number | null
    login: string | null
    action: string
    detail: string | null
}

// ── transcriptions ────────────────────────────────────────────────────────────

export type TranscriptionStatus = 'pending' | 'processing' | 'done' | 'failed'

/** The whisper.cpp model tiers voxscribe knows about. `large` is never allowed. */
export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large'

export interface Transcription {
    id: string
    ownerId: number
    title: string
    originalFilename: string
    mediaExt: string
    mediaBytes: number
    mediaSha256: string
    durationSeconds: number | null
    /** Requested language ('auto' | ISO 639-1). */
    language: string
    detectedLanguage: string | null
    translate: boolean
    model: string
    status: TranscriptionStatus
    progress: number
    error: string | null
    createdAt: string
    startedAt: string | null
    finishedAt: string | null
}

/** Library-row shape: the row plus admin-only owner attribution + queue position. */
export interface TranscriptionListItem extends Transcription {
    ownerLogin?: string
    /** 1-based position among pending jobs; only set while status = pending. */
    queuePosition?: number
    /** FTS snippet (HTML with <mark> highlights) when the list was searched. */
    snippet?: string
}

export interface TranscriptSegment {
    /** Start offset in seconds. */
    start: number
    /** End offset in seconds. */
    end: number
    text: string
}

export interface TranscriptionDetail extends Transcription {
    ownerLogin?: string
    queuePosition?: number
    segments: TranscriptSegment[]
    text: string
}

export type TranscriptFormat = 'txt' | 'srt' | 'vtt' | 'json'

// ── models (engine blobs) ─────────────────────────────────────────────────────

export interface ModelInfo {
    name: string
    /** Expected download size in bytes (catalog value). */
    sizeBytes: number
    /** Approximate peak RAM (display only). */
    ramHint: string
    allowed: boolean
    present: boolean
    /** Actual on-disk size when present. */
    diskBytes?: number
    /** In-flight download progress 0–100, when a download is running. */
    downloading?: number
}

// ── notes (spec §4.5) ─────────────────────────────────────────────────────────

export interface Note {
    id: string
    ownerId: number
    title: string
    /** The date the note is about, 'YYYY-MM-DD' (user-supplied). */
    noteDate: string
    contentBytes: number
    tags: string[]
    createdAt: string
    updatedAt: string
}

export interface NoteListItem extends Note {
    ownerLogin?: string
    /** FTS snippet (HTML with <mark> highlights) when the list was searched. */
    snippet?: string
}

export interface NoteDetail extends Note {
    ownerLogin?: string
    content: string
}

export interface TagCount {
    name: string
    count: number
}

// ── dashboard ─────────────────────────────────────────────────────────────────

export interface StatsResponse {
    totalTranscriptions: number
    minutesTranscribed: number
    queued: number
    failed: number
    diskUsedBytes: number
    /** The actor's quota (bytes); null = exempt (admin). */
    quotaBytes: number | null
    noteCount: number
    processing: TranscriptionListItem | null
    recent: TranscriptionListItem[]
    recentNotes: NoteListItem[]
}

// ── SSE ───────────────────────────────────────────────────────────────────────

export interface JobUpdatedEvent {
    type: 'job.updated'
    id: string
    ownerId: number
    status: TranscriptionStatus
    progress: number
    error?: string | null
}
