// Aggregation helpers used by both API routes and SSR pages.

import 'server-only'
import { listRepos, listTaskFiles, readCompleted, readTaskFile, parseTask } from './fs-workspace'
import { readTelemetry } from './logs'
import { engine } from './execution-manager'
import type { RepoSummary, TaskInfo } from './types'

export async function getTasks(repo: string): Promise<TaskInfo[]> {
    const files = await listTaskFiles(repo)
    const completed = await readCompleted(repo)
    const telemetry = await readTelemetry(repo)
    const snap = engine.snapshot(repo)

    const out: TaskInfo[] = []
    for (const id of files) {
        let parsed
        try {
            parsed = parseTask(await readTaskFile(repo, id), id)
        } catch {
            continue
        }
        const tele = telemetry.get(id)

        let status: TaskInfo['status']
        if (snap.state === 'RUNNING' && snap.current === id) {
            status = 'running'
        } else if (completed.has(id)) {
            status = 'done'
        } else if (tele && (tele.status === 'error' || tele.status === 'failed')) {
            status = 'error'
        } else if (parsed.status === 'error') {
            status = 'error'
        } else {
            status = 'pending'
        }

        out.push({
            id,
            title: parsed.title,
            status,
            severity: parsed.severity,
            project: parsed.project,
            lastElapsed: tele?.elapsed,
            lastModel: tele?.model,
            lastCommit: tele?.commit,
            lastError: status === 'error' ? tele?.error : undefined,
        })
    }
    return out
}

export async function getRepoSummary(repo: string): Promise<RepoSummary> {
    const tasks = await getTasks(repo)
    const done = tasks.filter((t) => t.status === 'done').length
    const error = tasks.filter((t) => t.status === 'error').length
    const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'running').length
    return {
        name: repo,
        total: tasks.length,
        done,
        error,
        pending,
        state: engine.state(repo),
        hasTasks: tasks.length > 0,
    }
}

export async function getRepoSummaries(): Promise<RepoSummary[]> {
    const repos = await listRepos()
    return Promise.all(repos.map((r) => getRepoSummary(r)))
}
