// Site-management service (§9, §13) — the policy layer the `/api/sites` routes call.
// It owns the two things the thin route handlers must NOT do themselves:
//
//   1. Tenant isolation (§13, §16): every read/mutation re-checks
//      `site.owner_id === session.sub` through the pure `domain/site-access.ts`
//      decision; the `owner` role bypasses it. A client-supplied site id is never
//      trusted on its own — it's only ever a DB lookup key here.
//   2. Orchestration: validate the source (`domain/site-input.ts`) and hostname
//      (§729 `services/domains.ts`), gate on quota (§728 `services/quota.ts`), then
//      drive the deploy state machine (§727 `services/deploy.ts`).
//
// Errors are surfaced as typed `*Error` classes (here + the quota/domain services);
// `httpErrorFor` maps any of them — plus the infrastructure errors — to the HTTP
// status + machine-readable code a route returns, so the routes stay one-liners.
//
// See notes/static-hosting-app-design.md §9, §11, §13, §16.

import 'server-only'
import { randomBytes } from 'node:crypto'
import * as siteRepo from '@/server/data/repositories/site-repo'
import * as siteRemovalRepo from '@/server/data/repositories/site-removal-repo'
import * as baseDomainRepo from '@/server/data/repositories/base-domain-repo'
import * as userRepo from '@/server/data/repositories/user-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import * as siteCredentialRepo from '@/server/data/repositories/site-credential-repo'
import * as deploy from '@/server/services/deploy'
import * as domains from '@/server/services/domains'
import * as realms from '@/server/services/realms'
import { HostnameError } from '@/server/services/domains'
import {
    QuotaError,
    assertCanCreateSite,
    assertCanUseCustomDomain,
    assertCanUsePrivateRepo,
    enforceBytes,
} from '@/server/services/quota'
import { resolveLimits } from '@/server/services/plan'
import { getGithubTokenFor } from '@/server/services/auth'
import { gitCredentialName, sourceUrlFor } from '@/server/domain/nginxpilot-fragment'
import { adoptedSiteFields, classifyAdoptedHost } from '@/server/domain/site-adopt'
import * as github from '@/server/infrastructure/github'
import { GithubError } from '@/server/infrastructure/github'
import { NginxpilotError, type NginxpilotSiteStatus } from '@/server/infrastructure/nginxpilot'
import { slog } from '@/server/infrastructure/server-log'
import { encrypt } from '@/server/infrastructure/cipher'
import { resolveSiteAccess, type SiteViewer } from '@/server/domain/site-access'
import {
    checkAdvanced,
    checkAuthHeaderName,
    checkAuthMethod,
    checkAuthUsername,
    checkBranch,
    checkChecksumUrl,
    checkExclude,
    checkIntervalSec,
    checkKeepReleases,
    checkNotFound,
    checkRepoName,
    checkRepoOwner,
    checkRequireFile,
    checkRouting,
    checkSiteTls,
    checkSourceSpec,
    checkSourceType,
    checkSourceUrl,
    checkStripComponents,
    checkSubdir,
    describeSourceUrl,
} from '@/server/domain/site-input'
import { checkDomain, checkLabel } from '@/server/domain/hostname'
import {
    siteSettings,
    siteSettingsEqual,
    siteSource,
    siteSourceEqual,
    usesGithubOAuthCredential,
} from '@/server/domain/types'
import type {
    AppUser,
    ExternalSite,
    PlanLimits,
    RealmUnreachable,
    Site,
    SiteHostKind,
    SiteRouting,
    SiteSettings,
    SiteSource,
    SitesOverview,
} from '@/server/domain/types'

export type { SiteViewer } from '@/server/domain/site-access'

/**
 * A site-service refusal that isn't already a quota/hostname error: a malformed request
 * body (`400`), a missing/foreign site (`404`/`403`, from the ownership re-check), a
 * caller whose account row vanished mid-request (`401`), or an adoption conflict
 * (`409`). Carries the machine-readable `code` and HTTP `status` a route returns
 * (mirrors `QuotaError` / `HostnameError`).
 */
export class SiteError extends Error {
    constructor(
        message: string,
        public code: string,
        public status: 400 | 401 | 403 | 404 | 409,
    ) {
        super(message)
        this.name = 'SiteError'
    }
}

// ── request shapes (validated here, so routes pass the parsed body straight through) ──

/** A hostname spec: either a subdomain label under a base domain, or a custom domain (§10). */
export type HostnameSpec =
    | { kind: 'subdomain'; label: string; baseDomain: string }
    | { kind: 'custom'; domain: string }

/**
 * The per-site settings a create/update body may carry — the request-side mirror of
 * {@link SiteSettings}. Every field is optional; on a PATCH, an *absent* key leaves the
 * stored value alone while an explicit `null` resets that one setting to its default.
 */
export interface SiteSettingsRequest {
    /** Path→file routing: `static` (default) | `spa` | `clean-urls`. */
    routing?: string | null
    /** Custom 404 page path (e.g. `/404.html`); static/clean-urls only. */
    notFound?: string | null
    /** Immutable Cache-Control for fingerprinted assets. */
    cacheAssets?: boolean
    /** gzip responses. */
    gzip?: boolean
    /** Include nginxpilot's scanner/SQLi deny snippet. */
    blockExploits?: boolean
    /** `off` | `auto` | `required` — custom-domain sites only (a subdomain inherits its base). */
    tls?: string | null
    /** Strict-Transport-Security — custom-domain sites only, and sticky once sent. */
    hsts?: boolean
    /** Raw nginx directives for the site's `server{}` block; needs `PlanLimits.advancedConfig`. */
    advanced?: string | null
    /** Extra deny globs layered on the built-in defaults; `null` restores just the defaults. */
    exclude?: string[] | null
    /** Post-fetch gate files; `[]` disables the gate, `null` restores the `index.html` default. */
    requireFile?: string[] | null
    /** Rollback depth; capped by the plan. `null` inherits the plan value. */
    keepReleases?: number | null
    /** Poll cadence in seconds; never below the plan floor. `null` inherits the floor. */
    intervalSec?: number | null
}

/**
 * The deploy-source fields a create/update body may carry — the request-side mirror of
 * {@link SiteSource}. Same per-key merge convention as {@link SiteSettingsRequest}.
 *
 * A plain GitHub deploy needs none of them beyond `branch`: omit `sourceType` and
 * `sourceUrl` and the URL is derived from `repoOwner`/`repoName` exactly as before.
 */
export interface SiteSourceRequest {
    /** `git` (default) | `http-zip`. */
    sourceType?: string | null
    /** Explicit source URL — a non-GitHub git remote, or the archive URL for `http-zip`. */
    sourceUrl?: string | null
    branch?: string
    /** `null` clears the build subdir; git sources only. */
    subdir?: string | null
    /** `none` | `ssh-key` | `https-token` | `github-token` | `bearer` | `basic` | `header`. */
    authMethod?: string | null
    /** Username for `https-token` / `basic`. */
    authUsername?: string | null
    /** Header name for `header` auth. */
    authHeaderName?: string | null
    /** `http-zip`: checksum file URL. */
    checksumUrl?: string | null
    /** `http-zip`: leading path components to strip. */
    stripComponents?: number | null
    /** `http-zip`: permit a plain `http://` URL. */
    allowInsecure?: boolean
}

/** `POST /api/sites` body — repo coordinates + a hostname spec (+ optional source/settings). */
export interface CreateSiteRequest extends SiteSettingsRequest, SiteSourceRequest {
    repoOwner?: string
    repoName?: string
    branch?: string
    hostname: HostnameSpec
    /**
     * The realm (nginxpilot instance) to deploy to — the wizard's instance picker.
     * Omitted → the caller's active realm, exactly as before. Grant-enforced server-side
     * (`realms.resolveRequestedRealm`): the owner may target any instance, a non-owner
     * only one they're granted.
     */
    realmId?: string
    /**
     * The source credential for a non-GitHub source (a deploy key, token, password, or
     * header value). Write-only: it is sealed into `site_credential` and never returned.
     * A GitHub source omits it — the owner's OAuth token authenticates instead.
     */
    sourceSecret?: string | null
}

/** `PATCH /api/sites/{id}` body — any subset of source / settings / hostname fields (§9 step 6). */
export interface UpdateSiteRequest extends SiteSettingsRequest, SiteSourceRequest {
    /** A new hostname spec to move the site to; omitted leaves the hostname unchanged. */
    hostname?: HostnameSpec
    /** Replace the stored source credential; `null` deletes it. Omitted leaves it alone. */
    sourceSecret?: string | null
}

// ── helpers ──────────────────────────────────────────────────────────────────────

/** A short, server-generated site id: 12 url-safe chars, all in `[A-Za-z0-9_-]` (§12, §16). */
function generateSiteId(): string {
    return randomBytes(9).toString('base64url')
}

/** Coerce an unknown JSON field to a string, or throw a 400. */
function str(value: unknown, field: string): string {
    if (typeof value !== 'string') throw new SiteError(`"${field}" is required`, 'invalid_request', 400)
    return value
}

/** Validate a source field through a pure check, mapping its rejection to a 400. */
function field(check: { ok: true; value: string } | { ok: false; reason: string; message: string }): string {
    if (!check.ok) throw new SiteError(check.message, `invalid_${check.reason}`, 400)
    return check.value
}

/**
 * Cross-field serving rule (mirrors nginxpilot's own validation, so a bad combination
 * fails here as a 400 instead of bouncing off the daemon as a 502): SPA routing serves
 * index.html for every path, so a custom 404 page can never trigger.
 */
function assertServingCompatible(routing: SiteRouting | undefined, notFound: string | undefined): void {
    if (routing === 'spa' && notFound) {
        throw new SiteError(
            'a custom 404 page cannot be combined with SPA routing (every path serves index.html)',
            'routing_conflict',
            400,
        )
    }
}

/** Read an optional boolean field: absent/null means off; anything non-boolean is a 400. */
function flag(value: unknown, field: string): boolean {
    if (value === undefined || value === null) return false
    if (typeof value !== 'boolean') {
        throw new SiteError(`"${field}" must be a boolean`, 'invalid_request', 400)
    }
    return value
}

/** Run one pure `check*` and unwrap it, mapping a rejection to its 400. */
function checked<T>(result: { ok: true; value: T } | { ok: false; reason: string; message: string }): T {
    if (!result.ok) throw new SiteError(result.message, `invalid_${result.reason}`, 400)
    return result.value
}

/**
 * Merge a request body's settings over a baseline and validate the result (§9, §16).
 *
 * The merge convention is per-key presence: a key *absent* from the body leaves the
 * stored value alone, while an explicit `null` resets that one setting to its default.
 * That is what lets the dashboard PATCH a single toggle without having to echo back
 * every other setting it isn't touching.
 *
 * Three rules are cross-field and therefore live here rather than in the pure checks:
 *
 *   • **spa + custom 404** is contradictory (every path serves index.html), so it's
 *     rejected against the merged values — catching `routing: spa` on a site that
 *     already stores a 404 page, and vice versa.
 *   • **`tls` / `hsts` are cert-scoped.** Only a custom domain, which terminates on its
 *     own certificate, may carry them; a subdomain's are decided once per base domain.
 *     Asking for them on a subdomain is an error rather than a silent no-op — and a
 *     rehost *to* a subdomain clears any values the site carried as a custom domain.
 *   • **`advanced` is plan-gated** ({@link PlanLimits.advancedConfig}): it writes raw
 *     directives into the site's `server{}` block, which is far more power than the
 *     rest of the surface grants.
 */
function resolveSettings(
    body: SiteSettingsRequest,
    base: SiteSettings,
    hostKind: SiteHostKind,
    limits: PlanLimits,
): SiteSettings {
    const next: SiteSettings = { ...base }

    if ('routing' in body) next.routing = checked(checkRouting(body.routing))
    if ('notFound' in body) next.notFound = checked(checkNotFound(body.notFound))
    if ('cacheAssets' in body) next.cacheAssets = flag(body.cacheAssets, 'cacheAssets')
    if ('gzip' in body) next.gzip = flag(body.gzip, 'gzip')
    if ('blockExploits' in body) next.blockExploits = flag(body.blockExploits, 'blockExploits')
    if ('exclude' in body) next.exclude = checked(checkExclude(body.exclude))
    if ('requireFile' in body) next.requireFile = checked(checkRequireFile(body.requireFile))
    if ('keepReleases' in body) {
        next.keepReleases = checked(checkKeepReleases(body.keepReleases, limits.keepReleases))
    }
    if ('intervalSec' in body) {
        next.intervalSec = checked(checkIntervalSec(body.intervalSec, limits.minIntervalSec))
    }

    if ('advanced' in body) {
        const advanced = checked(checkAdvanced(body.advanced))
        if (advanced !== undefined && !limits.advancedConfig) {
            throw new SiteError(
                'raw nginx configuration is not enabled for this account — ask the owner to raise your limit',
                'advanced_config_not_allowed',
                403,
            )
        }
        next.advanced = advanced
    }

    if (hostKind === 'custom') {
        if ('tls' in body) next.tls = checked(checkSiteTls(body.tls))
        if ('hsts' in body) next.hsts = flag(body.hsts, 'hsts')
    } else {
        // A subdomain shares one wildcard cert with every sibling label, so its TLS and
        // HSTS are the base domain's to decide. `tls: null` / `hsts: false` are accepted
        // as no-ops (a client echoing back a full settings object), but asking for a real
        // value is refused rather than silently dropped.
        if (body.tls != null) {
            throw new SiteError(
                'a subdomain\'s TLS follows its base domain (one wildcard cert covers every label) — it can\'t be set per site',
                'tls_not_per_site',
                400,
            )
        }
        if (body.hsts === true) {
            throw new SiteError(
                'a subdomain\'s HSTS follows its base domain — ask the owner to enable it there',
                'hsts_not_per_site',
                400,
            )
        }
        next.tls = undefined
        next.hsts = false
    }

    assertServingCompatible(next.routing, next.notFound)
    return next
}

/**
 * Merge a request body's source fields over a baseline and validate the result.
 *
 * Same per-key presence convention as {@link resolveSettings}: an absent key leaves the
 * stored value alone, an explicit `null` clears that one field. Field shapes come from
 * the pure `check*` helpers; the cross-field consistency rules — which auth methods a
 * kind and URL scheme allow, which fields belong to which kind — are `checkSourceSpec`,
 * which mirrors nginxpilot's own validation so an impossible combination is refused here
 * rather than bouncing off `POST /sites` as a 502.
 *
 * The URL scheme check depends on `allowInsecure`, so that flag is merged first.
 */
function resolveSource(body: SiteSourceRequest, base: SiteSource): SiteSource {
    const next: SiteSource = { ...base }

    if ('allowInsecure' in body) next.allowInsecure = flag(body.allowInsecure, 'allowInsecure')
    if ('sourceType' in body) next.sourceType = checked(checkSourceType(body.sourceType))
    const type = next.sourceType ?? 'git'

    if ('sourceUrl' in body) {
        next.sourceUrl = checked(checkSourceUrl(body.sourceUrl, type, !!next.allowInsecure))
    }
    if (body.branch !== undefined) next.branch = field(checkBranch(str(body.branch, 'branch')))
    if ('subdir' in body) next.subdir = checked(checkSubdir(body.subdir))
    if ('authMethod' in body) next.authMethod = checked(checkAuthMethod(body.authMethod))
    if ('authUsername' in body) next.authUsername = checked(checkAuthUsername(body.authUsername))
    if ('authHeaderName' in body) next.authHeaderName = checked(checkAuthHeaderName(body.authHeaderName))
    if ('checksumUrl' in body) {
        next.checksumUrl = checked(checkChecksumUrl(body.checksumUrl, !!next.allowInsecure))
    }
    if ('stripComponents' in body) next.stripComponents = checked(checkStripComponents(body.stripComponents))

    // Switching kind leaves the other kind's fields stranded on the row, and
    // `checkSourceSpec` rightly refuses that combination — so clear them as part of the
    // switch rather than making the caller send a null for each one it didn't set.
    if (type === 'git') {
        next.checksumUrl = undefined
        next.stripComponents = undefined
        next.allowInsecure = false
    } else {
        next.subdir = undefined
    }

    const spec = checkSourceSpec(next)
    if (!spec.ok) throw new SiteError(spec.message, `invalid_${spec.reason}`, 400)
    return spec.value
}

/**
 * Store, replace, or delete a site's source credential. Sealed with the same AES-256-GCM
 * keyring as every other secret at rest; the plaintext exists only for the length of this
 * call and is pushed to the realm's credential store by the deploy service at fragment
 * time. `null` deletes the stored credential.
 */
function writeSourceSecret(siteId: string, secret: string | null): void {
    if (secret === null || secret.trim() === '') {
        siteCredentialRepo.remove(siteId)
        return
    }
    siteCredentialRepo.set(siteId, encrypt(secret), new Date().toISOString())
}

/** Resolve + authorize a site by id for this viewer (§13). Throws `SiteError` 404/403. */
function ownedSite(id: string, viewer: SiteViewer): Site {
    const access = resolveSiteAccess(siteRepo.get(id), viewer)
    if (!access.ok) {
        if (access.status === 404) throw new SiteError('site not found', 'site_not_found', 404)
        throw new SiteError('you do not own this site', 'forbidden', 403)
    }
    return access.site
}

/** The site's owner row (for plan/quota checks + audit attribution). Throws 401 if gone. */
function ownerOf(site: Site): AppUser {
    const owner = userRepo.get(site.ownerId)
    if (!owner) throw new SiteError('site owner not found', 'owner_not_found', 401)
    return owner
}

function audit(action: string, owner: AppUser, site: Site, detail?: string): void {
    auditRepo.append({ githubId: owner.githubId, login: owner.login, action, site: site.hostname, detail })
}

/**
 * Validate a hostname spec against the shared namespace (§10, §729) and return the
 * resulting fully-qualified hostname. Custom domains additionally pass the plan gate
 * (§728) — they're a paid capability. Throws `HostnameError` / `QuotaError`.
 */
function resolveHostname(spec: HostnameSpec, owner: AppUser, realmId: string): string {
    if (spec.kind === 'subdomain') {
        return domains.validateLabel(
            str(spec.label, 'hostname.label'),
            str(spec.baseDomain, 'hostname.baseDomain'),
            realmId,
        )
    }
    if (spec.kind === 'custom') {
        assertCanUseCustomDomain(owner.login)
        return domains.validateCustomDomain(str(spec.domain, 'hostname.domain'), realmId)
    }
    throw new SiteError('hostname.kind must be "subdomain" or "custom"', 'invalid_request', 400)
}

/** Compute a candidate hostname for change-detection, or null when the spec is malformed. */
function candidateHostname(spec: HostnameSpec): string | null {
    if (spec.kind === 'subdomain') {
        const c = checkLabel(spec.label)
        return c.ok ? `${c.label}.${spec.baseDomain.trim().toLowerCase()}` : null
    }
    if (spec.kind === 'custom') {
        const c = checkDomain(spec.domain)
        return c.ok ? c.domain : null
    }
    return null
}

// ── read ─────────────────────────────────────────────────────────────────────────

/** List the sites the caller may see (their own; the owner role sees all). */
export function listSites(viewer: SiteViewer): Site[] {
    return viewer.role === 'owner' ? siteRepo.list() : siteRepo.listByOwner(viewer.sub)
}

/**
 * The sites-page overview: the caller's stored sites plus per-instance discovery.
 *
 * Every realm the caller may see is asked for its live `GET /status` site list, and any
 * entry no `site` row claims (matched by hostname within that realm) is surfaced as an
 * {@link ExternalSite} — that's what makes a freshly-registered instance's pre-existing
 * sites visible instead of silently absent. Discovery is OWNER-ONLY: an instance's
 * unmanaged entries belong to no Quaykeeper tenant, so showing them to a standard user
 * would leak other deployments; a standard caller gets their own rows and realm labels
 * only. An unreachable instance never fails the page — it's reported in `unreachable`
 * so the UI can say which instance couldn't be checked.
 */
export async function sitesOverview(viewer: SiteViewer): Promise<SitesOverview> {
    const stored = listSites(viewer)
    const visible = realms.realmsVisibleTo(viewer.sub, viewer.role)
    const external: ExternalSite[] = []
    const unreachable: RealmUnreachable[] = []

    if (viewer.role === 'owner') {
        await Promise.all(
            visible.map(async (realm) => {
                let env
                try {
                    env = await realms.clientFor(realm.id).status()
                } catch (err) {
                    unreachable.push({
                        realmId: realm.id,
                        realmName: realm.name,
                        error: err instanceof NginxpilotError && err.status
                            ? `status ${err.status}`
                            : 'unreachable',
                    })
                    return
                }
                const managed = new Set(
                    stored.filter((s) => s.realmId === realm.id).map((s) => s.hostname),
                )
                for (const s of env.sites) {
                    if (managed.has(s.domain)) continue
                    external.push({
                        realmId: realm.id,
                        realmName: realm.name,
                        domain: s.domain,
                        sourceType: s.source_type,
                        sourceUrl: s.source_url,
                        deployedRef: s.deployed_ref,
                        lastSuccess: s.last_success,
                        lastError: s.last_error,
                        neverSynced: s.never_synced,
                        syncing: s.syncing,
                        bytes: s.bytes,
                    })
                }
            }),
        )
        external.sort((a, b) => a.domain.localeCompare(b.domain))
    }

    return {
        sites: stored,
        realms: visible.map((r) => ({ id: r.id, name: r.name, isDefault: r.isDefault })),
        external,
        unreachable,
    }
}

/** Read one owned site (§13 ownership re-check). Throws `SiteError` 404/403. */
export function getSite(viewer: SiteViewer, id: string): Site {
    return ownedSite(id, viewer)
}

// ── adopt (the "Found on your instances" section's takeover action) ─────────────

/** `POST /api/sites/adopt` — which discovered site to take over, by its realm + domain. */
export interface AdoptSiteRequest {
    realmId?: unknown
    domain?: unknown
}

/**
 * Adopt a site discovered on a connected instance: create the `site` row that regains
 * management of a fragment Quaykeeper never wrote (deployed before the instance was
 * registered, or by another control plane), WITHOUT touching the running config — the
 * row mirrors the daemon's live config verbatim (`domain/site-adopt.ts`), so the drift
 * reconcile finds nothing to rewrite and the site keeps serving exactly as it was.
 *
 * Owner-only, mirroring discovery itself ({@link sitesOverview}): an unmanaged fragment
 * belongs to no Quaykeeper tenant, so only the operator may claim one — and it lands on
 * the operator's own account. The live config is re-read from the daemon here; the
 * client supplies only the realm + domain identity, never the config.
 *
 * An authenticated non-GitHub source adopts WITHOUT its credential (the daemon-side
 * fragment keeps using its own references) — the caller should re-enter the secret in
 * the site's settings before making config changes, exactly like any site whose stored
 * credential is missing.
 */
export async function adoptSite(viewer: SiteViewer, body: AdoptSiteRequest): Promise<Site> {
    if (viewer.role !== 'owner') {
        throw new SiteError('only the owner may adopt discovered sites', 'forbidden', 403)
    }
    const owner = userRepo.get(viewer.sub)
    if (!owner) throw new SiteError('account not found', 'account_not_found', 401)

    const domain = str(body.domain, 'domain').trim().toLowerCase()
    if (!domain) throw new SiteError('"domain" is required', 'invalid_request', 400)
    const realm = await realms.resolveRequestedRealm(viewer.sub, viewer.role, str(body.realmId, 'realmId'))

    if (siteRepo.getByHostname(domain, realm.id)) {
        throw new SiteError('that site is already managed by Quaykeeper', 'already_managed', 409)
    }

    const client = realms.clientFor(realm.id)
    const live = (await client.listSites()).find((s) => s.domain.toLowerCase() === domain)
    if (!live) {
        throw new SiteError(`"${domain}" was not found on ${realm.name}`, 'not_found_on_instance', 404)
    }
    const srcType = live.source?.type ?? 'git'
    if (srcType !== 'git' && srcType !== 'http-zip') {
        throw new SiteError(`unsupported source type "${srcType}"`, 'unsupported_source', 400)
    }

    // The same plan gates as create — trivially open for the owner today, but adoption
    // must not become a quota bypass if the policy ever changes.
    assertCanCreateSite(owner.login)
    const hostKind = classifyAdoptedHost(
        domain,
        baseDomainRepo.listByRealm(realm.id).map((b) => b.domain),
    )
    if (hostKind === 'custom') assertCanUseCustomDomain(owner.login)
    const fields = adoptedSiteFields(live, hostKind)
    if (fields.repoPrivate) assertCanUsePrivateRepo(owner.login)

    // Runtime snapshot (bytes / deployed ref / last error) so the new card isn't blank
    // until the next status poll. Best-effort — the config read above already succeeded,
    // so a /status hiccup shouldn't fail the adoption.
    let snapshot: NginxpilotSiteStatus | undefined
    try {
        snapshot = (await client.status()).sites.find((s) => s.domain.toLowerCase() === domain)
    } catch {
        /* runtime detail only */
    }

    const now = new Date().toISOString()
    const site: Site = {
        id: generateSiteId(),
        ownerId: owner.githubId,
        ...fields,
        hostname: domain,
        hostKind,
        status: 'live',
        realmId: realm.id,
        bytes: snapshot?.bytes,
        lastRef: snapshot?.deployed_ref,
        lastError: snapshot?.last_error,
        createdAt: now,
        updatedAt: now,
    }
    siteRepo.create(site)
    // A queued fragment retraction for this domain (a forced delete the daemon missed)
    // must not fire now that a row claims it again.
    siteRemovalRepo.remove(realm.id, domain)
    audit(
        'site.adopt',
        owner,
        site,
        `adopted from ${realm.name} (${fields.sourceType ?? 'git'} ${sourceUrlFor(site)})`,
    )
    return site
}

// ── byte measurement + enforcement (§9 step 5, §11) ────────────────────────────

/**
 * Measure and enforce a site's byte quota in the background after a deploy (C1).
 * `deploy.track` polls `GET /status` until the site is live, recording `bytes` via the
 * deploy machine; `enforceBytes` then applies the over_quota → grace → suspend ladder.
 * Fire-and-forget: the request returns immediately on the freshly-provisioned row, and
 * the periodic sweep (`services/quota-sweep.ts`) is the durable backstop if this process
 * is restarted mid-track. Errors are logged, never surfaced to the deploy caller.
 */
function trackAndEnforce(site: Site): void {
    void deploy
        .track(site)
        .then((tracked) => enforceBytes(tracked))
        .catch((err) =>
            slog('error', 'sites', 'background track/enforce failed', { site: site.id, error: String(err) }),
        )
}

// ── create (§9 steps 1–4) ──────────────────────────────────────────────────────

/**
 * Create a site for the caller: validate the source + hostname, gate on the per-plan
 * site count (§728), persist the row, then provision it through the deploy state machine
 * (§727: fragment → reload → first sync). Custom domains additionally need their vhost +
 * cert, installed later via {@link verifyDomain} once DNS verifies (§729) — provision here
 * primes the content channel regardless. Returns the provisioned (`provisioning`) site.
 */
export async function createSite(viewer: SiteViewer, body: CreateSiteRequest, token: string | null): Promise<Site> {
    const owner = userRepo.get(viewer.sub)
    if (!owner) throw new SiteError('account not found', 'account_not_found', 401)

    if (!body.hostname || typeof body.hostname !== 'object') {
        throw new SiteError('"hostname" is required', 'invalid_request', 400)
    }

    // A site is created one of two ways. The GitHub path supplies repo coordinates and
    // no URL — the classic flow, and the only one the repo picker produces. The external
    // path supplies an explicit `sourceUrl` (a non-GitHub git remote, or an archive), in
    // which case the repo coordinates are only display labels, derived from the URL.
    const external = !!body.sourceUrl || (body.sourceType != null && body.sourceType !== 'git')
    const source = resolveSource(body, { branch: external ? (body.branch ?? 'main') : '' })
    if (!external && !source.branch) {
        throw new SiteError('"branch" is required', 'invalid_request', 400)
    }

    const labels = external && source.sourceUrl ? describeSourceUrl(source.sourceUrl) : undefined
    const repoOwner = labels
        ? labels.owner
        : field(checkRepoOwner(str(body.repoOwner, 'repoOwner')))
    const repoName = labels ? labels.name : field(checkRepoName(str(body.repoName, 'repoName')))

    // The settings group is validated against the hostname kind the site is being
    // created with, so `tls`/`hsts` on a subdomain is caught before anything is written.
    const limits = resolveLimits(owner.login)
    const settings = resolveSettings(body, {}, body.hostname.kind, limits)

    // Hard, pre-emptive count gate (§11 point 1) before we touch the namespace.
    assertCanCreateSite(owner.login)

    // Re-read the repo's `private` flag from authoritative GitHub metadata — never a
    // client-supplied flag (C2). The flag is both the plan gate (private repos are a
    // granted capability) and a persisted fact on the row: a private site's fragment
    // needs an `auth` block on every future re-render (deploy/update/redeploy), which
    // must not cost a GitHub round-trip each time. Without a token we can't determine
    // privacy — allow it only for plans that permit private repos anyway (the clone
    // simply runs unauthenticated and only succeeds for a public repo).
    //
    // An external source has no GitHub metadata to read: whether it needs credentials is
    // stated by its own auth method, and a private one is gated on the same capability.
    let repoPrivate = false
    if (external) {
        repoPrivate = (source.authMethod ?? 'none') !== 'none'
        if (repoPrivate) assertCanUsePrivateRepo(owner.login)
    } else if (token) {
        const meta = await github.getRepo(token, repoOwner, repoName)
        repoPrivate = meta.private
        if (meta.private) assertCanUsePrivateRepo(owner.login)
    } else if (!limits.privateRepos) {
        throw new SiteError('GitHub authentication required to create a site', 'github_token_missing', 401)
    }

    // An authenticated external source is unusable without its credential, and finding
    // that out through a failing sync would be a poor first experience.
    if (external && repoPrivate && !body.sourceSecret) {
        throw new SiteError(
            'this source needs a credential (a deploy key, token, password, or header value)',
            'source_secret_required',
            400,
        )
    }

    // Pick the target realm (multiple_realms.md §D.2): an explicit `realmId` from the
    // wizard's instance picker (grant-enforced), else the active realm (the owner's
    // switcher choice; a non-owner's owner-assigned default). The site is bound to it and
    // hostname uniqueness is scoped to it.
    const targetRealm = await realms.resolveRequestedRealm(viewer.sub, viewer.role, body.realmId)
    const hostname = resolveHostname(body.hostname, owner, targetRealm.id)

    const now = new Date().toISOString()
    const site: Site = {
        id: generateSiteId(),
        ownerId: owner.githubId,
        repoOwner,
        repoName,
        repoPrivate,
        ...source,
        ...settings,
        hostname,
        hostKind: body.hostname.kind,
        realmId: targetRealm.id,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
    }
    siteRepo.create(site)
    // The credential is sealed AFTER the row exists — `site_credential.site_id` is a
    // foreign key, so there is nothing to attach it to before the insert.
    if (body.sourceSecret !== undefined) writeSourceSecret(site.id, body.sourceSecret)
    audit(
        'site.create',
        owner,
        site,
        source.sourceUrl
            ? `${source.sourceType ?? 'git'} ${source.sourceUrl}`
            : `${repoOwner}/${repoName}@${source.branch}${source.subdir ? ` subdir=${source.subdir}` : ''}`,
    )

    const provisioned = await deploy.provision(site)
    trackAndEnforce(provisioned)
    return provisioned
}

// ── update (§9 step 6) ─────────────────────────────────────────────────────────

/**
 * Update an owned site's source / settings / hostname (§13 ownership re-check first). A
 * source or settings change re-renders the fragment and re-syncs (`deploy.update`). A hostname
 * change re-validates the shared namespace (§729), tears down the old custom vhost when
 * leaving a custom domain, moves the row, and re-provisions the content channel on the new
 * domain — a move *to* a custom domain still needs {@link verifyDomain} to install its
 * vhost + cert. Returns the updated site.
 */
export async function updateSite(viewer: SiteViewer, id: string, body: UpdateSiteRequest): Promise<Site> {
    let site = ownedSite(id, viewer)
    const owner = ownerOf(site)

    // The source group is merged over the stored values and validated as a whole, so a
    // half-applied change (a new URL without the matching auth method, say) is a 400
    // instead of a fragment nginxpilot refuses.
    const source = resolveSource(body, siteSource(site))
    // A credential replacement is applied before the redeploy below, so the fragment
    // written by this same request already references the new secret.
    if (body.sourceSecret !== undefined) writeSourceSecret(site.id, body.sourceSecret)

    // The settings group is merged over the stored values and validated as a whole, so
    // cross-field rules (spa vs a custom 404, cert-scoped TLS/HSTS) see the EFFECTIVE
    // post-merge state — `routing: spa` on a site that already stores a 404 page is
    // rejected up front, and so is the reverse.
    //
    // Validation runs against the hostname kind the site will have AFTER this request,
    // so moving a custom-domain site down to a subdomain is what drops its per-site
    // TLS/HSTS rather than carrying dead values onto a wildcard-covered label.
    const moving = body.hostname && typeof body.hostname === 'object' ? body.hostname : undefined
    const targetKind: SiteHostKind =
        moving && (moving.kind === 'custom' || moving.kind === 'subdomain') ? moving.kind : site.hostKind
    const settings = resolveSettings(body, siteSettings(site), targetKind, resolveLimits(owner.login))

    // 1) Hostname move (if requested and actually different).
    if (moving) {
        const candidate = candidateHostname(moving)
        if (candidate !== site.hostname) {
            site = await changeHostname(site, owner, moving, { source, settings })
            return site
        }
    }

    // 2) Source / settings-only change.
    site = await deploy.update(site, { source, settings })
    trackAndEnforce(site)
    return site
}

/**
 * Move a site to a new hostname (and optionally apply a source/settings change in the same
 * re-provision). Validates the new hostname authoritatively (§729 + §728 for custom), drops
 * the old custom vhost/cert if the site is leaving a custom domain, persists the row, and
 * re-provisions the content channel on the new domain.
 */
async function changeHostname(
    site: Site,
    owner: AppUser,
    spec: HostnameSpec,
    changes: {
        /** The already-merged source group. */
        source: SiteSource
        /** The already-merged settings group, resolved against the site's NEW hostname kind. */
        settings: SiteSettings
    },
): Promise<Site> {
    // A rehost stays within the site's own realm (multiple_realms.md §D.2).
    const newHostname = resolveHostname(spec, owner, site.realmId)
    const newKind: SiteHostKind = spec.kind

    if (site.hostKind === 'custom') {
        // Stop serving the old custom domain before repointing the row.
        await domains.teardownCustomVhost(site)
    }

    // The daemon keys fragments by DOMAIN, so a rehost must retract the old domain's
    // fragment — provisioning the new hostname only ADDS one, and the daemon would
    // keep syncing and serving the old hostname forever. Durable: an unreachable
    // daemon queues the removal for the status poll's reconcile pass.
    await deploy.retractFragment(site.realmId, site.hostname, 'rehost')

    const at = new Date().toISOString()
    const { source, settings } = changes
    if (!siteSourceEqual(source, siteSource(site))) {
        siteRepo.updateSource(site.id, source, at)
    }
    if (!siteSettingsEqual(settings, siteSettings(site))) {
        siteRepo.updateSettings(site.id, settings, at)
    }
    siteRepo.updateHostname(site.id, newHostname, newKind, at)
    audit('site.rehost', owner, { ...site, hostname: newHostname }, `${site.hostname} → ${newHostname}`)

    const moved: Site = {
        ...site,
        ...source,
        ...settings,
        hostname: newHostname,
        hostKind: newKind,
        updatedAt: at,
    }
    const provisioned = await deploy.provision(moved)
    trackAndEnforce(provisioned)
    return provisioned
}

// ── delete (§9 step 7) ─────────────────────────────────────────────────────────

/**
 * Delete an owned site (§13 ownership re-check first): drop the nginxpilot fragment + reload
 * + remove the row (`deploy.remove`), and tear down the custom-domain vhost/cert when the
 * site has one (§729).
 */
export async function deleteSite(viewer: SiteViewer, id: string): Promise<void> {
    const site = ownedSite(id, viewer)
    // Best-effort teardown end-to-end (I3): infra failures (a hung reload, an
    // already-gone fragment, an unreachable daemon) must NOT strand a half-deleted site with
    // a stuck DB row + a 502. The custom-vhost teardown is already best-effort internally;
    // guard the nginxpilot fragment removal the same way, then always delete the row.
    if (site.hostKind === 'custom') {
        await domains.teardownCustomVhost(site)
    }
    try {
        await deploy.remove(site)
    } catch (err) {
        // `deploy.remove` failed before deleting the row (fragment remove / reload threw).
        // Log it and delete the row anyway so the dashboard reflects reality — and queue
        // the fragment removal so the status poll's reconcile pass retries it until the
        // daemon confirms (an orphaned fragment must not serve a dead site forever).
        slog('warn', 'sites', 'deploy.remove failed during delete (removing row anyway)', {
            site: site.id,
            hostname: site.hostname,
            error: (err as Error).message,
        })
        siteRemovalRepo.enqueue(site.realmId, site.hostname, 'delete', new Date().toISOString())
        siteRepo.remove(site.id)
        audit('site.remove', ownerOf(site), site, 'forced row removal after teardown failure')
    }
}

// ── clone-credential refresh (private repos) ──────────────────────────────────────

/**
 * Re-push a user's (freshly stored) GitHub token to the git-credentials store of every
 * realm their private GitHub sites deploy to. Called fire-and-forget from the OAuth
 * callback: a re-login is exactly when a rotated/revoked token gets replaced, and
 * nginxpilot re-reads the credential file at each fetch — so stalled interval pulls heal
 * without a redeploy. Failures are logged per site, never surfaced to the login flow.
 *
 * Strictly limited to sites that actually authenticate with the OAuth token
 * ({@link usesGithubOAuthCredential}). A site on another host stores its own deploy key
 * or token under the same credential name, and re-pushing a GitHub token over it would
 * break that site's next fetch — on every single sign-in.
 */
export function refreshGithubCredentials(githubId: number): void {
    const token = getGithubTokenFor(githubId)
    if (!token) return
    for (const site of siteRepo.listByOwner(githubId)) {
        if (!usesGithubOAuthCredential(site)) continue
        void realms
            .clientForSite(site)
            .putGitCredential(gitCredentialName(site.id), token)
            .catch((err) =>
                slog('warn', 'sites', 'failed to refresh git credential on login', {
                    site: site.id,
                    error: String(err),
                }),
            )
    }
}

// ── redeploy (§9 step 6 — the "Redeploy" button) ─────────────────────────────────

/** Force an immediate redeploy of an owned site (`POST /sync/{domain}`, §13 re-check). */
export async function redeploySite(viewer: SiteViewer, id: string): Promise<Site> {
    const site = ownedSite(id, viewer)
    const redeployed = await deploy.redeploy(site)
    trackAndEnforce(redeployed)
    return redeployed
}

// ── custom-domain verify (§10, §729) ─────────────────────────────────────────────

/** Outcome of {@link verifyDomain}: the DNS check plus whether the vhost was provisioned. */
export interface VerifyDomainResult extends domains.DomainVerification {
    /** True once the custom vhost + cert were installed and the site marked live. */
    provisioned: boolean
    /** The site after verification (its status reflects a successful provision). */
    site: Site
}

/**
 * Custom-domain DNS check for an owned site (§10, §16). Confirms the domain points at the
 * ingress IP; when it does, installs the vhost + cert and marks the site live (§729). A
 * non-custom site is a 400 (subdomains need no verification — the wildcard covers them).
 */
export async function verifyDomain(viewer: SiteViewer, id: string): Promise<VerifyDomainResult> {
    let site = ownedSite(id, viewer)
    if (site.hostKind !== 'custom') {
        throw new SiteError('this site is a subdomain — no domain verification needed', 'not_custom_domain', 400)
    }

    const check = await domains.verifyCustomDomain(site.hostname)
    let provisioned = false
    if (check.verified && site.status !== 'live') {
        site = await domains.provisionCustomVhost(site)
        provisioned = true
    }
    return { ...check, provisioned, site }
}

// ── status proxy (§13) ───────────────────────────────────────────────────────────

/** The managed-mode resource state for a domain (§0/Phase A) — null unless managed + present.
 *  `at_risk` (A7) = still serving, but the reconcile loop says the next apply would fail. */
export interface SiteNginxResourceState {
    state: 'active' | 'disabled' | 'at_risk'
    reason?: string
    /** ISO timestamp the reconcile loop first saw the resource failing. */
    since?: string
}

/** The site's stored row plus the live nginxpilot `/status` entry for its domain (or null). */
export interface SiteStatusResult {
    site: Site
    nginxpilot: NginxpilotSiteStatus | null
    /** Managed-mode resource state for this domain (null in unmanaged mode or when unseen). */
    nginxResource: SiteNginxResourceState | null
    /**
     * When the site's source credential was last written, or `null` when none is stored.
     * The secret is write-only — this reports its PRESENCE so the dashboard can show
     * "a credential is stored" and offer to replace it, never its value.
     */
    sourceSecretSetAt: string | null
}

/**
 * Proxy nginxpilot's `GET /status` for an owned site's domain (§13). Returns the stored row
 * alongside the live per-site status entry (null when nginxpilot hasn't seen the domain yet —
 * e.g. before the first reload). In managed mode, also resolves the daemon's per-resource
 * `nginx -t` verdict for this hostname (§0/Phase A) so the dashboard can surface a quarantined
 * site. Ownership is re-checked first.
 */
export async function siteStatus(viewer: SiteViewer, id: string): Promise<SiteStatusResult> {
    const site = ownedSite(id, viewer)
    // Status is a realm-scoped op — read the site's OWN realm (multiple_realms.md §D.2).
    const env = await realms.clientForSite(site).status()
    const entry = env.sites.find((s) => s.domain === site.hostname) ?? null
    const resource = env.nginx?.resources.find((r) => r.kind === 'site' && r.key === site.hostname)
    const nginxResource = resource
        ? { state: resource.state, reason: resource.reason, since: resource.since }
        : null

    // Interactive enforcement fallback (C1): record the freshly-measured size and run the
    // byte-cap ladder on a status read, so an over-quota site flags/suspends even if the
    // background sweep hasn't run yet. enforceBytes is a no-op while within the cap.
    let current = site
    if (entry?.bytes != null && entry.bytes !== current.bytes) {
        const at = new Date().toISOString()
        siteRepo.updateBytes(current.id, entry.bytes, at)
        current = { ...current, bytes: entry.bytes, updatedAt: at }
    }
    current = await enforceBytes(current)
    return {
        site: current,
        nginxpilot: entry,
        nginxResource,
        sourceSecretSetAt: siteCredentialRepo.updatedAt(site.id) ?? null,
    }
}

// ── error → HTTP mapping (so routes stay thin) ───────────────────────────────────

/** A route-ready error: the HTTP status + a machine-readable code (never a leaked message). */
export interface HttpError {
    status: number
    code: string
}

/**
 * Map any error a site operation can throw to its HTTP status + code. Known typed errors
 * carry their own status; infrastructure failures collapse to `502`; anything else is a
 * `500`. Messages are intentionally not forwarded to the client.
 */
export function httpErrorFor(err: unknown): HttpError {
    if (err instanceof SiteError || err instanceof QuotaError || err instanceof HostnameError) {
        return { status: err.status, code: err.code }
    }
    if (err instanceof GithubError) {
        return { status: err.status ?? 502, code: 'github_error' }
    }
    if (err instanceof NginxpilotError) {
        return { status: 502, code: 'nginxpilot_error' }
    }
    // A `RealmError` (e.g. no realm registered) delegates to the shared realm mapping;
    // anything else collapses to `500`.
    return realms.httpErrorFor(err)
}
