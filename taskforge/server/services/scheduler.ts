// B3 scheduled runs. A 60s `setInterval` ticker (globalThis singleton, same
// dev-hot-reload pattern as engine/db) checks enabled schedules each minute and
// starts the pending queue via the existing engine — guarded by the same locks
// (busy project → skip + log). No external cron dependency; the single-process
// app makes this safe.
//
// Cron subset: 5 fields `min hour dom mon dow` supporting `*`, numbers, lists
// `a,b`, ranges `a-b`, and steps `*/n`. dow: 0–6, 0 = Sunday (7 ≡ 0).

import 'server-only'
import { engine, LockHeldError, DirtyTreeError, modelFamily } from '@/server/services/execution-manager'
import { resolveModel } from '@/server/infrastructure/agent'
import { agentSessionsBusy } from '@/server/services/locks'
import { effectiveSettings } from '@/server/services/settings'
import { refreshUsage } from '@/server/services/usage'
import { slog } from '@/server/infrastructure/server-log'
import * as scheduleRepo from '@/server/data/repositories/schedule-repo'
import * as taskRepo from '@/server/data/repositories/task-repo'
import type { RunOptions } from '@/server/domain/types'

export class InvalidCronError extends Error {}

/** Parse one cron field into a matcher over [min, max]. Throws on bad syntax. */
function fieldMatcher(field: string, min: number, max: number): (v: number) => boolean {
    const norm = (n: number) => (max === 6 && n === 7 ? 0 : n) // dow: 7 ≡ 0 (Sunday)
    const parts = field.split(',')
    const accept = new Set<number>()
    for (const part of parts) {
        const step = part.match(/^(\*|\d+-\d+)\/(\d+)$/)
        if (step) {
            const n = Number(step[2])
            if (!Number.isInteger(n) || n < 1) throw new InvalidCronError(`bad step: ${part}`)
            let lo = min
            let hi = max
            if (step[1] !== '*') {
                const [a, b] = step[1].split('-').map(Number)
                lo = a
                hi = b
            }
            // COR-4 — dow treats 7 ≡ 0, so a stepped range may reach `max + 1`
            // for dow (e.g. `0-7/2`), matching the plain-range/bare-number
            // branches; norm() folds 7 → 0 below.
            if (lo < min || hi > max + (max === 6 ? 1 : 0) || lo > hi) {
                throw new InvalidCronError(`out of range: ${part}`)
            }
            for (let v = lo; v <= hi; v += n) accept.add(norm(v))
            continue
        }
        if (part === '*') {
            for (let v = min; v <= max; v++) accept.add(v)
            continue
        }
        const range = part.match(/^(\d+)-(\d+)$/)
        if (range) {
            const a = Number(range[1])
            const b = Number(range[2])
            if (a < min || b > max + (max === 6 ? 1 : 0) || a > b) throw new InvalidCronError(`out of range: ${part}`)
            for (let v = a; v <= b; v++) accept.add(norm(v))
            continue
        }
        if (/^\d+$/.test(part)) {
            const v = Number(part)
            if (v < min || v > max + (max === 6 ? 1 : 0)) throw new InvalidCronError(`out of range: ${part}`)
            accept.add(norm(v))
            continue
        }
        throw new InvalidCronError(`bad field part: ${JSON.stringify(part)}`)
    }
    return (v) => accept.has(v)
}

export interface CronSpec {
    matches: (d: Date) => boolean
}

/** Parse a 5-field cron expression; throws InvalidCronError on bad input. */
export function parseCron(expr: string): CronSpec {
    const fields = expr.trim().split(/\s+/)
    if (fields.length !== 5) throw new InvalidCronError('cron must have 5 fields: min hour dom mon dow')
    const [minute, hour, dom, mon, dow] = [
        fieldMatcher(fields[0], 0, 59),
        fieldMatcher(fields[1], 0, 23),
        fieldMatcher(fields[2], 1, 31),
        fieldMatcher(fields[3], 1, 12),
        fieldMatcher(fields[4], 0, 6),
    ]
    const domIsStar = fields[2] === '*'
    const dowIsStar = fields[4] === '*'
    return {
        matches(d: Date): boolean {
            if (!minute(d.getMinutes()) || !hour(d.getHours()) || !mon(d.getMonth() + 1)) return false
            // Standard cron: when both dom and dow are restricted, either may match.
            const domOk = dom(d.getDate())
            const dowOk = dow(d.getDay())
            if (domIsStar && dowIsStar) return true
            if (domIsStar) return dowOk
            if (dowIsStar) return domOk
            return domOk || dowOk
        },
    }
}

/** Minute-resolution key used to dedupe firing within one cron minute. */
function minuteKey(d: Date): string {
    return d.toISOString().slice(0, 16)
}

async function fire(project: string, options: Partial<RunOptions>, skipAboveUsage: number | null): Promise<void> {
    // pre-checks: locks (cheap, in-memory) then the optional usage gate (spawns /usage)
    if (engine.isLocked(project) || agentSessionsBusy(project)) {
        slog('info', 'scheduler', 'skip: project busy', { project })
        return
    }
    const eff = effectiveSettings(project)
    const runModel = options.model ?? eff.defaultModel
    if (skipAboveUsage !== null) {
        try {
            const snap = await refreshUsage(Date.now())
            // Only count buckets that constrain this run's model — a model-specific
            // bucket (e.g. the Sonnet-only weekly limit) must not skip a run that
            // uses a different model. Generic buckets apply to every run.
            const runFamily = modelFamily(resolveModel(runModel))
            const peak = snap.entries.reduce((m, e) => {
                const fam = modelFamily(e.label)
                if (fam && fam !== runFamily) return m
                return Math.max(m, e.percent)
            }, 0)
            if (peak >= skipAboveUsage) {
                slog('info', 'scheduler', 'skip: usage above threshold', { project, peak, threshold: skipAboveUsage })
                return
            }
        } catch {
            /* fail-open: a usage-probe hiccup must not cancel the night run */
        }
    }
    const opts: RunOptions = {
        model: runModel,
        warmSession: options.warmSession,
        commitAfter: options.commitAfter,
        commitMessageMode: options.commitMessageMode,
        commitModel: options.commitModel,
        filter: options.filter,
        severity: options.severity,
        project: options.project,
        pushAfter: options.pushAfter,
        branchPerRun: options.branchPerRun,
        review: options.review,
        openPr: options.openPr,
        startedBy: 'schedule',
    }
    try {
        await engine.start(project, opts)
        scheduleRepo.markFired(project)
        slog('info', 'scheduler', 'run started by schedule', { project, model: opts.model })
    } catch (err) {
        if (err instanceof LockHeldError) {
            slog('info', 'scheduler', 'skip: lock held at start', { project })
        } else if (err instanceof DirtyTreeError) {
            slog('warn', 'scheduler', 'skip: working tree dirty', { project, files: err.files.length })
        } else {
            slog('error', 'scheduler', 'scheduled start failed', { project, error: String(err) })
        }
    }
}

async function tick(): Promise<void> {
    const now = new Date()
    let schedules
    try {
        schedules = scheduleRepo.listEnabled()
    } catch {
        return // DB not ready yet
    }
    for (const s of schedules) {
        let spec: CronSpec
        try {
            spec = parseCron(s.cron)
        } catch (err) {
            // invalid stored cron — skip, but surface it so a typo isn't silent forever
            slog('warn', 'scheduler', 'invalid stored cron — schedule ignored', {
                project: s.project,
                cron: s.cron,
                error: String(err),
            })
            continue
        }
        if (!spec.matches(now)) continue
        // one fire per cron minute, even across ticker drift / multiple ticks
        if (s.lastFiredAt && minuteKey(new Date(s.lastFiredAt)) === minuteKey(now)) continue
        if (s.onlyIfPending) {
            try {
                const pending = taskRepo.listTasks(s.project).filter((t) => t.status === 'open').length
                if (pending === 0) {
                    slog('info', 'scheduler', 'skip: no pending tasks', { project: s.project })
                    continue
                }
            } catch {
                continue
            }
        }
        // markFired BEFORE the async fire so a slow start can't double-fire
        scheduleRepo.markFired(s.project)
        void fire(s.project, s.options, s.skipAboveUsage)
    }
}

// ── singleton ticker (survives Next dev hot-reload via globalThis cache) ─────

declare global {
    var __taskforgeScheduler: ReturnType<typeof setInterval> | undefined
}

/** Idempotent: starts the 60s ticker once per process. */
export function ensureSchedulerStarted(): void {
    if (globalThis.__taskforgeScheduler) return
    globalThis.__taskforgeScheduler = setInterval(() => {
        void tick().catch(() => {})
    }, 60_000)
    // Don't keep the process alive solely for the ticker.
    globalThis.__taskforgeScheduler.unref?.()
    slog('info', 'scheduler', 'ticker started (60s)')
}
