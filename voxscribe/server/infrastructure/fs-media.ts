// Filesystem layout + safe path derivation (spec §6.1, §6.4). Every artifact
// path is DERIVED from a validated id — never a stored user-controlled path —
// so path traversal is structurally impossible. This module does NOT compute
// per-owner disk usage: the fs layout has no owner info; quota accounting is
// SUM(media_bytes) per owner in the DB (§6.5).

import 'server-only'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'
import { config } from '@/server/config'

export class UnsafePathError extends Error {
    constructor(id: string) {
        super(`unsafe id: ${id}`)
        this.name = 'UnsafePathError'
    }
}

const TRN_ID = /^trn_[0-9a-z]+$/
const NTE_ID = /^nte_[0-9a-z]+$/
// Extensions come from the accepted-container list; re-validated before joining.
const SAFE_EXT = /^[0-9a-z]{1,5}$/

export function assertTranscriptionId(id: string): void {
    if (!TRN_ID.test(id)) throw new UnsafePathError(id)
}

export function assertNoteId(id: string): void {
    if (!NTE_ID.test(id)) throw new UnsafePathError(id)
}

export function mediaRoot(): string {
    return path.join(config.workspaceDir, 'media')
}

export function notesRoot(): string {
    return path.join(config.workspaceDir, 'notes')
}

/** `${WORKSPACE_DIR}/media/<trn_id>/` — the per-transcription artifact directory. */
export function mediaDir(id: string): string {
    assertTranscriptionId(id)
    return path.join(mediaRoot(), id)
}

export function originalPath(id: string, ext: string): string {
    if (!SAFE_EXT.test(ext)) throw new UnsafePathError(ext)
    return path.join(mediaDir(id), `original.${ext}`)
}

/** The transcode intermediate — deleted after every job. */
export function wavPath(id: string): string {
    return path.join(mediaDir(id), 'audio.wav')
}

/** `transcript.<txt|srt|vtt|json>`. */
export function transcriptPath(id: string, format: 'txt' | 'srt' | 'vtt' | 'json'): string {
    return path.join(mediaDir(id), `transcript.${format}`)
}

/** `${WORKSPACE_DIR}/notes/<nte_id>.md`. */
export function notePath(id: string): string {
    assertNoteId(id)
    return path.join(notesRoot(), `${id}.md`)
}

/** Temp path for crash-safe note updates (write → tx → atomic rename, §4.5). */
export function noteTmpPath(id: string): string {
    return `${notePath(id)}.tmp`
}

/** Stream an upload to disk, creating the directory. Returns bytes written. */
export async function streamToFile(source: Readable, dest: string): Promise<void> {
    await fsp.mkdir(path.dirname(dest), { recursive: true })
    await pipeline(source, fs.createWriteStream(dest, { flags: 'w', mode: 0o600 }))
}

/** Recursively delete a transcription's media directory (idempotent). */
export async function removeMediaDir(id: string): Promise<void> {
    await fsp.rm(mediaDir(id), { recursive: true, force: true })
}

/** Delete a single file, ignoring absence. */
export async function removeFile(p: string): Promise<void> {
    await fsp.rm(p, { force: true })
}

/** Delete stale artifacts from an earlier attempt before a (re-)run (spec §4.2). */
export async function removeStaleArtifacts(id: string): Promise<void> {
    for (const f of ['transcript.txt', 'transcript.srt', 'transcript.vtt', 'transcript.json', 'audio.wav']) {
        await fsp.rm(path.join(mediaDir(id), f), { force: true })
    }
}
