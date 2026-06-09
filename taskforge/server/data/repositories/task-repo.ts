// Task metadata + runtime-status repository — all SQL for the `task` table.
// The markdown body stays on disk (the agent reads it); this table is the
// authoritative store for the queue's runtime state (status, last error) and a
// metadata mirror (title, severity, facet) so the queue renders from one query
// instead of re-parsing every file. See fs-workspace.ts `reconcileTasks`.

import 'server-only'
import { prep, tx, getRow, allRows } from '@/server/data/db'
import type { TaskStatus } from '@/server/domain/types'

export interface TaskRow {
    id: string
    title: string
    status: TaskStatus
    severity?: string
    project?: string // the task's **Project:** facet (NOT the workspace project)
    error?: string
}

interface Raw {
    id: string
    title: string
    status: string
    severity: string | null
    facet_project: string | null
    last_error: string | null
}

function map(r: Raw): TaskRow {
    const status = (r.status === 'done' || r.status === 'error' ? r.status : 'open') as TaskStatus
    return {
        id: r.id,
        title: r.title,
        status,
        severity: r.severity ?? undefined,
        project: r.facet_project ?? undefined,
        error: r.last_error ?? undefined,
    }
}

export interface ParsedMeta {
    title: string
    status: TaskStatus
    severity?: string
    project?: string
    error?: string
}

/**
 * Upsert a task's metadata from its parsed markdown. On INSERT the runtime status
 * is seeded from the file; on UPDATE the engine-owned `status`/`last_error` are
 * preserved (the DB is authoritative for runtime status — see imp.md §1.6).
 */
export function syncTask(project: string, id: string, meta: ParsedMeta, mtimeMs: number): void {
    prep(
        `INSERT INTO task (project, id, title, severity, facet_project, status, last_error, synced_mtime, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(project, id) DO UPDATE SET
            title         = excluded.title,
            severity      = excluded.severity,
            facet_project = excluded.facet_project,
            synced_mtime  = excluded.synced_mtime,
            updated_at    = excluded.updated_at`,
    ).run(
        project,
        id,
        meta.title,
        meta.severity ?? null,
        meta.project ?? null,
        meta.status,
        meta.error ?? null,
        mtimeMs,
        new Date().toISOString(),
    )
}

/** Record the file mtime we last synced from, without re-parsing (no-op if absent). */
export function touchSyncedMtime(project: string, id: string, mtimeMs: number): void {
    prep('UPDATE task SET synced_mtime = ? WHERE project = ? AND id = ?').run(mtimeMs, project, id)
}

/** Stored sync mtime for a task (ms), or null if the row is absent. */
export function syncedMtime(project: string, id: string): number | null {
    const r = getRow<{ synced_mtime: number | null }>(
        'SELECT synced_mtime FROM task WHERE project = ? AND id = ?',
        project,
        id,
    )
    return r ? r.synced_mtime : null
}

/** Remove rows whose markdown file no longer exists. */
export function pruneMissing(project: string, presentIds: string[]): void {
    tx(() => {
        const existing = allRows<{ id: string }>('SELECT id FROM task WHERE project = ?', project)
        const keep = new Set(presentIds)
        const del = prep('DELETE FROM task WHERE project = ? AND id = ?')
        for (const row of existing) {
            if (!keep.has(row.id)) del.run(project, row.id)
        }
    })
}

export function setStatus(project: string, id: string, status: TaskStatus, error?: string): void {
    prep(
        `UPDATE task SET status = ?, last_error = ?, updated_at = ?
         WHERE project = ? AND id = ?`,
    ).run(status, status === 'error' && error ? error.slice(0, 500) : null, new Date().toISOString(), project, id)
}

export function listTasks(project: string): TaskRow[] {
    return allRows<Raw>(
        'SELECT id, title, status, severity, facet_project, last_error FROM task WHERE project = ? ORDER BY id',
        project,
    ).map(map)
}

export function getTask(project: string, id: string): TaskRow | null {
    const r = getRow<Raw>(
        'SELECT id, title, status, severity, facet_project, last_error FROM task WHERE project = ? AND id = ?',
        project,
        id,
    )
    return r ? map(r) : null
}

/** Ids currently marked done (replaces the `.status` completion ledger). */
export function completedIds(project: string): Set<string> {
    const rows = allRows<{ id: string }>(`SELECT id FROM task WHERE project = ? AND status = 'done'`, project)
    return new Set(rows.map((r) => r.id))
}

/** Reopen specific done/error tasks back to 'open' (drop from the ledger). */
export function reopen(project: string, ids: string[]): void {
    if (ids.length === 0) return
    tx(() => {
        const stmt = prep(
            `UPDATE task SET status = 'open', last_error = NULL, updated_at = ? WHERE project = ? AND id = ?`,
        )
        const now = new Date().toISOString()
        for (const id of ids) stmt.run(now, project, id)
    })
}

/** Reopen every done task in a project (full `reset` run). */
export function reopenAllDone(project: string): void {
    prep(
        `UPDATE task SET status = 'open', last_error = NULL, updated_at = ? WHERE project = ? AND status = 'done'`,
    ).run(new Date().toISOString(), project)
}

/** Ids currently in the error state. */
export function erroredIds(project: string): string[] {
    return allRows<{ id: string }>(`SELECT id FROM task WHERE project = ? AND status = 'error'`, project).map(
        (r) => r.id,
    )
}
