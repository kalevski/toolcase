// Aggregation helpers used by both API routes and SSR pages.

import 'server-only'
import {
    listProjects,
    reconcileTasks,
    removeCompleted,
    updateTaskStatus,
    listKnowledgeFiles,
    readKnowledgeFile,
    extractTitle,
    extractSummary,
} from '@/server/infrastructure/fs-workspace'
import { readTelemetry, clearTelemetry } from '@/server/infrastructure/logs'
import { engine } from '@/server/services/execution-manager'
import { readProjectMeta } from '@/server/services/provision'
import * as taskRepo from '@/server/data/repositories/task-repo'
import { ensureImported } from '@/server/services/migrate-fs'
import { slog } from '@/server/infrastructure/server-log'
import type { KnowledgeDoc, ProjectNavItem, ProjectSummary, TaskInfo } from '@/server/domain/types'

export async function getTasks(project: string): Promise<TaskInfo[]> {
    await ensureImported()
    // Mirror the markdown files into the DB (cheap when nothing changed), then
    // render the queue from a single query + telemetry, with no per-file parse.
    await reconcileTasks(project)
    const [rows, telemetry] = await Promise.all([
        Promise.resolve(taskRepo.listTasks(project)),
        readTelemetry(project),
    ])
    const snap = engine.snapshot(project)

    const out: TaskInfo[] = []
    for (const row of rows) {
        const tele = telemetry.get(row.id)

        let status: TaskInfo['status']
        if (snap.state === 'RUNNING' && snap.current === row.id) {
            status = 'running'
        } else if (row.status === 'done') {
            status = 'done'
        } else if (tele && (tele.status === 'error' || tele.status === 'failed')) {
            status = 'error'
        } else if (row.status === 'error') {
            status = 'error'
        } else {
            status = 'pending'
        }

        out.push({
            id: row.id,
            title: row.title,
            status,
            severity: row.severity,
            project: row.project,
            lastElapsed: tele?.elapsed,
            lastModel: tele?.model,
            lastCommit: tele?.commit,
            // Prefer live telemetry; fall back to the error persisted on the task row.
            lastError: status === 'error' ? (tele?.error ?? row.error) : undefined,
        })
    }
    return out
}

/**
 * Move every task currently in the `error` state back to `pending`: reopen its
 * header (clearing the persisted error), and drop its `.status` + telemetry
 * records so nothing pins it back to `error`. Returns the moved ids and the
 * refreshed task list. Callers must ensure no run holds the lock.
 */
export async function resetErrorTasksToPending(
    project: string,
): Promise<{ moved: string[]; tasks: TaskInfo[] }> {
    const tasks = await getTasks(project)
    const moved = tasks.filter((t) => t.status === 'error').map((t) => t.id)
    if (moved.length === 0) {
        slog('info', 'tasks', `reset-errors: nothing to move`, { project })
        return { moved, tasks }
    }
    await Promise.all(moved.map((id) => updateTaskStatus(project, id, 'open').catch(() => {})))
    await removeCompleted(project, moved)
    await clearTelemetry(project, moved)
    slog('info', 'tasks', `reset-errors: moved ${moved.length} task(s) to pending`, { project, moved })
    return { moved, tasks: await getTasks(project) }
}

/** Knowledge docs for a project (index.md first), titled + summarized from each file. */
export async function getKnowledge(project: string): Promise<KnowledgeDoc[]> {
    const files = await listKnowledgeFiles(project)
    const docs = await Promise.all(
        files.map(async (id) => {
            try {
                const content = await readKnowledgeFile(project, id)
                const isIndex = id.toLowerCase() === 'index.md'
                return {
                    id,
                    title: extractTitle(content, id),
                    description: isIndex ? '' : extractSummary(content),
                    isIndex,
                }
            } catch {
                return null
            }
        }),
    )
    const out: KnowledgeDoc[] = []
    for (const doc of docs) {
        if (!doc) continue
        out.push(doc)
    }
    return out
}

async function getProjectSummary(project: string): Promise<ProjectSummary> {
    const [tasks, meta] = await Promise.all([getTasks(project), readProjectMeta(project)])
    const done = tasks.filter((t) => t.status === 'done').length
    const error = tasks.filter((t) => t.status === 'error').length
    const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'running').length
    return {
        name: project,
        total: tasks.length,
        done,
        error,
        pending,
        state: engine.state(project),
        hasTasks: tasks.length > 0,
        gitUrl: meta.gitUrl,
        branch: meta.branch,
    }
}

export async function getProjectSummaries(): Promise<ProjectSummary[]> {
    const projects = await listProjects()
    return Promise.all(projects.map((p) => getProjectSummary(p)))
}

/**
 * Cheap project list for the sidebar dropdown: directory scan + in-memory engine
 * state only (no per-task file reads). Safe to call on every page.
 */
export async function getProjectNav(): Promise<ProjectNavItem[]> {
    const projects = await listProjects()
    return projects.map((name) => ({ name, state: engine.state(name) }))
}
