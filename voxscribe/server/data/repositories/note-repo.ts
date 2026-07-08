// Note repository — all SQL for `note`, `note_tag` and the FTS sidecar
// `note_fts` (spec §4.5, §6.2). Tag rows live in tag-repo; the link/unlink/GC
// choreography is orchestrated here because it is pure SQL over the join table.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { Note, NoteListItem } from '@/server/domain/types'

interface Raw {
    id: string
    owner_id: number
    title: string
    note_date: string
    content_bytes: number
    created_at: string
    updated_at: string
    owner_login?: string
    tag_csv?: string | null
}

function map(r: Raw): NoteListItem {
    return {
        id: r.id,
        ownerId: r.owner_id,
        title: r.title,
        noteDate: r.note_date,
        contentBytes: r.content_bytes,
        tags: r.tag_csv ? r.tag_csv.split(',') : [],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        ...(r.owner_login ? { ownerLogin: r.owner_login } : {}),
    }
}

// tag_csv aggregates the note's tags in one query (sorted for stable display).
const SELECT = `SELECT n.*, u.login AS owner_login,
                (SELECT GROUP_CONCAT(name) FROM (
                    SELECT tg.name FROM note_tag nt JOIN tag tg ON tg.id = nt.tag_id
                    WHERE nt.note_id = n.id ORDER BY tg.name
                )) AS tag_csv
                FROM note n LEFT JOIN app_user u ON u.github_id = n.owner_id`

export function insert(note: Omit<Note, 'tags'>): void {
    prep(
        `INSERT INTO note (id, owner_id, title, note_date, content_bytes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(note.id, note.ownerId, note.title, note.noteDate, note.contentBytes, note.createdAt, note.updatedAt)
}

export function update(id: string, title: string, noteDate: string, contentBytes: number, updatedAt: string): void {
    prep(`UPDATE note SET title = ?, note_date = ?, content_bytes = ?, updated_at = ? WHERE id = ?`).run(
        title,
        noteDate,
        contentBytes,
        updatedAt,
        id,
    )
}

export function get(id: string): NoteListItem | undefined {
    const r = getRow<Raw>(`${SELECT} WHERE n.id = ?`, id)
    return r ? map(r) : undefined
}

export function remove(id: string): void {
    // note_tag rows cascade (FK); FTS + tag GC are handled by the service tx.
    prep('DELETE FROM note_fts WHERE note_id = ?').run(id)
    prep('DELETE FROM note WHERE id = ?').run(id)
}

export interface NoteListFilter {
    ownerId?: number
    /** Normalized tag names; AND semantics — a note must carry every one (§4.5). */
    tags?: string[]
    /** Inclusive 'YYYY-MM-DD' bounds on note_date. */
    from?: string
    to?: string
    q?: string
    limit: number
    offset: number
}

function ftsQuery(q: string): string {
    return q
        .split(/\s+/)
        .filter(Boolean)
        .map((term) => `"${term.replace(/"/g, '""')}"`)
        .join(' ')
}

export interface NoteListResult {
    items: NoteListItem[]
    total: number
}

export function list(filter: NoteListFilter): NoteListResult {
    const where: string[] = []
    const params: any[] = []
    if (filter.ownerId !== undefined) {
        where.push('n.owner_id = ?')
        params.push(filter.ownerId)
    }
    if (filter.from) {
        where.push('n.note_date >= ?')
        params.push(filter.from)
    }
    if (filter.to) {
        where.push('n.note_date <= ?')
        params.push(filter.to)
    }

    // Multi-tag AND filter (spec §4.5): the note must link every selected tag.
    const tags = (filter.tags ?? []).filter(Boolean)
    if (tags.length > 0) {
        const placeholders = tags.map(() => '?').join(',')
        where.push(
            `n.id IN (
                SELECT nt.note_id FROM note_tag nt JOIN tag tg ON tg.id = nt.tag_id
                WHERE tg.name IN (${placeholders})
                GROUP BY nt.note_id HAVING COUNT(DISTINCT tg.id) = ?
            )`,
        )
        params.push(...tags, tags.length)
    }

    // Search: FTS over title + content, with snippets for hits.
    const snippets = new Map<string, string>()
    if (filter.q && filter.q.trim() !== '') {
        const match = ftsQuery(filter.q)
        if (match) {
            for (const row of allRows<{ note_id: string; snip: string }>(
                `SELECT note_id, snippet(note_fts, 2, '<mark>', '</mark>', '…', 12) AS snip
                 FROM note_fts WHERE note_fts MATCH ?`,
                match,
            )) {
                snippets.set(row.note_id, row.snip)
            }
        }
        if (snippets.size > 0) {
            const placeholders = [...snippets.keys()].map(() => '?').join(',')
            where.push(`n.id IN (${placeholders})`)
            params.push(...snippets.keys())
        } else {
            // No FTS hit → no results for the search (title is indexed in FTS too).
            where.push('1 = 0')
        }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const totalRow = getRow<{ n: number }>(`SELECT COUNT(*) AS n FROM note n ${whereSql}`, ...params)
    const rows = allRows<Raw>(
        `${SELECT} ${whereSql} ORDER BY n.note_date DESC, n.created_at DESC LIMIT ? OFFSET ?`,
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

/** Recent notes for the dashboard. */
export function recent(limit: number, ownerId?: number): NoteListItem[] {
    const where = ownerId !== undefined ? 'WHERE n.owner_id = ?' : ''
    const params = ownerId !== undefined ? [ownerId] : []
    return allRows<Raw>(`${SELECT} ${where} ORDER BY n.updated_at DESC LIMIT ?`, ...params, limit).map(map)
}

export function count(ownerId?: number): number {
    const where = ownerId !== undefined ? 'WHERE owner_id = ?' : ''
    const params = ownerId !== undefined ? [ownerId] : []
    const r = getRow<{ n: number }>(`SELECT COUNT(*) AS n FROM note ${where}`, ...params)
    return r?.n ?? 0
}

/** All note ids — the sweep compares the fs against this set. */
export function allIds(): Set<string> {
    return new Set(allRows<{ id: string }>('SELECT id FROM note').map((r) => r.id))
}

// ── FTS sidecar ───────────────────────────────────────────────────────────────

export function ftsUpsert(id: string, title: string, content: string): void {
    prep('DELETE FROM note_fts WHERE note_id = ?').run(id)
    prep('INSERT INTO note_fts (note_id, title, content) VALUES (?, ?, ?)').run(id, title, content)
}

// ── note_tag links ────────────────────────────────────────────────────────────

/** Current tag names linked to a note (sorted). */
export function tagsOf(noteId: string): string[] {
    return allRows<{ name: string }>(
        `SELECT tg.name FROM note_tag nt JOIN tag tg ON tg.id = nt.tag_id
         WHERE nt.note_id = ? ORDER BY tg.name`,
        noteId,
    ).map((r) => r.name)
}

export function link(noteId: string, tagId: number): void {
    prep('INSERT OR IGNORE INTO note_tag (note_id, tag_id) VALUES (?, ?)').run(noteId, tagId)
}

export function unlink(noteId: string, tagId: number): void {
    prep('DELETE FROM note_tag WHERE note_id = ? AND tag_id = ?').run(noteId, tagId)
}
