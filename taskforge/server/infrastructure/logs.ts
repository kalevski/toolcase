// Hourly-rotated run logs + telemetry, with retention pruning (§3, §6.9).
// Files live under the project's `tasks/logs/`:
//   run-<YYYY-MM-DDTHH>.log         live run log (BEGIN/END markers)
//   telemetry-<YYYY-MM-DDTHH>.jsonl one JSON object per task attempt
// Rotation happens at each task BEGIN (never mid-task).

import 'server-only'
import { promises as fs } from 'node:fs'
import { createWriteStream, type WriteStream } from 'node:fs'
import path from 'node:path'
import { config } from '@/server/config'
import { projectTasksDir } from '@/server/infrastructure/fs-workspace'
import * as telemetryRepo from '@/server/data/repositories/telemetry-repo'
import type { TelemetryRecord } from '@/server/domain/types'

function logsDir(project: string): string {
    return path.join(projectTasksDir(project), 'logs')
}

/** UTC `YYYY-MM-DDTHH`, matching the rotation filename. */
function hourKey(date: Date = new Date()): string {
    return date.toISOString().slice(0, 13)
}

function runLogPath(project: string, hour: string): string {
    return path.join(logsDir(project), `run-${hour}.log`)
}

// Redact obvious secrets before anything is written to the run log (§10).
const REDACT_RE =
    /(sk-ant-[A-Za-z0-9_-]{6,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|gho_[A-Za-z0-9]{20,})/g

function redact(text: string): string {
    return text.replace(REDACT_RE, '«redacted»')
}

/**
 * Per-run logger. Holds the write stream for the current hour; `beginTask`
 * rolls to a new hour's file when the boundary is crossed.
 */
export class RunLogger {
    private currentHour = ''
    private stream: WriteStream | null = null

    constructor(private project: string) {}

    private async ensureDir(): Promise<void> {
        await fs.mkdir(logsDir(this.project), { recursive: true })
    }

    private async openHour(hour: string): Promise<void> {
        if (hour === this.currentHour && this.stream) return
        await this.ensureDir()
        if (this.stream) {
            await new Promise<void>((r) => this.stream!.end(r))
        }
        this.stream = createWriteStream(runLogPath(this.project, hour), { flags: 'a' })
        this.currentHour = hour
    }

    /** Roll to the current hour (if needed), prune old files, write BEGIN. */
    async beginTask(rel: string): Promise<void> {
        const hour = hourKey()
        await this.openHour(hour)
        await this.prune()
        this.write(`===== BEGIN ${rel} =====`)
    }

    endTask(rel: string, exit: number | null, elapsedS: number): void {
        this.write(`===== END ${rel} (exit=${exit ?? 'null'}, ${elapsedS.toFixed(1)}s) =====`)
    }

    /** Append a raw line to the active run log (and redact secrets). */
    write(line: string): void {
        if (!this.stream) return
        this.stream.write(redact(line) + '\n')
    }

    async telemetry(record: TelemetryRecord): Promise<void> {
        // Telemetry now lives in SQLite (queryable, no rotation/merge). Run logs
        // (BEGIN/END + stream) stay as rotated files — see the header note.
        telemetryRepo.record(this.project, record)
    }

    async close(): Promise<void> {
        if (this.stream) {
            await new Promise<void>((r) => this.stream!.end(r))
            this.stream = null
        }
    }

    /** Delete rotated files older than LOG_RETENTION_HOURS. */
    private async prune(): Promise<void> {
        if (config.logRetentionHours <= 0) return
        const cutoff = Date.now() - config.logRetentionHours * 3600 * 1000
        let entries: string[]
        try {
            entries = await fs.readdir(logsDir(this.project))
        } catch {
            return
        }
        await Promise.all(
            entries.map((name) => {
                const m = name.match(/-(\d{4}-\d{2}-\d{2}T\d{2})\.(log|jsonl)$/)
                if (!m) return
                const t = Date.parse(m[1] + ':00:00Z')
                if (Number.isNaN(t) || t >= cutoff) return
                return fs.unlink(path.join(logsDir(this.project), name)).catch(() => {})
            }),
        )
    }
}

/**
 * Latest telemetry record per task id (drives the queue table status column).
 * Backed by SQLite — a single indexed query, no jsonl rotation/merge.
 */
export async function readTelemetry(project: string): Promise<Map<string, TelemetryRecord>> {
    return telemetryRepo.latestByTask(project)
}

/**
 * Drop every telemetry record for the given task ids. Used when a task is moved
 * back to "pending" so its stale error/done outcome no longer drives the queue.
 */
export async function clearTelemetry(project: string, ids: string[]): Promise<void> {
    telemetryRepo.clearForTasks(project, ids)
}
