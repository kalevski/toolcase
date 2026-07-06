// Project metadata repository — all SQL for the `project` table.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'

export interface ProjectRow {
    name: string
    gitUrl?: string
    branch?: string | null
    /** Alias of the saved git SSH key the project was cloned with (if any). */
    sshKeyAlias?: string | null
    createdAt: string
}

interface Raw {
    name: string
    git_url: string | null
    branch: string | null
    ssh_key_alias: string | null
    created_at: string
}

function map(r: Raw): ProjectRow {
    return {
        name: r.name,
        gitUrl: r.git_url ?? undefined,
        branch: r.branch,
        sshKeyAlias: r.ssh_key_alias,
        createdAt: r.created_at,
    }
}

export function upsertProject(row: ProjectRow): void {
    prep(
        `INSERT INTO project (name, git_url, branch, ssh_key_alias, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
            git_url = excluded.git_url,
            branch  = excluded.branch,
            ssh_key_alias = excluded.ssh_key_alias`,
    ).run(row.name, row.gitUrl ?? null, row.branch ?? null, row.sshKeyAlias ?? null, row.createdAt)
}

/** Names of projects cloned with the given saved SSH key (blocks key deletion). */
export function listProjectsUsingSshKey(alias: string): string[] {
    return allRows<{ name: string }>('SELECT name FROM project WHERE ssh_key_alias = ? ORDER BY name', alias).map(
        (r) => r.name,
    )
}

export function getProject(name: string): ProjectRow | null {
    const r = getRow<Raw>('SELECT * FROM project WHERE name = ?', name)
    return r ? map(r) : null
}

export function listProjectRows(): ProjectRow[] {
    return allRows<Raw>('SELECT * FROM project ORDER BY name').map(map)
}

export function deleteProject(name: string): void {
    // Children are pruned explicitly so we do not depend on cross-table cascades
    // for non-FK tables. (`audit` rows are kept — they are the history of who
    // did what, including deleting this project.)
    prep('DELETE FROM task WHERE project = ?').run(name)
    prep('DELETE FROM telemetry WHERE project = ?').run(name)
    prep('DELETE FROM warm_session WHERE project = ?').run(name)
    prep('DELETE FROM run_event WHERE project = ?').run(name)
    prep('DELETE FROM run WHERE project = ?').run(name)
    prep('DELETE FROM schedule WHERE project = ?').run(name)
    prep('DELETE FROM agent_prompt WHERE project = ?').run(name)
    prep('DELETE FROM agent_prompt_history WHERE project = ?').run(name)
    prep('DELETE FROM project_setting WHERE project = ?').run(name)
    prep('DELETE FROM project WHERE name = ?').run(name)
}
