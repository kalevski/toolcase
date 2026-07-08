// Display formatting + whisper JSON parsing (spec §6.3). Pure and client-shared
// (the humanizers run in the browser; the segment parser runs in the service).

import type { TranscriptSegment } from './types'

/** "1.2 GB" / "466 MB" / "75 KB". */
export function humanBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return '—'
    if (bytes < 1024) return `${bytes} B`
    const units = ['KB', 'MB', 'GB', 'TB']
    let value = bytes
    let unit = ''
    for (const u of units) {
        value /= 1024
        unit = u
        if (value < 1024) break
    }
    return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${unit}`
}

/** "1:02:33" / "12:05" / "0:42". */
export function humanDuration(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '—'
    const s = Math.round(seconds)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${m}:${String(sec).padStart(2, '0')}`
}

/** "00:01:02" timestamp for the segment list. */
export function segmentTimestamp(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// ── whisper.cpp full-JSON (-ojf) parsing ─────────────────────────────────────
//
// Shape (whisper.cpp `output_json_full`):
//   { result: { language: 'en' }, transcription: [ { timestamps: {...},
//     offsets: { from: ms, to: ms }, text: ' …' }, … ] }

interface WhisperJson {
    result?: { language?: string }
    transcription?: Array<{
        offsets?: { from?: number; to?: number }
        text?: string
    }>
}

export interface ParsedTranscript {
    detectedLanguage: string | null
    segments: TranscriptSegment[]
}

/**
 * Parse whisper.cpp's full JSON output into display segments. Tolerant: a
 * malformed document yields no segments rather than a throw (the .txt artifact
 * is still the text of record).
 */
export function parseWhisperJson(raw: string): ParsedTranscript {
    let doc: WhisperJson
    try {
        doc = JSON.parse(raw) as WhisperJson
    } catch {
        return { detectedLanguage: null, segments: [] }
    }
    const segments: TranscriptSegment[] = []
    for (const seg of doc.transcription ?? []) {
        const text = (seg.text ?? '').trim()
        if (!text) continue
        segments.push({
            start: (seg.offsets?.from ?? 0) / 1000,
            end: (seg.offsets?.to ?? 0) / 1000,
            text,
        })
    }
    return { detectedLanguage: doc.result?.language ?? null, segments }
}
