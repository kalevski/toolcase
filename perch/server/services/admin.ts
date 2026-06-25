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
import * as auditRepo from '@/server/data/repositories/audit-repo'
import * as deploy from '@/server/services/deploy'
import { checkBaseDomain, parsePlanTiers } from '@/server/domain/admin'
import { NginxpilotError } from '@/server/infrastructure/nginxpilot'
import { slog } from '@/server/infrastructure/server-log'
import type { AuditEntry, BaseDomain, PlanTier, Site } from '@/server/domain/types'
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

/** Every registered base domain, oldest first. */
export function listBaseDomains(): BaseDomain[] {
    return baseDomainRepo.list()
}

/**
 * Register a base domain (`POST /api/admin/base-domains`): validate the FQDN shape,
 * reject a duplicate (`409`), persist it, and audit. Returns the new row.
 */
export function addBaseDomain(actor: AdminActor, raw: unknown): BaseDomain {
    if (typeof raw !== 'string') throw new AdminError('"domain" is required', 'invalid_request', 400)
    const checked = checkBaseDomain(raw)
    if (!checked.ok) throw new AdminError(checked.message, `domain_${checked.reason}`, 400)
    const domain = checked.domain

    if (baseDomainRepo.list().some((b) => b.domain.toLowerCase() === domain)) {
        throw new AdminError(`base domain "${domain}" is already registered`, 'base_domain_exists', 409)
    }

    const createdAt = new Date().toISOString()
    baseDomainRepo.add(domain, createdAt)
    audit(actor, 'admin.base_domain.add', { detail: domain })
    slog('info', 'admin', 'base domain added', { domain, by: actor.login })
    return { domain, createdAt }
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
