// B3 scheduled runs. A sub-minute `setInterval` ticker (globalThis singleton,
// same dev-hot-reload pattern as engine/db) checks enabled schedules and starts
// the pending queue via the existing engine — guarded by the same locks (busy
// project → skip + log). No external cron dependency; the single-process app
// makes this safe.
//
// Cron parsing/matching is the pure `domain/cron.ts` (unit-tested from test/);
// this module is only the server-side wiring: DB reads, locks, usage gate,
// engine start, and the ticker itself.

import 'server-only'
import { engine, LockHeldError, DirtyTreeError, modelFamily } from '@/server/services/execution-manager'
import { resolveModel } from '@/server/infrastructure/agent'
import { agentSessionsBusy } from '@/server/services/locks'
import { effectiveSettings } from '@/server/services/settings'
import { refreshUsage } from '@/server/services/usage'
import { slog } from '@/server/infrastructure/server-log'
import { parseCron, minuteKey, type CronSpec } from '@/server/domain/cron'
import * as scheduleRepo from '@/server/data/repositories/schedule-repo'
import * as taskRepo from '@/server/data/repositories/task-repo'
import type { RunOptions } from '@/server/domain/types'


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

/** One scheduler pass. Exported so tests can drive it without timers. */
export async function tick(): Promise<void> {
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

// Sub-minute so a tick can't drift past a whole cron minute; the per-schedule
// minuteKey dedupe (via lastFiredAt) keeps a schedule to one fire per minute.
const TICK_MS = 30_000

/** Idempotent: starts the ticker once per process. */
export function ensureSchedulerStarted(): void {
    if (globalThis.__taskforgeScheduler) return
    globalThis.__taskforgeScheduler = setInterval(() => {
        void tick().catch(() => {})
    }, TICK_MS)
    // Don't keep the process alive solely for the ticker.
    globalThis.__taskforgeScheduler.unref?.()
    slog('info', 'scheduler', `ticker started (${TICK_MS / 1000}s)`)
}
