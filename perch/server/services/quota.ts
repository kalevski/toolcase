// Quota-enforcement service (§11) — the control-plane gates that nginxpilot can't
// provide (it just syncs and serves, with no concept of quotas). Three duties:
//
//   • pre-create count gate     — `assertCanCreateSite`     (the only hard, pre-emptive gate)
//   • pre-create custom domain  — `assertCanUseCustomDomain`
//   • refresh cadence           — `intervalFor`             (fragment `interval` from the plan)
//   • post-deploy byte cap      — `enforceBytes`            (over_quota → grace → suspend, reversible)
//
// Limits are read *live* from `services/plan.ts` (owner-tunable), so a tier change
// takes effect without a migration. The pure decisions live in the unit-tested
// `domain/quota.ts`; this layer is the `server-only` wiring that binds them to the
// repositories, the nginxpilot client, and the configurable grace window.
//
// See notes/static-hosting-app-design.md §11, §15.

import 'server-only'
import * as siteRepo from '@/server/data/repositories/site-repo'
import * as userRepo from '@/server/data/repositories/user-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import * as realms from '@/server/services/realms'
import { resolveLimits } from '@/server/services/plan'
import { config } from '@/server/config'
import { slog } from '@/server/infrastructure/server-log'
import { PLAN_LIMITS, type AppUser, type PlanLimits, type Site } from '@/server/domain/types'
import { canCreateSite, canUseCustomDomain, decideByteQuota, intervalFor as intervalForLimits } from '@/server/domain/quota'

/**
 * A quota gate refusal. Carries a machine-readable `code` and the HTTP `status` a
 * route should map it to (mirrors `GithubError` in `infrastructure/github.ts`):
 * `409` for "at your limit", `403` for "your plan doesn't allow this".
 */
export class QuotaError extends Error {
    constructor(
        message: string,
        public code: string,
        public status: 403 | 409,
    ) {
        super(message)
        this.name = 'QuotaError'
    }
}

// ── pre-create gates (§11 point 1) ───────────────────────────────────────────

/**
 * Reject creating a new site once the user is at their plan's `maxSites`. The only
 * hard, pre-emptive quota gate. Limits come from the user's live effective plan;
 * the count is the user's owned sites (`site.owner_id` is the `github_id`, so the
 * login is resolved through `userRepo`).
 */
export function assertCanCreateSite(login: string): void {
    const limits = resolveLimits(login)
    const user = userRepo.getByLogin(login)
    const count = user ? siteRepo.listByOwner(user.githubId).length : 0
    if (!canCreateSite(count, limits)) {
        throw new QuotaError(
            `site limit reached for your plan (${count}/${limits.maxSites})`,
            'site_limit_reached',
            409,
        )
    }
}

/** Reject attaching a custom domain when the user's plan grants none (free tier, §10). */
export function assertCanUseCustomDomain(login: string): void {
    const limits = resolveLimits(login)
    if (!canUseCustomDomain(limits)) {
        throw new QuotaError(
            'custom domains require a paid (sponsor) plan',
            'custom_domains_not_allowed',
            403,
        )
    }
}

/**
 * Reject deploying a PRIVATE repo when the user's plan doesn't allow it (free tier,
 * §9). The plan boundary (`PLAN_LIMITS.free.privateRepos = false`) was previously
 * advertised but never enforced (C2). Callers must have established the repo is
 * actually private from authoritative GitHub metadata — never the client flag.
 */
export function assertCanUsePrivateRepo(login: string): void {
    const limits = resolveLimits(login)
    if (!limits.privateRepos) {
        throw new QuotaError('private repositories require a paid (sponsor) plan', 'private_repos_not_allowed', 403)
    }
}

// ── refresh cadence (§11 point 3) ────────────────────────────────────────────

/**
 * The fragment `interval` for a login — its plan's `minIntervalSec` floor as an
 * nginxpilot duration (free polls slowly, sponsors near-real-time). The deploy
 * service uses `minIntervalSec` directly when rendering; this is the human-facing
 * string for the wizard/dashboard.
 */
export function intervalFor(login: string): string {
    return intervalForLimits(resolveLimits(login))
}

// ── post-deploy byte cap → grace → suspend (§11 point 2) ─────────────────────

/** Effective per-user limits for a site's owner, falling back to the free tier. */
function limitsForOwner(owner: AppUser | undefined): PlanLimits {
    return owner ? resolveLimits(owner.login) : PLAN_LIMITS.free
}

/** Record one quota event in the audit log (the user-facing notification trail) and the server log. */
function notify(action: string, site: Site, owner: AppUser | undefined, detail: string): void {
    auditRepo.append({
        githubId: owner?.githubId ?? site.ownerId,
        login: owner?.login ?? null,
        action,
        site: site.hostname,
        detail,
    })
    slog('warn', 'quota', `${action}: ${detail}`, { site: site.id, hostname: site.hostname })
}

/**
 * Enforce the per-site byte cap against a site's last measured `bytes` (§11):
 *
 *   1. Over cap from a serving state → mark `over_quota`, record an audit/notify
 *      event, and start the grace clock (the row's `updated_at`).
 *   2. Still over cap after the configurable grace window (`config.quotaGraceSec`)
 *      → **suspend**: remove the fragment and reload so nginxpilot stops serving it.
 *   3. Back within cap while flagged/suspended (the user trimmed the build or
 *      upgraded their plan, raising the cap) → reverse it: a flagged-but-serving
 *      site just clears the flag; a suspended site has its fragment rewritten,
 *      reloaded, and re-synced.
 *
 * Returns the updated in-memory `Site`. Callers measure `bytes` first (via deploy
 * tracking or a `du` sidecar) and persist it; this only drives the status ladder.
 */
export async function enforceBytes(site: Site): Promise<Site> {
    const owner = userRepo.get(site.ownerId)
    const limits = limitsForOwner(owner)
    const bytes = site.bytes ?? 0
    const now = new Date().toISOString()
    // Enforcement is a realm-scoped op — drive the site's OWN realm (multiple_realms.md §D.3),
    // never a global client. The byte-quota sweep iterates sites and hits each site's realm.
    const client = realms.clientForSite(site)

    const action = decideByteQuota({
        status: site.status,
        bytes,
        maxBytesPerSite: limits.maxBytesPerSite,
        // The grace clock starts when the site entered `over_quota`; its `updated_at`
        // is that moment (nothing else mutates a flagged-but-idle site).
        overSince: site.status === 'over_quota' ? site.updatedAt : undefined,
        now,
        graceSec: config.quotaGraceSec,
    })

    const usage = `${bytes}/${limits.maxBytesPerSite} bytes`

    switch (action) {
        case 'ok':
        case 'hold':
            return site

        case 'mark': {
            siteRepo.updateStatus(site.id, 'over_quota', now)
            notify(
                'site.over_quota',
                site,
                owner,
                `over byte quota (${usage}); suspends in ${config.quotaGraceSec}s unless trimmed or upgraded`,
            )
            return { ...site, status: 'over_quota', updatedAt: now }
        }

        case 'suspend': {
            // Stop serving: drop the fragment and reload so nginxpilot forgets the site.
            await client.removeFragment(site.hostname)
            await client.reload()
            siteRepo.updateStatus(site.id, 'suspended', now)
            notify('site.suspended', site, owner, `suspended after grace window — still over byte quota (${usage})`)
            return { ...site, status: 'suspended', updatedAt: now }
        }

        case 'reinstate': {
            if (site.status === 'suspended') {
                // The fragment was removed at suspension — re-create it and re-deploy.
                await client.writeFragment(site, { intervalSec: limits.minIntervalSec })
                await client.reload()
                await client.sync(site.hostname)
                siteRepo.updateStatus(site.id, 'provisioning', now)
                notify('site.reinstated', site, owner, `within byte quota again (${usage}); re-provisioning`)
                return { ...site, status: 'provisioning', updatedAt: now }
            }
            // Flagged but still serving — just clear the flag.
            siteRepo.updateStatus(site.id, 'live', now)
            notify('site.reinstated', site, owner, `within byte quota again (${usage})`)
            return { ...site, status: 'live', updatedAt: now }
        }
    }
}
