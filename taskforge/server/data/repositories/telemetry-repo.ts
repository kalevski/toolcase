// Per-attempt telemetry repository — all SQL for the `telemetry` table.
// Replaces the hourly-rotated `telemetry-*.jsonl` files + the read-all-and-merge
// in logs.ts. "Latest per task" is a single indexed query.

import 'server-only'
import { prep, tx, allRows } from '@/server/data/db'
import type { TelemetryRecord } from '@/server/domain/types'

export function record(project: string, rec: TelemetryRecord): void {
    prep(
        `INSERT INTO telemetry (project, task, status, elapsed, model, commit_sha, error, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        project,
        rec.task,
        rec.status,
        rec.elapsed,
        rec.model,
        rec.commit ?? null,
        rec.error ?? null,
        rec.timestamp,
    )
}

interface Raw {
    task: string
    status: string
    elapsed: number
    model: string
    commit_sha: string | null
    error: string | null
    created_at: string
}

function map(r: Raw): TelemetryRecord {
    return {
        task: r.task,
        status: r.status as TelemetryRecord['status'],
        elapsed: r.elapsed,
        model: r.model,
        commit: r.commit_sha ?? undefined,
        timestamp: r.created_at,
        error: r.error ?? undefined,
    }
}

/** Latest attempt per task id for a project (latest-wins by autoincrement id). */
export function latestByTask(project: string): Map<string, TelemetryRecord> {
    const rows = allRows<Raw>(
        `SELECT t.task, t.status, t.elapsed, t.model, t.commit_sha, t.error, t.created_at
         FROM telemetry t
         JOIN (SELECT task, MAX(id) AS max_id FROM telemetry WHERE project = ? GROUP BY task) m
           ON t.task = m.task AND t.id = m.max_id
         WHERE t.project = ?`,
        project,
        project,
    )
    const out = new Map<string, TelemetryRecord>()
    for (const r of rows) out.set(r.task, map(r))
    return out
}

/** Drop every telemetry record for the given task ids (used when reopening). */
export function clearForTasks(project: string, ids: string[]): void {
    if (ids.length === 0) return
    tx(() => {
        const stmt = prep('DELETE FROM telemetry WHERE project = ? AND task = ?')
        for (const id of ids) stmt.run(project, id)
    })
}
