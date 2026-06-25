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
import { PLAN_LIMITS, type Plan, type PlanLimits } from '@/server/domain/types'
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

/** The quota limits for a login's effective plan (the §15 `PLAN_LIMITS` defaults). */
export function resolveLimits(login: string): PlanLimits {
    return PLAN_LIMITS[resolvePlan(login)]
}
