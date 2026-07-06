// Scheduled-job cron ticker (the scheduling half of the Scheduled tasks page).
// Mirrors the quota-sweep / status-poll boot tickers: one globalThis-singleton
// `setInterval`, dev-hot-reload-safe, `unref`'d so it never keeps the process alive.
//
// The single-process app makes an in-memory ticker sufficient — no external cron.
// Each tick reads the enabled, scheduled jobs and fires the ones whose 5-field cron
// matches the current minute, at most once per minute per job (a per-job last-fired
// minute-key guards against the sub-minute tick cadence double-firing).

import 'server-only'
import * as jobRepo from '@/server/data/repositories/job-repo'
import { runJob, isRunning } from '@/server/services/jobs'
import { parseCron } from '@/server/domain/cron'
import { slog } from '@/server/infrastructure/server-log'

// Tick faster than a minute so a matching minute is never missed at a boundary; the
// minute-key dedupe below makes the extra ticks harmless.
const TICK_MS = 30_000

declare global {
    var __quaykeeperJobScheduler:
        | { timer: ReturnType<typeof setInterval>; lastFired: Map<string, number> }
        | undefined
}

/** The minute bucket a Date falls in — the dedupe key so a job fires at most once/minute. */
function minuteKey(d: Date): number {
    return Math.floor(d.getTime() / 60_000)
}

/**
 * Evaluate every enabled scheduled job against `now` and fire the matches. Exported
 * so a test / an admin "tick now" affordance can drive one pass deterministically.
 * A per-job failure (bad cron that slipped in, executor throw) is logged and skipped
 * so one job can't stall the rest. Already-running jobs are skipped (no pile-up).
 */
export async function tick(now: Date, lastFired: Map<string, number>): Promise<void> {
    const key = minuteKey(now)
    for (const job of jobRepo.listSchedulable()) {
        if (!job.schedule) continue
        if (lastFired.get(job.id) === key) continue // already handled this minute
        try {
            if (!parseCron(job.schedule).matches(now)) continue
        } catch (err) {
            slog('warn', 'job-scheduler', 'skipping job with unparseable schedule', {
                job: job.id,
                schedule: job.schedule,
                error: String(err),
            })
            lastFired.set(job.id, key) // don't re-log every tick this minute
            continue
        }
        lastFired.set(job.id, key)
        if (isRunning(job.id)) {
            slog('warn', 'job-scheduler', 'skip: previous run still in progress', { job: job.id, name: job.name })
            continue
        }
        // Fire without awaiting so a long job can't delay the rest of this pass; its
        // own timeout + the running-guard bound it. Errors are swallowed to the log.
        void runJob(job.id, 'schedule').catch((err) =>
            slog('error', 'job-scheduler', 'scheduled run failed', { job: job.id, error: String(err) }),
        )
    }
    // Drop dedupe keys older than the current minute so the map can't grow unbounded.
    for (const [id, k] of lastFired) {
        if (k < key) lastFired.delete(id)
    }
}

/** Idempotent: starts the cron ticker once per process. */
export function ensureJobSchedulerStarted(): void {
    if (globalThis.__quaykeeperJobScheduler) return
    const lastFired = new Map<string, number>()
    const timer = setInterval(() => {
        void tick(new Date(), lastFired).catch((err) =>
            slog('error', 'job-scheduler', 'tick failed', { error: String(err) }),
        )
    }, TICK_MS)
    timer.unref?.()
    globalThis.__quaykeeperJobScheduler = { timer, lastFired }
    slog('info', 'job-scheduler', 'ticker started', { intervalMs: TICK_MS })
}
