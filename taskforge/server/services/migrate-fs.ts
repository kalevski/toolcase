// One-time importer: migrate legacy filesystem state into SQLite.
// Runs once per database (guarded by a `meta` flag row). Reads the OLD on-disk
// formats directly (NOT through the now-DB-backed helpers) and populates the
// tables, so an existing /workspace keeps its tasks, telemetry, users, roles,
// usage cache, warm sessions, and project metadata after the cutover.

import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from '@/server/config'
import { prep, getRow } from '@/server/data/db'
import {
    listProjects,
    listTaskFiles,
    readTaskFile,
    parseTask,
    projectTasksDir,
    reconcileTasks,
} from '@/server/infrastructure/fs-workspace'
import * as taskRepo from '@/server/data/repositories/task-repo'
import * as telemetryRepo from '@/server/data/repositories/telemetry-repo'
import * as warmRepo from '@/server/data/repositories/warm-session-repo'
import * as userRepo from '@/server/data/repositories/user-repo'
import * as projectRepo from '@/server/data/repositories/project-repo'
import { saveSnapshot } from '@/server/data/repositories/usage-repo'
import type { TelemetryRecord, UsageSnapshot, UserRecord } from '@/server/domain/types'

const FLAG = 'fs_imported'

function getFlag(): boolean {
    const r = getRow<{ value: string }>('SELECT value FROM meta WHERE key = ?', FLAG)
    return r?.value === '1'
}

function setFlag(): void {
    prep('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
        FLAG,
        '1',
    )
}

async function readJson<T>(file: string): Promise<T | null> {
    try {
        return JSON.parse(await fs.readFile(file, 'utf8')) as T
    } catch {
        return null
    }
}

async function importRoles(): Promise<void> {
    const data = await readJson<{ users: UserRecord[] }>(path.join(config.authDir, 'roles.json'))
    if (!data?.users) return
    for (const u of data.users) {
        if (!userRepo.get(u.githubId)) userRepo.insert(u)
    }
}

async function importUsage(): Promise<void> {
    const snap = await readJson<UsageSnapshot>(path.join(config.workspaceDir, '.usage-cache.json'))
    if (snap && Array.isArray(snap.entries)) saveSnapshot(snap)
}

async function importProject(project: string): Promise<void> {
    // metadata (project.json)
    const meta = await readJson<{ gitUrl?: string; branch?: string | null; createdAt?: string }>(
        path.join(config.projectsDir, project, 'project.json'),
    )
    projectRepo.upsertProject({
        name: project,
        gitUrl: meta?.gitUrl,
        branch: meta?.branch ?? null,
        createdAt: meta?.createdAt ?? new Date().toISOString(),
    })

    // tasks (parse md headers into rows)
    await reconcileTasks(project)

    // legacy completion ledger (.status) → mark done
    const ids = await listTaskFiles(project)
    const tasksDir = projectTasksDir(project)
    try {
        const raw = await fs.readFile(path.join(tasksDir, '.status'), 'utf8')
        const done = raw
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
        for (const id of done) taskRepo.setStatus(project, id, 'done')
    } catch {
        /* no ledger */
    }
    // persist parsed error headers (reconcile seeds status on insert; ensure error text too)
    for (const id of ids) {
        try {
            const parsed = parseTask(await readTaskFile(project, id), id)
            if (parsed.status === 'error' && parsed.error) taskRepo.setStatus(project, id, 'error', parsed.error)
        } catch {
            /* skip unreadable */
        }
    }

    // telemetry (read every telemetry-*.jsonl in file order = oldest→newest)
    const logsDir = path.join(tasksDir, 'logs')
    let entries: string[]
    try {
        entries = (await fs.readdir(logsDir)).filter((n) => /^telemetry-.*\.jsonl$/.test(n)).sort()
    } catch {
        entries = []
    }
    for (const name of entries) {
        const raw = await fs.readFile(path.join(logsDir, name), 'utf8').catch(() => '')
        for (const line of raw.split('\n')) {
            if (!line.trim()) continue
            try {
                telemetryRepo.record(project, JSON.parse(line) as TelemetryRecord)
            } catch {
                /* skip malformed */
            }
        }
    }

    // warm session marker
    const warm = await readJson<{ sessionId: string; ts: number }>(path.join(tasksDir, '.warm_session'))
    if (warm?.sessionId) warmRepo.set(project, warm.sessionId, warm.ts)
}

let inflight: Promise<void> | null = null

/** Idempotent: imports legacy filesystem state into SQLite the first time only. */
export function ensureImported(): Promise<void> {
    if (!inflight) {
        inflight = (async () => {
            if (getFlag()) return
            await importRoles()
            await importUsage()
            const projects = await listProjects()
            for (const p of projects) {
                // Isolate per-project failures so one bad workspace can't block the
                // whole import (and loop forever because the flag never sets).
                await importProject(p).catch(() => {})
            }
            setFlag()
        })().catch((err) => {
            inflight = null // allow a retry on the next call
            throw err
        })
    }
    return inflight
}
