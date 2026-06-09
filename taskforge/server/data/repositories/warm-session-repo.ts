// Warm-session marker repository — all SQL for the `warm_session` table.
// Replaces the on-disk `tasks/.warm_session` JSON marker.

import 'server-only'
import { prep } from '@/server/data/db'

export interface WarmSession {
    sessionId: string
    ts: number
}

export function get(project: string): WarmSession | null {
    const r = prep('SELECT session_id, ts FROM warm_session WHERE project = ?').get(project) as
        | { session_id: string; ts: number }
        | undefined
    return r ? { sessionId: r.session_id, ts: r.ts } : null
}

export function set(project: string, sessionId: string, ts: number): void {
    prep(
        `INSERT INTO warm_session (project, session_id, ts)
         VALUES (?, ?, ?)
         ON CONFLICT(project) DO UPDATE SET session_id = excluded.session_id, ts = excluded.ts`,
    ).run(project, sessionId, ts)
}

export function clear(project: string): void {
    prep('DELETE FROM warm_session WHERE project = ?').run(project)
}
