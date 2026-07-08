// Notes service (spec §4.5, §6.5). Content is a real `.md` file on disk
// (source of truth); the DB row holds metadata + tags; `note_fts` powers
// search. Write discipline:
//   create — file first, then row + tags + FTS in one tx (file deleted if the
//            tx throws);
//   update — write `<id>.md.tmp`, run the tx, atomically rename over the
//            original on commit (tmp deleted on failure) — never delete-on-
//            failure here, that would destroy the previous content;
//   delete — tx first, then file removal.

import 'server-only'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { tx } from '@/server/data/db'
import * as noteRepo from '@/server/data/repositories/note-repo'
import * as tagRepo from '@/server/data/repositories/tag-repo'
import * as fsMedia from '@/server/infrastructure/fs-media'
import { ID } from '@/server/infrastructure/ids'
import { validateNote, noteDownloadFilename, type NoteInput } from '@/server/domain/note-validation'
import type { NoteDetail, NoteListItem, Role, TagCount } from '@/server/domain/types'

export interface Actor {
    githubId: number
    login: string
    role: Role
}

export class NoteError extends Error {
    constructor(
        public code: 'not_found' | 'invalid',
        message: string,
        public status: number,
        public field?: string,
    ) {
        super(message)
        this.name = 'NoteError'
    }
}

export function httpErrorFor(err: NoteError): { status: number; body: Record<string, unknown> } {
    return { status: err.status, body: { error: err.message, code: err.code, ...(err.field ? { field: err.field } : {}) } }
}

function isAdmin(actor: Actor): boolean {
    return actor.role === 'admin'
}

/** Ownership rule (spec §8): someone else's note is a 404, never a 403. */
function mustGet(actor: Actor, id: string): NoteListItem {
    fsMedia.assertNoteId(id)
    const note = noteRepo.get(id)
    if (!note || (!isAdmin(actor) && note.ownerId !== actor.githubId)) {
        throw new NoteError('not_found', 'not found', 404)
    }
    return note
}

/** Diff-relink tags inside the caller's tx: upsert+link added, unlink removed, GC orphans. */
function syncTags(noteId: string, nextTags: string[]): void {
    const current = noteRepo.tagsOf(noteId)
    for (const name of nextTags) {
        if (!current.includes(name)) noteRepo.link(noteId, tagRepo.upsert(name))
    }
    let removed = false
    for (const name of current) {
        if (!nextTags.includes(name)) {
            const tagId = tagRepo.idOf(name)
            if (tagId !== undefined) {
                noteRepo.unlink(noteId, tagId)
                removed = true
            }
        }
    }
    if (removed) tagRepo.gcOrphans()
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function create(actor: Actor, input: NoteInput): Promise<{ id: string }> {
    const valid = validateNote(input)
    if (!valid.ok) throw new NoteError('invalid', valid.error.message, 422, valid.error.field)
    const { title, date, tags, content, contentBytes } = valid.value

    const id = ID.note()
    const file = fsMedia.notePath(id)
    await fsp.mkdir(path.dirname(file), { recursive: true })
    await fsp.writeFile(file, content, 'utf8')
    try {
        tx(() => {
            const now = new Date().toISOString()
            noteRepo.insert({
                id,
                ownerId: actor.githubId,
                title,
                noteDate: date,
                contentBytes,
                createdAt: now,
                updatedAt: now,
            })
            syncTags(id, tags)
            noteRepo.ftsUpsert(id, title, content)
        })
    } catch (err) {
        await fsp.rm(file, { force: true }).catch(() => {})
        throw err
    }
    return { id }
}

export async function update(actor: Actor, id: string, input: NoteInput): Promise<void> {
    mustGet(actor, id)
    const valid = validateNote(input)
    if (!valid.ok) throw new NoteError('invalid', valid.error.message, 422, valid.error.field)
    const { title, date, tags, content, contentBytes } = valid.value

    // Crash-safe update (spec §4.5): tmp file → tx → atomic rename on commit.
    const tmp = fsMedia.noteTmpPath(id)
    await fsp.writeFile(tmp, content, 'utf8')
    try {
        tx(() => {
            noteRepo.update(id, title, date, contentBytes, new Date().toISOString())
            syncTags(id, tags)
            noteRepo.ftsUpsert(id, title, content)
        })
    } catch (err) {
        await fsp.rm(tmp, { force: true }).catch(() => {})
        throw err
    }
    await fsp.rename(tmp, fsMedia.notePath(id))
}

export async function remove(actor: Actor, id: string): Promise<void> {
    mustGet(actor, id)
    // tx first (unlinks cascade via FK; GC orphaned tag rows; FTS + row), then file.
    tx(() => {
        syncTags(id, [])
        noteRepo.remove(id)
    })
    await fsp.rm(fsMedia.notePath(id), { force: true }).catch(() => {})
}

// ── read ──────────────────────────────────────────────────────────────────────

export interface NoteListParams {
    /** Normalized tag names, AND semantics (spec §4.5). */
    tags?: string[]
    from?: string
    to?: string
    q?: string
    /** Admin-only owner filter (github id). */
    owner?: number
    page: number
    pageSize: number
}

export interface NoteListResponse {
    items: NoteListItem[]
    total: number
    page: number
    pageSize: number
}

export function list(actor: Actor, params: NoteListParams): NoteListResponse {
    const ownerId = isAdmin(actor) ? params.owner : actor.githubId
    const { items, total } = noteRepo.list({
        ownerId,
        tags: params.tags,
        from: params.from,
        to: params.to,
        q: params.q,
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
    })
    return { items, total, page: params.page, pageSize: params.pageSize }
}

export async function get(actor: Actor, id: string): Promise<NoteDetail> {
    const note = mustGet(actor, id)
    let content = ''
    try {
        content = await fsp.readFile(fsMedia.notePath(id), 'utf8')
    } catch {
        /* file missing (should not happen) — surface empty content, not a 500 */
    }
    return { ...note, content }
}

/** Raw `.md` download info (spec §4.5). */
export async function downloadInfo(actor: Actor, id: string): Promise<{ path: string; filename: string }> {
    const note = mustGet(actor, id)
    const p = fsMedia.notePath(id)
    const stat = await fsp.stat(p).catch(() => null)
    if (!stat) throw new NoteError('not_found', 'note file missing', 404)
    return { path: p, filename: noteDownloadFilename(note.noteDate, note.title) }
}

/** Tag suggestions with usage counts, scoped to the actor's notes (admin: all). */
export function listTags(actor: Actor): TagCount[] {
    return tagRepo.listWithCounts(isAdmin(actor) ? undefined : actor.githubId)
}
