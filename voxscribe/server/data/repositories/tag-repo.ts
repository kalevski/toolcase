// Tag repository — the shared `tag` vocabulary (spec §4.5). A tag row is
// created on first use and garbage-collected when its last reference goes
// (the notes service calls `gcOrphans` inside the same tx as the unlink).

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { TagCount } from '@/server/domain/types'

/** Get-or-create a tag row by (already normalized) name; returns its id. */
export function upsert(name: string): number {
    prep('INSERT OR IGNORE INTO tag (name) VALUES (?)').run(name)
    const r = getRow<{ id: number }>('SELECT id FROM tag WHERE name = ?', name)
    if (!r) throw new Error(`[voxscribe] tag upsert failed for '${name}'`)
    return r.id
}

export function idOf(name: string): number | undefined {
    return getRow<{ id: number }>('SELECT id FROM tag WHERE name = ?', name)?.id
}

/** Drop tag rows with no remaining references (run inside the caller's tx). */
export function gcOrphans(): number {
    const res = prep(`DELETE FROM tag WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tag)`).run()
    return Number(res.changes ?? 0)
}

/**
 * Tags with usage counts, scoped to one owner's notes (standard users) or
 * global (admin). Scoping prevents tag names leaking across owners (§4.5).
 */
export function listWithCounts(ownerId?: number): TagCount[] {
    if (ownerId !== undefined) {
        return allRows<{ name: string; count: number }>(
            `SELECT tg.name, COUNT(*) AS count
             FROM tag tg
             JOIN note_tag nt ON nt.tag_id = tg.id
             JOIN note n ON n.id = nt.note_id
             WHERE n.owner_id = ?
             GROUP BY tg.id ORDER BY count DESC, tg.name`,
            ownerId,
        )
    }
    return allRows<{ name: string; count: number }>(
        `SELECT tg.name, COUNT(nt.note_id) AS count
         FROM tag tg LEFT JOIN note_tag nt ON nt.tag_id = tg.id
         GROUP BY tg.id ORDER BY count DESC, tg.name`,
    )
}
