// Owner-admin service (§6, §13) — the policy layer the `/api/admin/**` routes call,
// all reached only after `authorize('owner')`. It owns the four owner-only surfaces:
//
//   1. Subdomain pool   — list / add / remove base domains (`baseDomainRepo`, §10).
//   2. Site moderation   — list every site, suspend any one (drop its fragment via the
//      deploy service, §727 — the row is kept, so it's reversible) (§11, §13).
//   3. Audit log         — read the append-only trail, newest-first (`auditRepo`, §12).
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
import * as siteRepo from '@/server/data/repositories/site-repo'
import * as userRepo from '@/server/data/repositories/user-repo'
import * as userLimitRepo from '@/server/data/repositories/user-limit-repo'
import * as userRealmRepo from '@/server/data/repositories/user-realm-repo'
import * as userFeatureRepo from '@/server/data/repositories/user-feature-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import * as deploy from '@/server/services/deploy'
import * as realms from '@/server/services/realms'
import { checkBaseDomain, isAssignableRole, parseUserLimits } from '@/server/domain/admin'
import { resolveLimits, effectiveLimitsFor } from '@/server/services/plan'
import { summarizeUsage } from '@/server/domain/usage'
import { NginxpilotError } from '@/server/infrastructure/nginxpilot'
import { slog } from '@/server/infrastructure/server-log'
import {
    accountLevel,
    isBaseDomainTls,
    type AdminUserRow,
    type AppUser,
    type AuditEntry,
    type BaseDomain,
    type BaseDomainTls,
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

// ── base domains (the subdomain pool, §10; per-realm, multiple_realms.md §E.2) ──

/** The base domains served by one realm's wildcard, oldest first — the owner's pool view. */
export function listBaseDomains(realmId: string): BaseDomain[] {
    return baseDomainRepo.listByRealm(realmId)
}

/**
 * The base domains a given user may attach a subdomain under, within `realmId` (the caller's
 * active/assigned realm, multiple_realms.md §E.2). Every base domain is offered to every
 * user — there is no audience tier — so this is the whole realm pool. Backs the standard,
 * non-owner `GET /api/base-domains` projection the create-site wizard reads.
 */
export function listBaseDomainsFor(login: string, realmId: string): BaseDomain[] {
    return baseDomainRepo.listByRealm(realmId)
}

/**
 * Register a base domain (`POST /api/admin/base-domains`): validate the FQDN shape and the
 * subdomain TLS policy, reject a duplicate (`409`), persist it, and audit. `tls` defaults to
 * `auto` (§0/Phase D) when omitted. Returns the new row.
 */
export function addBaseDomain(
    actor: AdminActor,
    raw: unknown,
    rawTls: unknown = 'auto',
    realmId: string,
    rawHttp2: unknown = true,
    rawHsts: unknown = false,
): BaseDomain {
    if (typeof raw !== 'string') throw new AdminError('"domain" is required', 'invalid_request', 400)
    const checked = checkBaseDomain(raw)
    if (!checked.ok) throw new AdminError(checked.message, `domain_${checked.reason}`, 400)
    const domain = checked.domain

    const tls: BaseDomainTls = rawTls === undefined || rawTls === null ? 'auto' : (rawTls as BaseDomainTls)
    if (!isBaseDomainTls(tls)) {
        throw new AdminError('tls must be one of: off, auto', 'invalid_tls', 400)
    }

    const http2 = checkPolicyFlag(rawHttp2, true, 'http2')
    // HSTS defaults OFF, unlike http2 — it is sticky in browsers for `max_age` even
    // after the header stops being sent, so it has to be a deliberate opt-in.
    const hsts = checkPolicyFlag(rawHsts, false, 'hsts')

    // `domain` is the global PK, so a base domain belongs to exactly one realm — reject a
    // re-register anywhere, not just in this realm (multiple_realms.md §10.4).
    if (baseDomainRepo.list().some((b) => b.domain.toLowerCase() === domain)) {
        throw new AdminError(`base domain "${domain}" is already registered`, 'base_domain_exists', 409)
    }

    const createdAt = new Date().toISOString()
    baseDomainRepo.add(domain, tls, http2, hsts, realmId, createdAt)
    audit(actor, 'admin.base_domain.add', {
        detail: `${domain} (tls=${tls}, http2=${http2}, hsts=${hsts}, realm=${realmId})`,
    })
    slog('info', 'admin', 'base domain added', { domain, tls, http2, hsts, realmId, by: actor.login })
    return { domain, tls, http2, hsts, realmId, createdAt }
}

/**
 * Narrow a request-supplied wildcard-policy flag to a boolean. Absent
 * (`undefined`/`null`) falls back to `fallback`; anything other than a real boolean is a
 * 400 rather than a silent truthiness coercion, so a typo'd `"false"` can't quietly turn
 * a policy ON.
 */
function checkPolicyFlag(raw: unknown, fallback: boolean, field: string): boolean {
    if (raw === undefined || raw === null) return fallback
    if (typeof raw !== 'boolean') {
        throw new AdminError(`${field} must be a boolean`, `invalid_${field}`, 400)
    }
    return raw
}

/**
 * Update an existing base domain's subdomain TLS policy (`PATCH /api/admin/base-domains`,
 * §0/Phase D): validate the FQDN + the `tls` value, require the domain to exist (`404`),
 * persist, and audit. Returns the updated row. Effective subdomain fragments pick this up
 * on their next deploy.
 */
export function setBaseDomainTls(actor: AdminActor, raw: unknown, rawTls: unknown): BaseDomain {
    if (typeof raw !== 'string') throw new AdminError('"domain" is required', 'invalid_request', 400)
    const checked = checkBaseDomain(raw)
    if (!checked.ok) throw new AdminError(checked.message, `domain_${checked.reason}`, 400)
    const domain = checked.domain

    if (!isBaseDomainTls(rawTls)) {
        throw new AdminError('tls must be one of: off, auto', 'invalid_tls', 400)
    }
    const tls: BaseDomainTls = rawTls

    const existing = baseDomainRepo.list().find((b) => b.domain.toLowerCase() === domain)
    if (!existing) throw new AdminError(`base domain "${domain}" is not registered`, 'base_domain_not_found', 404)

    baseDomainRepo.setTls(domain, tls)
    audit(actor, 'admin.base_domain.tls', { detail: `${domain}: tls=${tls}` })
    slog('info', 'admin', 'base domain tls set', { domain, tls, by: actor.login })
    return { ...existing, tls }
}

/**
 * Update an existing base domain's wildcard-wide HTTP/2 policy (`PATCH
 * /api/admin/base-domains`): validate the FQDN + the `http2` value, require the domain
 * to exist (`404`), persist, and audit. Returns the updated row. Effective subdomain
 * fragments pick this up on their next deploy.
 *
 * The knob is per-base on purpose — see {@link BaseDomain.http2}. Flipping it moves
 * every label under the wildcard together, which is what keeps coalesced HTTP/2
 * connections from hitting `421 Misdirected Request`.
 */
export function setBaseDomainHttp2(actor: AdminActor, raw: unknown, rawHttp2: unknown): BaseDomain {
    if (typeof raw !== 'string') throw new AdminError('"domain" is required', 'invalid_request', 400)
    const checked = checkBaseDomain(raw)
    if (!checked.ok) throw new AdminError(checked.message, `domain_${checked.reason}`, 400)
    const domain = checked.domain

    if (typeof rawHttp2 !== 'boolean') {
        throw new AdminError('http2 must be a boolean', 'invalid_http2', 400)
    }
    const http2 = rawHttp2

    const existing = baseDomainRepo.list().find((b) => b.domain.toLowerCase() === domain)
    if (!existing) throw new AdminError(`base domain "${domain}" is not registered`, 'base_domain_not_found', 404)

    baseDomainRepo.setHttp2(domain, http2)
    audit(actor, 'admin.base_domain.http2', { detail: `${domain}: http2=${http2}` })
    slog('info', 'admin', 'base domain http2 set', { domain, http2, by: actor.login })
    return { ...existing, http2 }
}

/**
 * Update an existing base domain's wildcard-wide HSTS policy (`PATCH
 * /api/admin/base-domains`): validate the FQDN + the `hsts` value, require the domain to
 * exist (`404`), persist, and audit. Returns the updated row. Effective subdomain
 * fragments pick this up on their next deploy.
 *
 * Per-base for the reasons in {@link BaseDomain.hsts} — and worth pausing over before
 * enabling: once a browser has seen the header it refuses plain HTTP to the domain for
 * `max_age` (nginxpilot's default is two years) even if the policy is turned back off
 * here, so switching it on is effectively one-way for anyone who has already visited.
 */
export function setBaseDomainHsts(actor: AdminActor, raw: unknown, rawHsts: unknown): BaseDomain {
    if (typeof raw !== 'string') throw new AdminError('"domain" is required', 'invalid_request', 400)
    const checked = checkBaseDomain(raw)
    if (!checked.ok) throw new AdminError(checked.message, `domain_${checked.reason}`, 400)
    const domain = checked.domain

    if (typeof rawHsts !== 'boolean') {
        throw new AdminError('hsts must be a boolean', 'invalid_hsts', 400)
    }
    const hsts = rawHsts

    const existing = baseDomainRepo.list().find((b) => b.domain.toLowerCase() === domain)
    if (!existing) throw new AdminError(`base domain "${domain}" is not registered`, 'base_domain_not_found', 404)

    baseDomainRepo.setHsts(domain, hsts)
    audit(actor, 'admin.base_domain.hsts', { detail: `${domain}: hsts=${hsts}` })
    slog('info', 'admin', 'base domain hsts set', { domain, hsts, by: actor.login })
    return { ...existing, hsts }
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
 * Enrich one user into an {@link AdminUserRow}: their unified account level,
 * current usage (count + bytes across their sites), the *effective* limits (role
 * default merged with any override), and the raw custom override. `override` is
 * passed in by {@link listUsersDetailed} from a single batch read; it defaults to
 * a per-user read so the single-row callers (set/clear) stay correct.
 */
function enrichUser(user: AppUser, override?: UserLimitOverride | null): AdminUserRow {
    const custom = override !== undefined ? override : (userLimitRepo.get(user.githubId) ?? null)
    return {
        user,
        level: accountLevel(user.role),
        usage: summarizeUsage(siteRepo.listByOwner(user.githubId)),
        limits: resolveLimits(user.login),
        customLimits: custom,
        realmGrants: userRealmRepo.listForUser(user.githubId),
        featureOverrides: userFeatureRepo.get(user.githubId),
    }
}

/**
 * The enriched owner roster (`GET /api/admin/users`): every user with their level,
 * usage, effective limits, and custom override. Every per-user input is read in ONE
 * bulk query and zipped in (I1) — overrides, all sites grouped by owner, and all
 * realm grants grouped by user — so the roster is a fixed handful of queries
 * regardless of user count, not the previous N+1.
 *
 * Note: this intentionally returns the full roster (no server-side pagination). The
 * admin UI searches/filters the whole set client-side; paginating here would break that
 * UX and is deferred until the roster grows enough to need server-side search.
 */
export function listUsersDetailed(): AdminUserRow[] {
    const users = userRepo.list()
    const overrides = userLimitRepo.all()
    const grantsByUser = userRealmRepo.allByUser()

    // All sites in one query, grouped by owner, for per-user usage summaries.
    const sitesByOwner = new Map<number, Site[]>()
    for (const site of siteRepo.list()) {
        const arr = sitesByOwner.get(site.ownerId)
        if (arr) arr.push(site)
        else sitesByOwner.set(site.ownerId, [site])
    }

    return users.map((u) => {
        const override = overrides.get(u.githubId) ?? null
        return {
            user: u,
            level: accountLevel(u.role),
            usage: summarizeUsage(sitesByOwner.get(u.githubId) ?? []),
            limits: effectiveLimitsFor(u, override),
            customLimits: override,
            realmGrants: grantsByUser.get(u.githubId) ?? [],
            featureOverrides: userFeatureRepo.get(u.githubId),
        }
    })
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
 * `owner`, or to drop back to `standard`. Validates the target role (`400`),
 * requires the target to exist (`404`), and refuses to demote the *last* `owner`
 * (`409`) so the instance can never be locked out of its admin surface. A no-op
 * (same role) short-circuits without an audit entry. Returns the updated user.
 */
export function setUserRole(actor: AdminActor, githubId: unknown, rawRole: unknown): AppUser {
    if (typeof githubId !== 'number' || !Number.isInteger(githubId)) {
        throw new AdminError('"githubId" must be an integer', 'invalid_request', 400)
    }
    if (!isAssignableRole(rawRole)) {
        throw new AdminError('role must be one of: owner, standard', 'invalid_role', 400)
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

/** Total audit entries matching the filter — the audit table's pager `total` (impl §8). */
export function countAudit(filter: AuditFilter = {}): number {
    return auditRepo.count(filter)
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
 * a `RealmError` (e.g. no realm registered) delegates to the shared realm mapping;
 * anything else is a `500`. Messages are intentionally not forwarded to the client.
 */
export function httpErrorFor(err: unknown): HttpError {
    if (err instanceof AdminError) {
        return { status: err.status, code: err.code }
    }
    if (err instanceof NginxpilotError) {
        return { status: 502, code: 'nginxpilot_error' }
    }
    return realms.httpErrorFor(err)
}
