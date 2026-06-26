// Owner-admin service (§6, §13) — the policy layer the `/api/admin/**` routes call,
// all reached only after `authorize('owner')`. It owns the four owner-only surfaces:
//
//   1. Subdomain pool   — list / add / remove base domains (`baseDomainRepo`, §10).
//   2. Plan-tier mapping — read / replace the owner-editable `$ → plan` table
//      (`planTierRepo`); changes apply to effective plans *immediately* because the
//      plan is computed (`services/plan.ts`), never stored on the user (§8, §12).
//   3. Site moderation   — list every site, suspend any one (drop its fragment via the
//      deploy service, §727 — the row is kept, so it's reversible) (§11, §13).
//   4. Audit log         — read the append-only trail, newest-first (`auditRepo`, §12).
//
// Every owner MUTATION writes an audit entry attributed to the acting owner (§13,
// §16) — including the suspend, whose deploy-layer transition is deliberately
// un-audited so the moderation record carries the right actor. Pure validation lives
// in `domain/admin.ts`; this is the `server-only` wiring. Errors surface as a typed
// `AdminError` that `httpErrorFor` maps to a status + machine-readable code.
//
// See notes/static-hosting-app-design.md §6, §8, §11, §12, §13, §16.

import 'server-only'
import * as baseDomainRepo from '@/server/data/repositories/base-domain-repo'
import * as planTierRepo from '@/server/data/repositories/plan-tier-repo'
import * as siteRepo from '@/server/data/repositories/site-repo'
import * as userRepo from '@/server/data/repositories/user-repo'
import * as userLimitRepo from '@/server/data/repositories/user-limit-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import * as deploy from '@/server/services/deploy'
import { checkBaseDomain, isAssignableRole, parsePlanTiers, parseUserLimits } from '@/server/domain/admin'
import { resolveLimits, resolvePlan } from '@/server/services/plan'
import { summarizeUsage } from '@/server/domain/usage'
import { NginxpilotError } from '@/server/infrastructure/nginxpilot'
import { slog } from '@/server/infrastructure/server-log'
import {
    accountLevel,
    isBaseDomainTier,
    visibleBaseDomainTiers,
    type AdminUserRow,
    type AppUser,
    type AuditEntry,
    type BaseDomain,
    type BaseDomainTier,
    type PlanTier,
    type Role,
    type Site,
    type UserLimitOverride,
} from '@/server/domain/types'
import type { AuditFilter } from '@/server/data/repositories/audit-repo'

/**
 * An owner-admin refusal: a malformed body (`400`), a missing target (`404`), or a
 * conflict such as a base domain that already exists (`409`). Carries the
 * machine-readable `code` and HTTP `status` a route returns (mirrors `SiteError` /
 * `QuotaError` / `HostnameError`).
 */
export class AdminError extends Error {
    constructor(
        message: string,
        public code: string,
        public status: 400 | 404 | 409,
    ) {
        super(message)
        this.name = 'AdminError'
    }
}

/** The acting owner, derived from the session — attributed on every audit entry (§16). */
export interface AdminActor {
    githubId: number
    login: string
}

/** Append one audit entry attributed to the acting owner. */
function audit(actor: AdminActor, action: string, opts: { site?: string; detail?: string } = {}): void {
    auditRepo.append({
        githubId: actor.githubId,
        login: actor.login,
        action,
        site: opts.site ?? null,
        detail: opts.detail ?? null,
    })
}

// ── base domains (the subdomain pool, §10) ─────────────────────────────────────

/** Every registered base domain, oldest first — the owner sees the whole pool. */
export function listBaseDomains(): BaseDomain[] {
    return baseDomainRepo.list()
}

/**
 * The base domains a given user may attach a subdomain under, filtered by the
 * tier-visibility rules (§10): a free-plan user sees only `free` domains, a paid
 * (sponsored) user sees `free` + `paid`, and an instance operator (`maintainer`/
 * `owner`) sees every tier including `staff`. Backs the standard, non-owner
 * `GET /api/base-domains` projection the create-site wizard reads. Role is read
 * live from the repo (authoritative); the plan is computed from the sponsorship.
 */
export function listBaseDomainsFor(login: string): BaseDomain[] {
    const role: Role = userRepo.getByLogin(login)?.role ?? 'guest'
    const allowed = new Set(visibleBaseDomainTiers(role, resolvePlan(login)))
    return baseDomainRepo.list().filter((b) => allowed.has(b.tier))
}

/**
 * Register a base domain (`POST /api/admin/base-domains`): validate the FQDN shape
 * and the audience `tier`, reject a duplicate (`409`), persist it, and audit. `tier`
 * defaults to `free` when omitted. Returns the new row.
 */
export function addBaseDomain(actor: AdminActor, raw: unknown, rawTier: unknown = 'free'): BaseDomain {
    if (typeof raw !== 'string') throw new AdminError('"domain" is required', 'invalid_request', 400)
    const checked = checkBaseDomain(raw)
    if (!checked.ok) throw new AdminError(checked.message, `domain_${checked.reason}`, 400)
    const domain = checked.domain

    const tier: BaseDomainTier = rawTier === undefined || rawTier === null ? 'free' : (rawTier as BaseDomainTier)
    if (!isBaseDomainTier(tier)) {
        throw new AdminError('tier must be one of: free, paid, staff', 'invalid_tier', 400)
    }

    if (baseDomainRepo.list().some((b) => b.domain.toLowerCase() === domain)) {
        throw new AdminError(`base domain "${domain}" is already registered`, 'base_domain_exists', 409)
    }

    const createdAt = new Date().toISOString()
    baseDomainRepo.add(domain, tier, createdAt)
    audit(actor, 'admin.base_domain.add', { detail: `${domain} (${tier})` })
    slog('info', 'admin', 'base domain added', { domain, tier, by: actor.login })
    return { domain, tier, createdAt }
}

/**
 * Remove a base domain (`DELETE /api/admin/base-domains`): normalize the FQDN, delete
 * it (idempotent — a no-op on an unknown domain), and audit. Existing subdomain sites
 * under it are unaffected by this row delete; the owner moderates those separately.
 */
export function removeBaseDomain(actor: AdminActor, raw: unknown): void {
    if (typeof raw !== 'string') throw new AdminError('"domain" is required', 'invalid_request', 400)
    const checked = checkBaseDomain(raw)
    if (!checked.ok) throw new AdminError(checked.message, `domain_${checked.reason}`, 400)
    const domain = checked.domain

    baseDomainRepo.remove(domain)
    audit(actor, 'admin.base_domain.remove', { detail: domain })
    slog('info', 'admin', 'base domain removed', { domain, by: actor.login })
}

// ── plan-tier mapping (the $ → plan table, §8) ─────────────────────────────────

/** The current `$ → plan` mapping, cheapest-first. */
export function getPlanTiers(): PlanTier[] {
    return planTierRepo.list()
}

/**
 * Replace the whole `$ → plan` mapping (`PUT /api/admin/plan-tiers`): validate +
 * normalize the body (`400` on a malformed mapping), atomically swap the table, and
 * audit. Returns the stored mapping (re-read, cheapest-first). Effective plans update
 * immediately — they're computed from this table per request (§8, §12), never stored —
 * so no migration or backfill is needed for a tier change to take effect.
 */
export function replacePlanTiers(actor: AdminActor, input: unknown): PlanTier[] {
    const checked = parsePlanTiers(input)
    if (!checked.ok) throw new AdminError(checked.message, `plan_tiers_${checked.reason}`, 400)

    planTierRepo.replace(checked.tiers)
    const detail = checked.tiers.map((t) => `${t.minCents}=${t.plan}`).join(',') || '(empty)'
    audit(actor, 'admin.plan_tier.replace', { detail })
    slog('info', 'admin', 'plan tiers replaced', { count: checked.tiers.length, by: actor.login })
    return planTierRepo.list()
}

// ── site moderation (§11, §13) ─────────────────────────────────────────────────

/** Every site, newest first — the global owner moderation view. */
export function listAllSites(): Site[] {
    return siteRepo.list()
}

/** Every signed-in user, oldest first (the bootstrap owner leads) — owner roster (§6, §13). */
export function listUsers(): AppUser[] {
    return userRepo.list()
}

/**
 * Enrich one user into an {@link AdminUserRow}: their effective plan + unified
 * account level, current usage (count + bytes across their sites), the *effective*
 * limits (role/plan default merged with any override), and the raw custom override.
 * `override` is passed in by {@link listUsersDetailed} from a single batch read; it
 * defaults to a per-user read so the single-row callers (set/clear) stay correct.
 */
function enrichUser(user: AppUser, override?: UserLimitOverride | null): AdminUserRow {
    const plan = resolvePlan(user.login)
    const custom = override !== undefined ? override : (userLimitRepo.get(user.githubId) ?? null)
    return {
        user,
        plan,
        level: accountLevel(user.role, plan),
        usage: summarizeUsage(siteRepo.listByOwner(user.githubId)),
        limits: resolveLimits(user.login),
        customLimits: custom,
    }
}

/**
 * The enriched owner roster (`GET /api/admin/users`): every user with their plan,
 * level, usage, effective limits, and custom override. Overrides are read in one
 * batch query and zipped in, so the roster is a handful of queries, not N per user.
 */
export function listUsersDetailed(): AdminUserRow[] {
    const overrides = userLimitRepo.all()
    return userRepo.list().map((u) => enrichUser(u, overrides.get(u.githubId) ?? null))
}

/**
 * Set (replace) a user's custom limit override (`PUT /api/admin/users/{id}/limits`).
 * Validates the body (`400`), requires the target to exist (`404`), persists the
 * override (an all-empty body clears it), and audits. Effective limits update
 * immediately — they're resolved per request (§11). Returns the enriched user row.
 */
export function setUserLimits(actor: AdminActor, githubId: unknown, raw: unknown): AdminUserRow {
    if (typeof githubId !== 'number' || !Number.isInteger(githubId)) {
        throw new AdminError('"githubId" must be an integer', 'invalid_request', 400)
    }
    const target = userRepo.get(githubId)
    if (!target) throw new AdminError('user not found', 'user_not_found', 404)

    const checked = parseUserLimits(raw)
    if (!checked.ok) throw new AdminError(checked.message, `limits_${checked.reason}`, 400)

    userLimitRepo.set(githubId, checked.override, new Date().toISOString())
    const detail = summarizeOverride(checked.override)
    audit(actor, 'admin.user.limits', { detail: `${target.login}: ${detail}` })
    slog('info', 'admin', 'user limits set', { login: target.login, detail, by: actor.login })
    return enrichUser(target)
}

/** Clear a user's custom override (`DELETE /api/admin/users/{id}/limits`), reverting to defaults. */
export function clearUserLimits(actor: AdminActor, githubId: unknown): AdminUserRow {
    if (typeof githubId !== 'number' || !Number.isInteger(githubId)) {
        throw new AdminError('"githubId" must be an integer', 'invalid_request', 400)
    }
    const target = userRepo.get(githubId)
    if (!target) throw new AdminError('user not found', 'user_not_found', 404)

    userLimitRepo.remove(githubId)
    audit(actor, 'admin.user.limits', { detail: `${target.login}: cleared (defaults)` })
    slog('info', 'admin', 'user limits cleared', { login: target.login, by: actor.login })
    return enrichUser(target)
}

/** A compact `key=value` summary of an override for the audit detail. */
function summarizeOverride(o: UserLimitOverride): string {
    const parts = Object.entries(o).map(([k, v]) => `${k}=${v}`)
    return parts.length ? parts.join(',') : '(empty)'
}

/**
 * Change a user's role (`PATCH /api/admin/users`) — the owner-only power to grant
 * `maintainer` (routing access + quota exemption, but no admin) or `owner`, or to
 * drop back to `standard`. Validates the target role (`400`), requires the target
 * to exist (`404`), and refuses to demote the *last* `owner` (`409`) so the
 * instance can never be locked out of its admin surface. A no-op (same role)
 * short-circuits without an audit entry. Returns the updated user.
 */
export function setUserRole(actor: AdminActor, githubId: unknown, rawRole: unknown): AppUser {
    if (typeof githubId !== 'number' || !Number.isInteger(githubId)) {
        throw new AdminError('"githubId" must be an integer', 'invalid_request', 400)
    }
    if (!isAssignableRole(rawRole)) {
        throw new AdminError('role must be one of: owner, maintainer, standard', 'invalid_role', 400)
    }
    const role: Role = rawRole

    const target = userRepo.get(githubId)
    if (!target) throw new AdminError('user not found', 'user_not_found', 404)
    if (target.role === role) return target

    // Demoting the only owner would leave nobody able to reach the admin surface.
    if (target.role === 'owner' && role !== 'owner' && userRepo.ownerCount() <= 1) {
        throw new AdminError('cannot demote the last owner', 'last_owner', 409)
    }

    userRepo.setRole(githubId, role)
    audit(actor, 'admin.user.role', { detail: `${target.login}: ${target.role} → ${role}` })
    slog('info', 'admin', 'user role changed', { login: target.login, from: target.role, to: role, by: actor.login })
    return { ...target, role }
}

/**
 * Suspend any site (`POST /api/admin/sites/{id}/suspend`): the owner-moderation power to
 * take a site offline. Removes the nginxpilot fragment + reloads so it stops serving and
 * marks the row `suspended` (kept, so it's reversible) via the deploy service (§727), then
 * audits the moderation attributed to the acting owner. A `404` for an unknown id.
 */
export async function suspendSite(actor: AdminActor, id: string): Promise<Site> {
    const site = siteRepo.get(id)
    if (!site) throw new AdminError('site not found', 'site_not_found', 404)

    const suspended = await deploy.suspend(site)
    audit(actor, 'admin.site.suspend', { site: site.hostname, detail: `suspended ${site.hostname} (owner moderation)` })
    slog('info', 'admin', 'site suspended', { id: site.id, hostname: site.hostname, by: actor.login })
    return suspended
}

// ── audit log (§12) ────────────────────────────────────────────────────────────

/** Read the audit trail, newest-first (id DESC), with the repo's optional filters + paging. */
export function listAudit(filter: AuditFilter = {}): AuditEntry[] {
    return auditRepo.list(filter)
}

// ── error → HTTP mapping (so routes stay thin) ─────────────────────────────────

/** A route-ready error: the HTTP status + a machine-readable code (never a leaked message). */
export interface HttpError {
    status: number
    code: string
}

/**
 * Map any error an admin operation can throw to its HTTP status + code. An `AdminError`
 * carries its own status; an nginxpilot failure during a suspend collapses to `502`;
 * anything else is a `500`. Messages are intentionally not forwarded to the client.
 */
export function httpErrorFor(err: unknown): HttpError {
    if (err instanceof AdminError) {
        return { status: err.status, code: err.code }
    }
    if (err instanceof NginxpilotError) {
        return { status: 502, code: 'nginxpilot_error' }
    }
    return { status: 500, code: 'internal_error' }
}
