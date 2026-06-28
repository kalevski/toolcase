// Notes service (planning §1, §9, §11). Project-level revealable sensitive
// free-form data: developer+ may read/create/edit/delete; content is encrypted
// at rest (AES-256-GCM via cipher) and only the audited reveal path decrypts it.
// Every operation is scoped by projectId so a note id from another project 404s.

import 'server-only'
import * as noteRepo from '@/server/data/repositories/note-repo'
import { encrypt, decrypt } from '@/server/infrastructure/cipher'
import { ID } from '@/server/infrastructure/ids'
import type { NoteMeta } from '@/server/domain/types'

export class NoteNotFoundError extends Error {}

export function listNotes(projectId: string): NoteMeta[] {
    return noteRepo.listByProject(projectId)
}

/** Resolve a note that must belong to `projectId`, else throw. */
function requireNote(projectId: string, id: string): NoteMeta {
    const note = noteRepo.byId(id)
    if (!note || note.projectId !== projectId) throw new NoteNotFoundError()
    return note
}

export function createNote(
    projectId: string,
    fields: { title: string; content: string },
    createdBy: number,
): NoteMeta {
    const title = fields.title.trim()
    if (!title) throw new Error('title required')
    const now = new Date().toISOString()
    const id = ID.note()
    noteRepo.insert({
        id,
        projectId,
        title,
        contentEnc: encrypt(fields.content ?? ''),
        createdBy,
        createdAt: now,
        updatedAt: now,
    })
    return requireNote(projectId, id)
}

export function updateNote(
    projectId: string,
    id: string,
    fields: { title?: string; content?: string },
): NoteMeta {
    requireNote(projectId, id)
    const patch: { title?: string; contentEnc?: string; updatedAt: string } = {
        updatedAt: new Date().toISOString(),
    }
    if (fields.title !== undefined) {
        const title = fields.title.trim()
        if (!title) throw new Error('title required')
        patch.title = title
    }
    if (fields.content !== undefined) {
        patch.contentEnc = encrypt(fields.content)
    }
    noteRepo.update(id, patch)
    return requireNote(projectId, id)
}

export function deleteNote(projectId: string, id: string): void {
    requireNote(projectId, id)
    noteRepo.remove(id)
}

/** Decrypt and return one note's plaintext content — callers must audit this. */
export function revealNote(projectId: string, id: string): string {
    requireNote(projectId, id)
    const enc = noteRepo.contentEnc(id)
    if (enc === undefined) throw new NoteNotFoundError()
    return decrypt(enc)
}
