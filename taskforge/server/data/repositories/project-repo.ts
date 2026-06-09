// Project metadata repository — all SQL for the `project` table.
// Replaces the on-disk `project.json` written/read by provision.ts.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'

export interface ProjectRow {
    name: string
    gitUrl?: string
    branch?: string | null
    createdAt: string
}

interface Raw {
    name: string
    git_url: string | null
    branch: string | null
    created_at: string
}

function map(r: Raw): ProjectRow {
    return {
        name: r.name,
        gitUrl: r.git_url ?? undefined,
        branch: r.branch,
        createdAt: r.created_at,
    }
}

export function upsertProject(row: ProjectRow): void {
    prep(
        `INSERT INTO project (name, git_url, branch, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
            git_url = excluded.git_url,
            branch  = excluded.branch`,
    ).run(row.name, row.gitUrl ?? null, row.branch ?? null, row.createdAt)
}

export function getProject(name: string): ProjectRow | null {
    const r = getRow<Raw>('SELECT * FROM project WHERE name = ?', name)
    return r ? map(r) : null
}

export function listProjectRows(): ProjectRow[] {
    return allRows<Raw>('SELECT * FROM project ORDER BY name').map(map)
}

export function deleteProject(name: string): void {
    // Children (task/telemetry/warm_session/run_event) are pruned explicitly so
    // we do not depend on cross-table cascades for non-FK tables.
    prep('DELETE FROM task WHERE project = ?').run(name)
    prep('DELETE FROM telemetry WHERE project = ?').run(name)
    prep('DELETE FROM warm_session WHERE project = ?').run(name)
    prep('DELETE FROM run_event WHERE project = ?').run(name)
    prep('DELETE FROM project WHERE name = ?').run(name)
}
