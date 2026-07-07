// Limit-resolution service — a user's effective quota limits, computed (never
// stored) from their role and the owner-set per-user override. Pure policy over
// repositories: no HTTP, no cookies. The multi-plan system (sponsorship-driven
// bronze/silver/gold tiers) is gone — every non-operator account runs on the
// single STANDARD_LIMITS baseline, and the per-user `user_limit` override is the
// only way above it.
//
// See notes/static-hosting-app-design.md §6, §11, §15.

import 'server-only'
import * as userRepo from '@/server/data/repositories/user-repo'
import * as userLimitRepo from '@/server/data/repositories/user-limit-repo'
import {
    mergeLimits,
    STANDARD_LIMITS,
    UNLIMITED_LIMITS,
    type AppUser,
    type PlanLimits,
    type UserLimitOverride,
} from '@/server/domain/types'

/**
 * The quota limits for a login. The instance `owner` is exempt from quotas
 * entirely — an `owner` gets `UNLIMITED_LIMITS`, so every quota gate (site count,
 * custom domains, byte cap, interval) passes (§6). Everyone else starts from
 * `STANDARD_LIMITS`. Every gate flows through this one function
 * (`assertCanCreateSite`, `assertCanUseCustomDomain`, byte caps, interval), so
 * the exemption is total and lives in exactly one place.
 *
 * The owner-set per-user override (`user_limit`, §11/§15) is merged on top of
 * that role base — the override's present fields win, so the owner can lift or
 * cap any one account without touching the global defaults.
 */
export function resolveLimits(login: string): PlanLimits {
    const user = userRepo.getByLogin(login)
    const base = user && user.role === 'owner' ? UNLIMITED_LIMITS : STANDARD_LIMITS
    const override = user ? userLimitRepo.get(user.githubId) : undefined
    return mergeLimits(base, override)
}

/**
 * Effective limits from an already-loaded user + override — the batch counterpart
 * to {@link resolveLimits} (the admin roster loads overrides in bulk to avoid an
 * N+1 read per user). The `owner` gets `UNLIMITED_LIMITS`; the per-user override
 * is merged on top, exactly as the per-request path.
 */
export function effectiveLimitsFor(user: AppUser, override: UserLimitOverride | null): PlanLimits {
    const base = user.role === 'owner' ? UNLIMITED_LIMITS : STANDARD_LIMITS
    return mergeLimits(base, override ?? undefined)
}
