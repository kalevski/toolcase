// Pure quota-enforcement rules (§11) — no I/O and no `server-only` deps, so the
// three control-plane gates are unit-testable in isolation. `services/quota.ts`
// wraps these with the repository reads, the nginxpilot client, and the
// owner-tunable plan limits; this module owns only the *decisions*:
//
//   1. pre-create count gate         → `canCreateSite`
//   2. pre-create custom-domain gate → `canUseCustomDomain`
//   3. refresh cadence (fragment)    → `intervalFor`
//   4. post-deploy byte cap → grace → suspend → `decideByteQuota`
//
// nginxpilot has no concept of quotas, so all of this lives in Perch's control
// plane. See notes/static-hosting-app-design.md §11, §15.

import { formatInterval } from './nginxpilot-fragment'
import type { PlanLimits, SiteStatus } from './types'

// ── pre-create gates (§11 point 1) ───────────────────────────────────────────

/** Whether a user under `limits` may create another site (count strictly below the cap). */
export function canCreateSite(currentSiteCount: number, limits: PlanLimits): boolean {
    return currentSiteCount < limits.maxSites
}

/** Whether a user's plan permits attaching a custom domain (paid tiers only, §10). */
export function canUseCustomDomain(limits: PlanLimits): boolean {
    return limits.customDomains > 0
}

// ── refresh cadence (§11 point 3) ────────────────────────────────────────────

/**
 * The fragment `interval` for a plan — its `minIntervalSec` floor formatted as an
 * nginxpilot Go duration (free = 900 → `15m`; gold = 60 → `1m`). Free sites poll
 * GitHub slowly; sponsors get near-real-time redeploys, a perk that costs nothing
 * to enforce (it is just a number in the YAML).
 */
export function intervalFor(limits: PlanLimits): string {
    return formatInterval(limits.minIntervalSec)
}

// ── post-deploy byte cap → grace → suspend (§11 point 2) ─────────────────────

/**
 * What the byte-quota pass should do to a site:
 *   • `ok`        — within quota and in a normal state; nothing to do.
 *   • `mark`      — newly over quota; flag `over_quota`, notify, start the grace clock.
 *   • `hold`      — over quota and flagged, but the grace window hasn't elapsed yet.
 *   • `suspend`   — over quota past the grace window; stop serving (remove the fragment).
 *   • `reinstate` — back within quota while flagged/suspended; the limit was trimmed
 *                   away or the plan upgraded, so suspension is reversed.
 */
export type ByteQuotaAction = 'ok' | 'mark' | 'hold' | 'suspend' | 'reinstate'

export interface ByteQuotaInput {
    /** The site's current lifecycle status. */
    status: SiteStatus
    /** Last measured deployed size in bytes (an unmeasured site should pass 0). */
    bytes: number
    /** The owner's effective per-site byte cap (`PlanLimits.maxBytesPerSite`). */
    maxBytesPerSite: number
    /**
     * When the site entered `over_quota` (ISO) — its `updatedAt` while in that
     * state, used to measure the grace window. Absent for any other status.
     */
    overSince?: string
    /** Now (ISO) — injected so the grace calculation is deterministic under test. */
    now: string
    /** Grace window in seconds before an over-quota site is suspended (`0` = immediate). */
    graceSec: number
}

/**
 * Decide the byte-quota transition for one site. Encodes the §11 ladder
 * (over quota → flag + notify → grace window → suspend) and the reverse path
 * (trim/upgrade → reinstate). Pure, hence the load-bearing transition is
 * unit-tested directly; the service performs the resulting side effects.
 */
export function decideByteQuota(input: ByteQuotaInput): ByteQuotaAction {
    const over = input.bytes > input.maxBytesPerSite

    if (over) {
        // Already suspended — it has stopped serving; nothing left to enforce.
        if (input.status === 'suspended') return 'ok'
        // Flagged and waiting: suspend once the grace window has elapsed, else hold.
        if (input.status === 'over_quota') {
            return graceElapsed(input.overSince, input.now, input.graceSec) ? 'suspend' : 'hold'
        }
        // Newly over quota from any serving/working state — flag it and notify.
        return 'mark'
    }

    // Within quota: reverse a prior flag/suspension (trim or upgrade); else healthy.
    return input.status === 'over_quota' || input.status === 'suspended' ? 'reinstate' : 'ok'
}

/** True once `now - overSince >= graceSec`. Missing/unparseable timestamps never elapse (fail safe). */
function graceElapsed(overSince: string | undefined, now: string, graceSec: number): boolean {
    if (!overSince) return false
    const elapsedMs = Date.parse(now) - Date.parse(overSince)
    if (Number.isNaN(elapsedMs)) return false
    return elapsedMs >= graceSec * 1000
}
