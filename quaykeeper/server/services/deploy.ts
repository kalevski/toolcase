// Deploy service (§9) — the site-lifecycle entry point the API routes call. All the
// policy (the `draft → provisioning → live → failed` state machine, the last-known-good
// status interpretation, the poll loop) lives in the pure, unit-tested
// `domain/deploy-machine.ts`; this layer is the `server-only` wiring that binds that
// machine to real infrastructure: the `nginxpilot` client, `siteRepo`, `auditRepo`,
// and the plan-derived poll interval.
//
// See notes/static-hosting-app-design.md §4, §9, §11.

import 'server-only'
import * as siteRepo from '@/server/data/repositories/site-repo'
import * as userRepo from '@/server/data/repositories/user-repo'
import * as baseDomainRepo from '@/server/data/repositories/base-domain-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import * as realms from '@/server/services/realms'
import { resolveLimits } from '@/server/services/plan'
import { getGithubTokenFor } from '@/server/services/auth'
import { slog } from '@/server/infrastructure/server-log'
import type { NginxpilotClient } from '@/server/infrastructure/nginxpilot'
import { STANDARD_LIMITS, type Site } from '@/server/domain/types'
import {
    gitCredentialName,
    type FragmentOptions,
    type SiteWebOptions,
} from '@/server/domain/nginxpilot-fragment'
import * as machine from '@/server/domain/deploy-machine'
import type { DeployDeps, SiteSourceChanges, TrackOptions } from '@/server/domain/deploy-machine'

/**
 * Resolve the managed-mode TLS/security options for a site's fragment (§0/Phase D).
 *
 *   • Subdomain — TLS follows its **base domain's** policy (one wildcard cert per base,
 *     §0). When that base domain is set to `auto`, the subdomain serves HTTPS (with
 *     `force_ssl`) once the wildcard cert is discoverable, degrading to HTTP otherwise;
 *     an `off` base domain (or an unregistered one) emits no TLS — current behaviour.
 *   • Custom domain — its HTTPS is provisioned by the dedicated nginx vhost + certbot
 *     flow (`services/domains.ts`), NOT the nginxpilot fragment, so no `web` block is
 *     emitted here (it would be a redundant, conflicting second TLS path).
 *
 * Returns `undefined` when no TLS applies, so the fragment stays byte-for-byte the same
 * as before for HTTP-only base domains.
 */
function resolveWebOptions(site: Site): SiteWebOptions | undefined {
    // Custom domains terminate TLS on the daemon with their own per-domain cert
    // (issued through the realm API, impl §7). `auto` — never `required` — so a
    // not-yet-issued cert degrades to HTTP instead of quarantining the site.
    if (site.hostKind === 'custom') return { tls: 'auto', force_ssl: true }
    if (site.hostKind !== 'subdomain') return undefined
    const host = site.hostname.toLowerCase()
    // Scope the base-domain lookup to the site's own realm (multiple_realms.md §D.4) — the
    // wildcard that serves this subdomain belongs to that one instance.
    const base = baseDomainRepo
        .listByRealm(site.realmId)
        .filter((b) => host === b.domain.toLowerCase() || host.endsWith(`.${b.domain.toLowerCase()}`))
        .sort((a, b) => b.domain.length - a.domain.length)[0]
    if (!base || base.tls !== 'auto') return undefined
    return { tls: 'auto', force_ssl: true }
}

/**
 * Render options for a site's fragment: the poll interval is the owner's effective
 * `PlanLimits.minIntervalSec` (the baseline polls slowly; raised accounts near-real-time, §11/§15).
 * Public repos emit no `auth` block; a private site's fragment gains one in
 * `writeFragmentWithAuth` below, after the clone token is pushed to the realm's
 * git-credentials store. Managed-mode TLS options are resolved from the base domain
 * for subdomains (§0/Phase D).
 */
function fragmentOptions(site: Site): FragmentOptions {
    const owner = userRepo.get(site.ownerId)
    const limits = owner ? resolveLimits(owner.login) : STANDARD_LIMITS
    return { intervalSec: limits.minIntervalSec, web: resolveWebOptions(site) }
}

/**
 * Fragment write with the private-repo credential seam: for a private site, push the
 * owner's stored GitHub token to the realm's git-credentials store first (idempotent
 * PUT; the daemon answers with the 0600 file's path), then emit the fragment with
 * `auth.token_file` referencing it. nginxpilot re-reads the file at every fetch, so a
 * later re-push (a rotated token on re-login) heals interval pulls without a reload.
 * A private site whose owner has no stored token yet gets no `auth` block — the sync
 * then fails with a clear auth error in `/status` and heals on the owner's next login.
 */
async function writeFragmentWithAuth(
    client: NginxpilotClient,
    site: Site,
    options: FragmentOptions,
): Promise<string> {
    if (!site.repoPrivate) return client.writeFragment(site, options)
    const token = getGithubTokenFor(site.ownerId)
    if (!token) {
        slog('warn', 'deploy', 'private site has no stored GitHub token; writing fragment without auth', {
            site: site.id,
            hostname: site.hostname,
        })
        return client.writeFragment(site, options)
    }
    const cred = await client.putGitCredential(gitCredentialName(site.id), token)
    return client.writeFragment(site, { ...options, auth: { tokenFile: cred.path } })
}

/** Append an audit entry for a lifecycle transition, attributed to the site owner. */
function audit(action: string, site: Site, detail?: string): void {
    const owner = userRepo.get(site.ownerId)
    auditRepo.append({
        githubId: owner?.githubId ?? site.ownerId,
        login: owner?.login ?? null,
        action,
        site: site.hostname,
        detail: detail ?? null,
    })
}

/**
 * Assemble the machine's injected ports from real infrastructure for ONE site. The
 * nginxpilot client targets the site's own realm (multiple_realms.md §D.1) — a deploy is a
 * realm-scoped op, the target implied by `site.realmId`, so there is no active-realm needed.
 */
function deps(site: Site): DeployDeps {
    const client = realms.clientForSite(site)
    return {
        client: {
            writeFragment: (s, options) => writeFragmentWithAuth(client, s, options),
            removeFragment: client.removeFragment,
            reload: client.reload,
            sync: client.sync,
            status: client.status,
        },
        store: {
            updateStatus: siteRepo.updateStatus,
            updateLastError: siteRepo.updateLastError,
            updateLastRef: siteRepo.updateLastRef,
            updateBytes: siteRepo.updateBytes,
            updateSource: siteRepo.updateSource,
            remove: siteRepo.remove,
        },
        fragmentOptions,
        audit,
        now: () => new Date().toISOString(),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    }
}

/** Provision a site: write fragment → reload → first sync → mark `provisioning` (§9 step 4). */
export function provision(site: Site): Promise<Site> {
    return machine.provision(deps(site), site)
}

/** Poll `/status` until the site is live, applying last-known-good semantics (§9 step 5). */
export function track(site: Site, opts?: TrackOptions): Promise<Site> {
    return machine.track(deps(site), site, opts)
}

/** Force an immediate redeploy of the existing fragment (§9 step 6, the Redeploy button). */
export function redeploy(site: Site): Promise<Site> {
    return machine.redeploy(deps(site), site)
}

/** Rewrite source on a branch/subdir change, then reload + sync (§9 step 6). */
export function update(site: Site, changes: SiteSourceChanges): Promise<Site> {
    return machine.update(deps(site), site, changes)
}

/** Remove the fragment, reload, and delete the row (§9 step 7). */
export async function remove(site: Site): Promise<void> {
    await machine.remove(deps(site), site)
    // Best-effort credential cleanup: the site is gone, so its clone token has no
    // readers. A failure here leaves an orphaned 0600 file on the daemon — log it,
    // never fail the (already-completed) removal for it.
    if (site.repoPrivate) {
        try {
            await realms.clientForSite(site).deleteGitCredential(gitCredentialName(site.id))
        } catch (err) {
            slog('warn', 'deploy', 'failed to remove git credential after site delete', {
                site: site.id,
                error: (err as Error).message,
            })
        }
    }
}

/**
 * Suspend a site (owner moderation, §13): drop the fragment + reload so nginxpilot stops
 * serving it, and mark the row `suspended` (the row is kept, so it's reversible). The
 * moderation audit — attributed to the acting owner — is written by the admin service.
 */
export function suspend(site: Site): Promise<Site> {
    return machine.suspend(deps(site), site)
}
