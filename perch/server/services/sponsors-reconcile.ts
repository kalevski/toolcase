// Scheduled Sponsors reconcile (§8). A 60s `setInterval` ticker (globalThis
// singleton, same dev-hot-reload-safe pattern as TaskForge's
// `services/scheduler.ts`) checks a 5-field cron each minute and, when it fires,
// queries the owner's `sponsorshipsAsMaintainer` GraphQL connection and upserts
// the authoritative state — overriding stale webhook rows. The GraphQL query is
// the source of truth that self-heals missed/forged webhooks (§16). No external
// cron dependency; the single-process app makes this safe.

import 'server-only'
import { config } from '@/server/config'
import { parseCron, type CronSpec } from '@/server/domain/cron'
import { reconcileToSponsorships } from '@/server/domain/sponsorship-events'
import { fetchSponsorshipsAsMaintainer } from '@/server/infrastructure/github-sponsors'
import { slog } from '@/server/infrastructure/server-log'
import * as sponsorshipRepo from '@/server/data/repositories/sponsorship-repo'

/**
 * Run one reconcile pass now: fetch the maintainer's sponsorships and upsert each
 * as the authoritative row (active/cancelled per `isActive`). No-ops when no owner
 * PAT is configured. Returns the number of rows upserted. Exposed for an
 * admin-triggered "reconcile now" and reused by the ticker.
 */
export async function reconcileNow(): Promise<number> {
    if (!config.sponsorsReconcileToken) {
        slog('info', 'sponsors-reconcile', 'skip: PERCH_SPONSORS_TOKEN not configured')
        return 0
    }
    const nodes = await fetchSponsorshipsAsMaintainer(config.sponsorsReconcileToken)
    const now = new Date().toISOString()
    const rows = reconcileToSponsorships(nodes, now)
    for (const r of rows) sponsorshipRepo.upsert(r)
    // The GraphQL connection is authoritative (§8): delete any local row whose sponsor
    // is no longer present, so a vacated/recycled login can't linger as an active grant
    // (S3). Without this, a takeover where the old account left the sponsor list would
    // leave a stale row that a recycled login could inherit.
    const present = new Set(rows.map((r) => r.sponsorId))
    let pruned = 0
    for (const id of sponsorshipRepo.allIds()) {
        if (!present.has(id)) {
            sponsorshipRepo.removeById(id)
            pruned++
        }
    }
    slog('info', 'sponsors-reconcile', 'reconciled sponsorships', { count: rows.length, pruned })
    return rows.length
}

/** Minute-resolution key used to dedupe firing within one cron minute. */
function minuteKey(d: Date): string {
    return d.toISOString().slice(0, 16)
}

declare global {
    var __perchSponsorsReconcile:
        | { timer: ReturnType<typeof setInterval>; lastFired: string | null }
        | undefined
}

async function tick(): Promise<void> {
    let spec: CronSpec
    try {
        spec = parseCron(config.sponsorsReconcileCron)
    } catch (err) {
        slog('warn', 'sponsors-reconcile', 'invalid cron — reconcile disabled', {
            cron: config.sponsorsReconcileCron,
            error: String(err),
        })
        return
    }
    const now = new Date()
    if (!spec.matches(now)) return
    // one fire per cron minute, even across ticker drift / multiple ticks
    const key = minuteKey(now)
    const state = globalThis.__perchSponsorsReconcile
    if (!state || state.lastFired === key) return
    state.lastFired = key
    try {
        await reconcileNow()
    } catch (err) {
        slog('error', 'sponsors-reconcile', 'reconcile failed', { error: String(err) })
    }
}

/** Idempotent: starts the 60s ticker once per process. */
export function ensureReconcileSchedulerStarted(): void {
    if (globalThis.__perchSponsorsReconcile) return
    const timer = setInterval(() => {
        void tick().catch(() => {})
    }, 60_000)
    // Don't keep the process alive solely for the ticker.
    timer.unref?.()
    globalThis.__perchSponsorsReconcile = { timer, lastFired: null }
    slog('info', 'sponsors-reconcile', 'ticker started (60s)', { cron: config.sponsorsReconcileCron })
}
