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
import * as siteCredentialRepo from '@/server/data/repositories/site-credential-repo'
import * as realms from '@/server/services/realms'
import { resolveLimits } from '@/server/services/plan'
import { getGithubTokenFor } from '@/server/services/auth'
import { slog } from '@/server/infrastructure/server-log'
import { decrypt } from '@/server/infrastructure/cipher'
import type { NginxpilotClient } from '@/server/infrastructure/nginxpilot'
import {
    effectiveAuthMethod,
    STANDARD_LIMITS,
    usesGithubOAuthCredential,
    type BaseDomain,
    type Site,
    type SiteAuthMethod,
} from '@/server/domain/types'
import {
    gitCredentialName,
    resolveFragmentOptions,
    type FragmentOptions,
} from '@/server/domain/nginxpilot-fragment'
import * as machine from '@/server/domain/deploy-machine'
import type { DeployDeps, SiteSourceChanges, TrackOptions } from '@/server/domain/deploy-machine'

/**
 * The base domain whose wildcard serves a subdomain site (§0/Phase D) — the source of its
 * TLS / HTTP/2 / HSTS policy. Scoped to the site's own realm (multiple_realms.md §D.4),
 * since the wildcard belongs to that one instance, and resolved longest-suffix-first so
 * a site under `a.b.dev` prefers that base over a registered `b.dev`. `undefined` when
 * the site is a custom domain or its base domain isn't registered (→ no TLS).
 */
function baseDomainFor(site: Site): BaseDomain | undefined {
    if (site.hostKind !== 'subdomain') return undefined
    const host = site.hostname.toLowerCase()
    return baseDomainRepo
        .listByRealm(site.realmId)
        .filter((b) => host === b.domain.toLowerCase() || host.endsWith(`.${b.domain.toLowerCase()}`))
        .sort((a, b) => b.domain.length - a.domain.length)[0]
}

/**
 * Render options for a site's fragment. The two *lookups* live here — the owner's
 * effective plan and the site's base domain — while every rule applied to them is the
 * pure `resolveFragmentOptions` in `domain/nginxpilot-fragment.ts`, so the policy stays
 * unit-testable. Public repos emit no `auth` block; a private site's fragment gains one
 * in `writeFragmentWithAuth` below, after the clone token is pushed to the realm's
 * git-credentials store.
 */
function fragmentOptions(site: Site): FragmentOptions {
    const owner = userRepo.get(site.ownerId)
    const limits = owner ? resolveLimits(owner.login) : STANDARD_LIMITS
    return resolveFragmentOptions(site, limits, baseDomainFor(site))
}

/**
 * The secret a site's source authenticates with, and the auth method it belongs to.
 *
 * Two provenances, because Quaykeeper can mint a credential for exactly one kind of
 * source and no other:
 *
 *   • **GitHub** (`github-token`, the default for a private GitHub repo) — the owner's
 *     stored OAuth token. Rotated for free on every login, which is what heals a stalled
 *     private-repo sync without anyone touching the site.
 *   • **Everything else** (a non-GitHub git host, an archive URL) — the per-site
 *     credential the user supplied, sealed in `site_credential`. Quaykeeper has no way to
 *     obtain or refresh it, so it lives and dies with the site.
 *
 * Returns `undefined` for a public source, or when the credential is missing — the
 * fragment is then written without an `auth` block, so the failure surfaces as a clear
 * auth error in `/status` rather than a rejected fragment that takes the site down.
 */
function sourceCredential(site: Site): { method: SiteAuthMethod; secret: string } | undefined {
    const method = effectiveAuthMethod(site)
    if (method === 'none') return undefined

    if (usesGithubOAuthCredential(site)) {
        const token = getGithubTokenFor(site.ownerId)
        if (!token) {
            slog('warn', 'deploy', 'private site has no stored GitHub token; writing fragment without auth', {
                site: site.id,
                hostname: site.hostname,
            })
            return undefined
        }
        return { method, secret: token }
    }

    const sealed = siteCredentialRepo.get(site.id)
    if (!sealed) {
        slog('warn', 'deploy', 'site source needs a credential but none is stored; writing fragment without auth', {
            site: site.id,
            hostname: site.hostname,
            method,
        })
        return undefined
    }
    try {
        return { method, secret: decrypt(sealed) }
    } catch (err) {
        // A key-ring rotation that dropped the sealing key. Log and degrade rather than
        // failing the deploy outright — the site keeps serving its last release.
        slog('error', 'deploy', 'could not open the stored source credential', {
            site: site.id,
            error: (err as Error).message,
        })
        return undefined
    }
}

/**
 * Fragment write with the source-credential seam: push the site's credential to the
 * realm's git-credentials store first (idempotent PUT; the daemon answers with the 0600
 * file's path), then emit the fragment with an `auth` block *referencing* that path —
 * never the secret itself (§16). nginxpilot re-reads the file at every fetch, so a later
 * re-push (a rotated GitHub token on re-login, or a replaced deploy key) heals interval
 * pulls without a reload.
 */
async function writeFragmentWithAuth(
    client: NginxpilotClient,
    site: Site,
    options: FragmentOptions,
): Promise<string> {
    const credential = sourceCredential(site)
    if (!credential) return client.writeFragment(site, options)
    const cred = await client.putGitCredential(gitCredentialName(site.id), credential.secret)
    return client.writeFragment(site, {
        ...options,
        auth: {
            method: credential.method,
            tokenFile: cred.path,
            username: site.authUsername,
            headerName: site.authHeaderName,
        },
    })
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
            updateSettings: siteRepo.updateSettings,
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
    // Best-effort credential cleanup: the site is gone, so its stored secret has no
    // readers. A failure here leaves an orphaned 0600 file on the daemon — log it,
    // never fail the (already-completed) removal for it. The row in `site_credential`
    // goes with the site row via its ON DELETE CASCADE.
    if (effectiveAuthMethod(site) !== 'none') {
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
