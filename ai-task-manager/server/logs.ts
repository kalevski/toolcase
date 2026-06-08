// Hourly-rotated run logs + telemetry, with retention pruning (§3, §6.9).
// Files live under `tasks/<repo>/logs/`:
//   run-<YYYY-MM-DDTHH>.log         live run log (BEGIN/END markers)
//   telemetry-<YYYY-MM-DDTHH>.jsonl one JSON object per task attempt
// Rotation happens at each task BEGIN (never mid-task).

import 'server-only'
import { promises as fs } from 'node:fs'
import { createWriteStream, type WriteStream } from 'node:fs'
import path from 'node:path'
import { config } from './config'
import { repoTasksDir } from './fs-workspace'
import type { TelemetryRecord } from './types'

function logsDir(repo: string): string {
    return path.join(repoTasksDir(repo), 'logs')
}

/** UTC `YYYY-MM-DDTHH`, matching the rotation filename. */
export function hourKey(date: Date = new Date()): string {
    return date.toISOString().slice(0, 13)
}

function runLogPath(repo: string, hour: string): string {
    return path.join(logsDir(repo), `run-${hour}.log`)
}

function telemetryPath(repo: string, hour: string): string {
    return path.join(logsDir(repo), `telemetry-${hour}.jsonl`)
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

    constructor(private repo: string) {}

    private async ensureDir(): Promise<void> {
        await fs.mkdir(logsDir(this.repo), { recursive: true })
    }

    private async openHour(hour: string): Promise<void> {
        if (hour === this.currentHour && this.stream) return
        await this.ensureDir()
        if (this.stream) {
            await new Promise<void>((r) => this.stream!.end(r))
        }
        this.stream = createWriteStream(runLogPath(this.repo, hour), { flags: 'a' })
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
        await this.ensureDir()
        const file = telemetryPath(this.repo, hourKey())
        await fs.appendFile(file, JSON.stringify(record) + '\n', 'utf8')
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
            entries = await fs.readdir(logsDir(this.repo))
        } catch {
            return
        }
        for (const name of entries) {
            const m = name.match(/-(\d{4}-\d{2}-\d{2}T\d{2})\.(log|jsonl)$/)
            if (!m) continue
            const t = Date.parse(m[1] + ':00:00Z')
            if (!Number.isNaN(t) && t < cutoff) {
                await fs.unlink(path.join(logsDir(this.repo), name)).catch(() => {})
            }
        }
    }
}

/**
 * Read every `telemetry-*.jsonl` for a repo and return the latest record per
 * task id (drives the queue table status column, §6.9).
 */
export async function readTelemetry(repo: string): Promise<Map<string, TelemetryRecord>> {
    const out = new Map<string, TelemetryRecord>()
    let entries: string[]
    try {
        entries = await fs.readdir(logsDir(repo))
    } catch {
        return out
    }
    const files = entries.filter((n) => /^telemetry-.*\.jsonl$/.test(n)).sort()
    for (const name of files) {
        let raw: string
        try {
            raw = await fs.readFile(path.join(logsDir(repo), name), 'utf8')
        } catch {
            continue
        }
        for (const line of raw.split('\n')) {
            if (!line.trim()) continue
            try {
                const rec = JSON.parse(line) as TelemetryRecord
                // later files sort after earlier ones, so this keeps the latest
                out.set(rec.task, rec)
            } catch {
                /* skip malformed line */
            }
        }
    }
    return out
}

/** Tail the active (most recent) run log for the reconnect snapshot. */
export async function tailRunLog(repo: string, maxLines = 1000): Promise<string[]> {
    let entries: string[]
    try {
        entries = await fs.readdir(logsDir(repo))
    } catch {
        return []
    }
    const files = entries.filter((n) => /^run-.*\.log$/.test(n)).sort()
    if (files.length === 0) return []
    const latest = files[files.length - 1]
    let raw: string
    try {
        raw = await fs.readFile(path.join(logsDir(repo), latest), 'utf8')
    } catch {
        return []
    }
    const lines = raw.split('\n').filter(Boolean)
    return lines.slice(-maxLines)
}
