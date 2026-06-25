// Pure plan-resolution rules — no I/O and no `server-only` deps, so the
// sponsorship → plan decision is unit-testable in isolation. `services/plan.ts`
// wraps these in repository reads (`sponsorshipRepo` + `planTierRepo`); this
// module owns only *which* plan a sponsorship maps to, never the persistence.
//
// A user's effective plan = max(free, plan derived from their active GitHub
// sponsorship tier) — the tier is bucketed through the owner-editable `plan_tier`
// mapping and is never stored on the user. See notes/static-hosting-app-design.md
// §6, §8, §15.

import type { Plan, PaidPlan, PlanTier, Sponsorship } from '@/server/domain/types'

/** Strict plan ordering used for the `max(free, sponsorPlan)` comparison. Higher = more access. */
export const PLAN_RANK: Record<Plan, number> = { free: 0, bronze: 1, silver: 2, gold: 3 }

/** The higher-ranked of two plans (ties return `a`). */
export function maxPlan(a: Plan, b: Plan): Plan {
    return PLAN_RANK[a] >= PLAN_RANK[b] ? a : b
}

/**
 * Bucket a monthly sponsorship amount (cents) through the `plan_tier` mapping:
 * the tier with the largest `minCents` that is still `<= tierCents` wins. Returns
 * `null` when the amount is below every configured threshold (→ no paid plan).
 * Order-independent, so it does not rely on `planTierRepo.list()`'s sort.
 */
export function bucketTier(tierCents: number, tiers: PlanTier[]): PaidPlan | null {
    let match: PlanTier | null = null
    for (const t of tiers) {
        if (t.minCents <= tierCents && (match === null || t.minCents > match.minCents)) {
            match = t
        }
    }
    return match?.plan ?? null
}

/**
 * The effective plan for a sponsorship + tier mapping. An absent, cancelled, or
 * pending-cancel sponsorship yields `free`; an active one is bucketed through the
 * mapping (a tier below every threshold still falls back to `free`). The result
 * is `max(free, sponsorPlan)`, so the baseline can never be undercut.
 */
export function effectivePlan(sponsorship: Sponsorship | undefined, tiers: PlanTier[]): Plan {
    if (!sponsorship || sponsorship.status !== 'active') return 'free'
    const sponsorPlan: Plan = bucketTier(sponsorship.tierCents, tiers) ?? 'free'
    return maxPlan('free', sponsorPlan)
}
