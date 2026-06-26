// Plan-resolution service — a user's effective plan + quota limits, computed
// (never stored) from their sponsorship row and the owner-editable `plan_tier`
// mapping. Pure policy over repositories: no HTTP, no cookies. The bucketing
// rules live in the unit-tested `server/domain/plan-resolution.ts`; this layer
// only supplies the repository reads and the `PLAN_LIMITS` defaults.
//
// See notes/static-hosting-app-design.md §6, §8, §15.

import 'server-only'
import * as sponsorshipRepo from '@/server/data/repositories/sponsorship-repo'
import * as planTierRepo from '@/server/data/repositories/plan-tier-repo'
import * as userRepo from '@/server/data/repositories/user-repo'
import * as userLimitRepo from '@/server/data/repositories/user-limit-repo'
import { mergeLimits, PLAN_LIMITS, UNLIMITED_LIMITS, type Plan, type PlanLimits } from '@/server/domain/types'
import { effectivePlan } from '@/server/domain/plan-resolution'

/**
 * The effective plan for a GitHub login. Reads the user's `sponsorship` row
 * (linked by login) and buckets an *active* tier through the `plan_tier` mapping;
 * any non-active or absent sponsorship resolves to `free`. Re-read each call so a
 * tier change is reflected immediately, without a migration or backfill.
 */
export function resolvePlan(login: string): Plan {
    return effectivePlan(sponsorshipRepo.get(login), planTierRepo.list())
}

/**
 * The quota limits for a login's effective plan (the §15 `PLAN_LIMITS` defaults).
 * Instance operators are exempt from tiers entirely — both the bootstrap `owner`
 * and any `maintainer` get `UNLIMITED_LIMITS`, so every quota gate (site count,
 * custom domains, byte cap, interval) passes regardless of any sponsorship plan
 * they happen to hold (§6). Every gate flows through this one function
 * (`assertCanCreateSite`, `assertCanUseCustomDomain`, byte caps, interval), so
 * the exemption is total and lives in exactly one place.
 *
 * Finally, an owner-set per-user override (`user_limit`, §11/§15) is merged on top
 * of that role/plan base — the override's present fields win, so the owner can lift
 * or cap any one account (even an operator) without touching the global defaults.
 */
export function resolveLimits(login: string): PlanLimits {
    const user = userRepo.getByLogin(login)
    const base =
        user && (user.role === 'owner' || user.role === 'maintainer')
            ? UNLIMITED_LIMITS
            : PLAN_LIMITS[resolvePlan(login)]
    const override = user ? userLimitRepo.get(user.githubId) : undefined
    return mergeLimits(base, override)
}
