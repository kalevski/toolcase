// Durable engine-event log — all SQL for the `run_event` table.
// Best-effort audit trail of milestone engine events (task:begin/done/error,
// commit, limit, completed, stopped). The live SSE stream still uses the engine's
// in-memory ring; this table is for durability / post-hoc inspection.

import 'server-only'
import { prep, allRows } from '@/server/data/db'
import type { SseEvent } from '@/server/domain/types'

export function append(project: string, event: SseEvent): void {
    const task = 'taskId' in event ? (event as { taskId: string | null }).taskId : null
    prep(
        `INSERT INTO run_event (project, type, task, payload, created_at)
         VALUES (?, ?, ?, ?, ?)`,
    ).run(project, event.type, task ?? null, JSON.stringify(event), new Date().toISOString())
}

export interface RunEventRow {
    id: number
    type: string
    task: string | null
    payload: string
    createdAt: string
}

export function since(project: string, lastId: number, limit = 500): RunEventRow[] {
    const rows = allRows<{
        id: number
        type: string
        task: string | null
        payload: string
        created_at: string
    }>(
        `SELECT id, type, task, payload, created_at FROM run_event
         WHERE project = ? AND id > ? ORDER BY id LIMIT ?`,
        project,
        lastId,
        limit,
    )
    return rows.map((r) => ({
        id: r.id,
        type: r.type,
        task: r.task,
        payload: r.payload,
        createdAt: r.created_at,
    }))
}
