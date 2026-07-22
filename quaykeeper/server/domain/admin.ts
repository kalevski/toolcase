// Pure owner-admin decisions (§6, §8, §13) — no `server-only`, no I/O, so the
// load-bearing rules behind the `/api/admin/**` routes are unit-testable in
// isolation. `services/admin.ts` wraps these with the repository reads/writes,
// the deploy seam, and the audit log; this module owns only the *decisions*:
//
//   • `meetsMinRole`    — the role-rank gate behind `authorize(minRole)` (the
//                         owner endpoints return 403 to anyone below `owner`).
//   • `checkBaseDomain` — an owner-registered base domain must be a valid FQDN
//                         (reuses the shared hostname shape check).
//
// See notes/static-hosting-app-design.md §6, §8, §12, §13.

import { NUMERIC_LIMIT_KEYS, ROLE_RANK, type Role, type UserLimitOverride } from '@/server/domain/types'
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
 * role, so it is not assignable. `owner` / `standard` are; the service
 * additionally blocks demoting the *last* owner (instance lock-out).
 */
export const ASSIGNABLE_ROLES: ReadonlySet<Role> = new Set<Role>(['owner', 'standard'])

/** Type guard: a request-supplied value is one of the assignable roles. */
export function isAssignableRole(value: unknown): value is Role {
    return typeof value === 'string' && (ASSIGNABLE_ROLES as ReadonlySet<string>).has(value)
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
 *   • each capability flag (`privateRepos`, `advancedConfig`) — when present — is a boolean.
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

    for (const key of ['privateRepos', 'advancedConfig'] as const) {
        const v = src[key]
        if (v === undefined || v === null) continue
        if (typeof v !== 'boolean') {
            return { ok: false, reason: 'bad_flag', message: `${key} must be a boolean` }
        }
        override[key] = v
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
