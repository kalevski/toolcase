// C3 workspace search — FTS5 index over tasks / knowledge / notes.
// The virtual table is created lazily OUTSIDE the migration chain so a runtime
// whose bundled SQLite lacks FTS5 degrades to "search unavailable" instead of
// failing boot. Sync points live in fs-workspace (file writes) — every doc
// write/delete upserts/removes its row here, best-effort.

import 'server-only'
import { exec, prep, allRows } from '@/server/data/db'
import type { SearchDocType, SearchHit } from '@/server/domain/types'

let ftsState: 'unknown' | 'ready' | 'unavailable' = 'unknown'

function ensureFts(): boolean {
    if (ftsState === 'ready') return true
    if (ftsState === 'unavailable') return false
    try {
        exec(
            `CREATE VIRTUAL TABLE IF NOT EXISTS doc_fts USING fts5(
                project UNINDEXED, type UNINDEXED, doc_id UNINDEXED, title, body
            );`,
        )
        ftsState = 'ready'
        return true
    } catch (err: any) {
        ftsState = 'unavailable'
        console.warn(`[taskforge] FTS5 unavailable — workspace search disabled: ${err?.message ?? err}`)
        return false
    }
}

export function searchAvailable(): boolean {
    return ensureFts()
}

/** Upsert one document. Best-effort: failures are logged, never thrown. */
export function indexDoc(project: string, type: SearchDocType, id: string, title: string, body: string): void {
    if (!ensureFts()) return
    try {
        prep('DELETE FROM doc_fts WHERE project = ? AND type = ? AND doc_id = ?').run(project, type, id)
        prep('INSERT INTO doc_fts (project, type, doc_id, title, body) VALUES (?, ?, ?, ?, ?)').run(
            project,
            type,
            id,
            title,
            // Cap pathological bodies; FTS rows are search surface, not storage.
            body.slice(0, 200_000),
        )
    } catch {
        /* best-effort */
    }
}

export function removeDoc(project: string, type: SearchDocType, id: string): void {
    if (!ensureFts()) return
    try {
        prep('DELETE FROM doc_fts WHERE project = ? AND type = ? AND doc_id = ?').run(project, type, id)
    } catch {
        /* best-effort */
    }
}

export function removeProject(project: string): void {
    if (!ensureFts()) return
    try {
        prep('DELETE FROM doc_fts WHERE project = ?').run(project)
    } catch {
        /* best-effort */
    }
}

/**
 * Query the index. The raw user query is converted to quoted prefix terms so
 * FTS5 operator syntax in user input can't break the parse.
 */
export function search(project: string, query: string, limit = 30): SearchHit[] {
    if (!ensureFts()) return []
    const terms = query
        .split(/\s+/)
        .map((t) => t.replace(/["']/g, '').trim())
        .filter(Boolean)
        .map((t) => `"${t}"*`)
    if (terms.length === 0) return []
    try {
        return allRows<{ type: string; doc_id: string; title: string; snip: string }>(
            `SELECT type, doc_id, title, snippet(doc_fts, 4, '<mark>', '</mark>', '…', 18) AS snip
             FROM doc_fts WHERE project = ? AND doc_fts MATCH ?
             ORDER BY rank LIMIT ?`,
            project,
            terms.join(' '),
            limit,
        ).map((r) => ({
            type: r.type as SearchDocType,
            id: r.doc_id,
            title: r.title,
            snippet: r.snip,
        }))
    } catch {
        return []
    }
}
