// Scheduled byte-quota sweep (§11, C1). The control plane is the only thing that can
// enforce per-site byte caps — nginxpilot just serves. Deploy-time tracking
// (`services/sites.trackAndEnforce`) measures `bytes` right after a deploy, but a site
// can grow between deploys, and a process restart can drop an in-flight track; this
// periodic sweep is the durable backstop. Each pass reads every realm's `GET /status`
// once (grouping sites by realm so it's one fetch per instance, not per site), records
// the freshly-measured `bytes`, and runs `enforceBytes` (over_quota → grace → suspend).
//
// Same globalThis-singleton, dev-hot-reload-safe ticker shape as
// the other boot tickers. No external cron; the single-process app makes it safe.

import 'server-only'
import * as siteRepo from '@/server/data/repositories/site-repo'
import * as realms from '@/server/services/realms'
import { enforceBytes } from '@/server/services/quota'
import { slog } from '@/server/infrastructure/server-log'
import type { NginxpilotStatus } from '@/server/infrastructure/nginxpilot'

/** Sweep cadence. A few minutes is fine: caps are soft (grace-windowed), not real-time. */
const SWEEP_INTERVAL_MS = 5 * 60_000

declare global {
    var __perchQuotaSweep: { timer: ReturnType<typeof setInterval> } | undefined
}

/**
 * Run one sweep pass now: for every site, refresh `bytes` from its realm's `/status`
 * (one fetch per realm, cached across that realm's sites) and apply the byte-cap ladder.
 * A per-site failure is logged and skipped so one unreachable realm can't stall the rest.
 * Returns counts for the admin "sweep now" affordance / logs.
 */
export async function sweepNow(): Promise<{ scanned: number; measured: number; failed: number }> {
    const sites = siteRepo.list()
    const statusByRealm = new Map<string, NginxpilotStatus>()
    let measured = 0
    let failed = 0
    for (const site of sites) {
        try {
            let env = statusByRealm.get(site.realmId)
            if (!env) {
                env = await realms.clientForSite(site).status()
                statusByRealm.set(site.realmId, env)
            }
            const entry = env.sites.find((s) => s.domain === site.hostname)
            let current = site
            if (entry?.bytes != null && entry.bytes !== current.bytes) {
                const at = new Date().toISOString()
                siteRepo.updateBytes(current.id, entry.bytes, at)
                current = { ...current, bytes: entry.bytes, updatedAt: at }
                measured++
            }
            await enforceBytes(current)
        } catch (err) {
            failed++
            slog('warn', 'quota-sweep', 'site sweep failed', { site: site.id, error: String(err) })
        }
    }
    slog('info', 'quota-sweep', 'sweep complete', { scanned: sites.length, measured, failed })
    return { scanned: sites.length, measured, failed }
}

/** Idempotent: starts the sweep ticker once per process. */
export function ensureQuotaSweepStarted(): void {
    if (globalThis.__perchQuotaSweep) return
    const timer = setInterval(() => {
        void sweepNow().catch((err) => slog('error', 'quota-sweep', 'sweep failed', { error: String(err) }))
    }, SWEEP_INTERVAL_MS)
    // Don't keep the process alive solely for the ticker.
    timer.unref?.()
    globalThis.__perchQuotaSweep = { timer }
    slog('info', 'quota-sweep', 'ticker started', { intervalMs: SWEEP_INTERVAL_MS })
}
