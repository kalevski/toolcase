// Pure owner-admin decisions (§6, §8, §13) — no `server-only`, no I/O, so the
// load-bearing rules behind the `/api/admin/**` routes are unit-testable in
// isolation. `services/admin.ts` wraps these with the repository reads/writes,
// the deploy seam, and the audit log; this module owns only the *decisions*:
//
//   • `meetsMinRole`    — the role-rank gate behind `authorize(minRole)` (the
//                         owner endpoints return 403 to anyone below `owner`).
//   • `parsePlanTiers`  — validate + normalize an owner-supplied `$ → plan`
//                         mapping into a sorted, deduped `PlanTier[]` (the PUT
//                         body), so a replace round-trips against `planTierRepo`'s
//                         `ORDER BY min_cents` read.
//   • `checkBaseDomain` — an owner-registered base domain must be a valid FQDN
//                         (reuses the shared hostname shape check).
//
// See notes/static-hosting-app-design.md §6, §8, §12, §13.

import {
    NUMERIC_LIMIT_KEYS,
    ROLE_RANK,
    type PaidPlan,
    type PlanTier,
    type Role,
    type UserLimitOverride,
} from '@/server/domain/types'
import { checkDomain, type DomainCheck } from '@/server/domain/hostname'

// ── role gate (the owner endpoints' 403, §13) ──────────────────────────────────

/**
 * Whether `role` meets `minRole` under the strict `ROLE_RANK` ordering — the exact
 * decision `authorize(minRole)` enforces (a session below `minRole` gets 403). Pure,
 * so the "non-owner can't reach an owner endpoint" rule is pinned by a unit test
 * rather than only exercised through the `server-only` auth service.
 */
export function meetsMinRole(role: Role, minRole: Role): boolean {
    return ROLE_RANK[role] >= ROLE_RANK[minRole]
}

// ── role assignment (the owner-only Users moderation, §6/§13) ──────────────────

/**
 * The roles an owner may assign to another account. `guest` is the runtime
 * fallback for a session whose user row is gone (`authorize`), never a stored
 * role, so it is not assignable. `owner` / `maintainer` / `standard` are; the
 * service additionally blocks demoting the *last* owner (instance lock-out).
 */
export const ASSIGNABLE_ROLES: ReadonlySet<Role> = new Set<Role>(['owner', 'maintainer', 'standard'])

/** Type guard: a request-supplied value is one of the assignable roles. */
export function isAssignableRole(value: unknown): value is Role {
    return typeof value === 'string' && (ASSIGNABLE_ROLES as ReadonlySet<string>).has(value)
}

// ── plan-tier mapping validation (the PUT body, §8) ────────────────────────────

/** The paid plans a sponsorship tier may map to — the free tier is never stored (§8). */
export const PAID_PLANS: ReadonlySet<PaidPlan> = new Set<PaidPlan>(['bronze', 'silver', 'gold'])

/** Why a plan-tier replacement body was rejected (the service maps it to a 400). */
export type PlanTiersRejection = 'not_array' | 'bad_row' | 'bad_cents' | 'bad_plan' | 'duplicate_cents'

/** Result of {@link parsePlanTiers}: the normalized mapping, or a typed rejection. */
export type PlanTiersCheck =
    | { ok: true; tiers: PlanTier[] }
    | { ok: false; reason: PlanTiersRejection; message: string }

/**
 * Validate + normalize an owner-supplied `$ → plan` mapping (the `PUT
 * /api/admin/plan-tiers` body) into a sorted, deduped `PlanTier[]`. Enforces:
 *
 *   • the body is an array of `{ minCents, plan }` rows,
 *   • `minCents` is a non-negative integer (it's the primary key / the cents floor),
 *   • `plan` is one of the paid plans (`bronze | silver | gold`),
 *   • no two rows share a `minCents` (it's the PK — a dup would silently drop a row).
 *
 * Returns the rows sorted cheapest-first, matching `planTierRepo.list()`'s
 * `ORDER BY min_cents`, so a replace → read round-trips to an equal array. Pure (no
 * I/O), so the validation and the round-trip ordering are unit-tested directly.
 */
export function parsePlanTiers(input: unknown): PlanTiersCheck {
    if (!Array.isArray(input)) {
        return { ok: false, reason: 'not_array', message: 'plan tiers must be an array of { minCents, plan }' }
    }
    const seen = new Set<number>()
    const tiers: PlanTier[] = []
    for (const row of input) {
        if (!row || typeof row !== 'object') {
            return { ok: false, reason: 'bad_row', message: 'each plan tier must be an object' }
        }
        const { minCents, plan } = row as { minCents?: unknown; plan?: unknown }
        if (typeof minCents !== 'number' || !Number.isInteger(minCents) || minCents < 0) {
            return { ok: false, reason: 'bad_cents', message: 'minCents must be a non-negative integer' }
        }
        if (typeof plan !== 'string' || !PAID_PLANS.has(plan as PaidPlan)) {
            return { ok: false, reason: 'bad_plan', message: 'plan must be one of: bronze, silver, gold' }
        }
        if (seen.has(minCents)) {
            return { ok: false, reason: 'duplicate_cents', message: `duplicate minCents ${minCents}` }
        }
        seen.add(minCents)
        tiers.push({ minCents, plan: plan as PaidPlan })
    }
    tiers.sort((a, b) => a.minCents - b.minCents)
    return { ok: true, tiers }
}

// ── per-user limit overrides (the owner's Users editor, §11/§15) ───────────────

/** Why a per-user limit override body was rejected (the service maps it to a 400). */
export type UserLimitsRejection = 'not_object' | 'bad_number' | 'bad_flag'

/** Result of {@link parseUserLimits}: the normalized override, or a typed rejection. */
export type UserLimitsCheck =
    | { ok: true; override: UserLimitOverride }
    | { ok: false; reason: UserLimitsRejection; message: string }

/**
 * Validate + normalize an owner-supplied per-user limit override (the `PUT
 * /api/admin/users/{id}/limits` body). Every field is optional; only the present
 * ones are overridden, the rest inherit the role/plan default. Enforces:
 *
 *   • each numeric quota (`maxSites`, byte caps, `minIntervalSec`, `customDomains`,
 *     `keepReleases`) — when present and not null — is a finite, non-negative
 *     integer (no `Infinity`: JSON can't carry it, so "unlimited" = leave it out),
 *   • `privateRepos` — when present — is a boolean.
 *
 * `null`/`undefined` fields are treated as "inherit" and dropped from the result,
 * so a partly-filled editor that blanks a field clears just that one override. Pure
 * (no I/O), so the field rules are unit-tested directly.
 */
export function parseUserLimits(input: unknown): UserLimitsCheck {
    if (!input || typeof input !== 'object') {
        return { ok: false, reason: 'not_object', message: 'limits must be an object' }
    }
    const src = input as Record<string, unknown>
    const override: UserLimitOverride = {}

    for (const key of NUMERIC_LIMIT_KEYS) {
        const v = src[key]
        if (v === undefined || v === null) continue
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
            return { ok: false, reason: 'bad_number', message: `${key} must be a non-negative integer` }
        }
        override[key] = v
    }

    const repos = src.privateRepos
    if (repos !== undefined && repos !== null) {
        if (typeof repos !== 'boolean') {
            return { ok: false, reason: 'bad_flag', message: 'privateRepos must be a boolean' }
        }
        override.privateRepos = repos
    }

    return { ok: true, override }
}

// ── base-domain validation (the subdomain pool, §10) ───────────────────────────

/**
 * Validate an owner-supplied base domain (`POST /api/admin/base-domains`). A base
 * domain backs `<label>.<domain>` subdomain sites, so it must itself be a valid,
 * DNS-safe FQDN — exactly the shape check a custom domain passes. Returns the
 * normalized (trimmed, lowercased) domain; uniqueness is the service's job.
 */
export function checkBaseDomain(raw: string): DomainCheck {
    return checkDomain(raw)
}
