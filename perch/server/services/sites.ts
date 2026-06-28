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
import * as userRepo from '@/server/data/repositories/user-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import * as deploy from '@/server/services/deploy'
import * as domains from '@/server/services/domains'
import * as realms from '@/server/services/realms'
import { HostnameError } from '@/server/services/domains'
import { QuotaError, assertCanCreateSite, assertCanUseCustomDomain } from '@/server/services/quota'
import { GithubError } from '@/server/infrastructure/github'
import { NginxpilotError, type NginxpilotSiteStatus } from '@/server/infrastructure/nginxpilot'
import { NginxError } from '@/server/infrastructure/nginx'
import { resolveSiteAccess, type SiteViewer } from '@/server/domain/site-access'
import { checkBranch, checkRepoName, checkRepoOwner, checkSubdir } from '@/server/domain/site-input'
import { checkDomain, checkLabel } from '@/server/domain/hostname'
import type { AppUser, Site, SiteHostKind } from '@/server/domain/types'

export type { SiteViewer } from '@/server/domain/site-access'

/**
 * A site-service refusal that isn't already a quota/hostname error: a malformed request
 * body (`400`), a missing/foreign site (`404`/`403`, from the ownership re-check), or a
 * caller whose account row vanished mid-request (`401`). Carries the machine-readable
 * `code` and HTTP `status` a route returns (mirrors `QuotaError` / `HostnameError`).
 */
export class SiteError extends Error {
    constructor(
        message: string,
        public code: string,
        public status: 400 | 401 | 403 | 404,
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

/** `POST /api/sites` body — repo coordinates + a hostname spec. */
export interface CreateSiteRequest {
    repoOwner: string
    repoName: string
    branch: string
    subdir?: string | null
    hostname: HostnameSpec
}

/** `PATCH /api/sites/{id}` body — any subset of branch / subdir / hostname (§9 step 6). */
export interface UpdateSiteRequest {
    branch?: string
    /** `null` clears the build subdir; omitted leaves it unchanged. */
    subdir?: string | null
    /** A new hostname spec to move the site to; omitted leaves the hostname unchanged. */
    hostname?: HostnameSpec
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

/** Read one owned site (§13 ownership re-check). Throws `SiteError` 404/403. */
export function getSite(viewer: SiteViewer, id: string): Site {
    return ownedSite(id, viewer)
}

// ── create (§9 steps 1–4) ──────────────────────────────────────────────────────

/**
 * Create a site for the caller: validate the source + hostname, gate on the per-plan
 * site count (§728), persist the row, then provision it through the deploy state machine
 * (§727: fragment → reload → first sync). Custom domains additionally need their vhost +
 * cert, installed later via {@link verifyDomain} once DNS verifies (§729) — provision here
 * primes the content channel regardless. Returns the provisioned (`provisioning`) site.
 */
export async function createSite(viewer: SiteViewer, body: CreateSiteRequest): Promise<Site> {
    const owner = userRepo.get(viewer.sub)
    if (!owner) throw new SiteError('account not found', 'account_not_found', 401)

    const repoOwner = field(checkRepoOwner(str(body.repoOwner, 'repoOwner')))
    const repoName = field(checkRepoName(str(body.repoName, 'repoName')))
    const branch = field(checkBranch(str(body.branch, 'branch')))
    const subdirCheck = checkSubdir(body.subdir)
    if (!subdirCheck.ok) throw new SiteError(subdirCheck.message, `invalid_${subdirCheck.reason}`, 400)
    const subdir = subdirCheck.value

    if (!body.hostname || typeof body.hostname !== 'object') {
        throw new SiteError('"hostname" is required', 'invalid_request', 400)
    }

    // Hard, pre-emptive count gate (§11 point 1) before we touch the namespace.
    assertCanCreateSite(owner.login)

    // Pick the target realm (multiple_realms.md §D.2): the active realm (the owner's
    // switcher choice; a non-owner's owner-assigned default). The site is bound to it and
    // hostname uniqueness is scoped to it.
    const activeRealm = await realms.resolveActiveRealm(viewer.sub, viewer.role)
    const hostname = resolveHostname(body.hostname, owner, activeRealm.id)

    const now = new Date().toISOString()
    const site: Site = {
        id: generateSiteId(),
        ownerId: owner.githubId,
        repoOwner,
        repoName,
        branch,
        subdir,
        hostname,
        hostKind: body.hostname.kind,
        realmId: activeRealm.id,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
    }
    siteRepo.create(site)
    audit('site.create', owner, site, `${repoOwner}/${repoName}@${branch}${subdir ? ` subdir=${subdir}` : ''}`)

    return deploy.provision(site)
}

// ── update (§9 step 6) ─────────────────────────────────────────────────────────

/**
 * Update an owned site's branch / subdir / hostname (§13 ownership re-check first). A
 * branch/subdir change re-renders the fragment and re-syncs (`deploy.update`). A hostname
 * change re-validates the shared namespace (§729), tears down the old custom vhost when
 * leaving a custom domain, moves the row, and re-provisions the content channel on the new
 * domain — a move *to* a custom domain still needs {@link verifyDomain} to install its
 * vhost + cert. Returns the updated site.
 */
export async function updateSite(viewer: SiteViewer, id: string, body: UpdateSiteRequest): Promise<Site> {
    let site = ownedSite(id, viewer)
    const owner = ownerOf(site)

    // Validate any source changes up front (so a bad branch never reaches deploy).
    const branch = body.branch !== undefined ? field(checkBranch(str(body.branch, 'branch'))) : undefined
    let subdir: string | undefined
    const hasSubdir = 'subdir' in body
    if (hasSubdir) {
        const c = checkSubdir(body.subdir)
        if (!c.ok) throw new SiteError(c.message, `invalid_${c.reason}`, 400)
        subdir = c.value
    }

    // 1) Hostname move (if requested and actually different).
    if (body.hostname && typeof body.hostname === 'object') {
        const candidate = candidateHostname(body.hostname)
        if (candidate !== site.hostname) {
            site = await changeHostname(site, owner, body.hostname, { branch, subdir, hasSubdir })
            return site
        }
    }

    // 2) Source-only change.
    site = await deploy.update(site, {
        branch,
        ...(hasSubdir ? { subdir: subdir ?? null } : {}),
    })
    return site
}

/**
 * Move a site to a new hostname (and optionally apply a branch/subdir change in the same
 * re-provision). Validates the new hostname authoritatively (§729 + §728 for custom), drops
 * the old custom vhost/cert if the site is leaving a custom domain, persists the row, and
 * re-provisions the content channel on the new domain.
 */
async function changeHostname(
    site: Site,
    owner: AppUser,
    spec: HostnameSpec,
    source: { branch?: string; subdir?: string; hasSubdir: boolean },
): Promise<Site> {
    // A rehost stays within the site's own realm (multiple_realms.md §D.2).
    const newHostname = resolveHostname(spec, owner, site.realmId)
    const newKind: SiteHostKind = spec.kind

    if (site.hostKind === 'custom') {
        // Stop serving the old custom domain before repointing the row.
        await domains.teardownCustomVhost(site)
    }

    const at = new Date().toISOString()
    const branch = source.branch ?? site.branch
    const subdir = source.hasSubdir ? source.subdir : site.subdir
    if (branch !== site.branch || subdir !== site.subdir) {
        siteRepo.updateSource(site.id, branch, subdir, at)
    }
    siteRepo.updateHostname(site.id, newHostname, newKind, at)
    audit('site.rehost', owner, { ...site, hostname: newHostname }, `${site.hostname} → ${newHostname}`)

    const moved: Site = { ...site, branch, subdir, hostname: newHostname, hostKind: newKind, updatedAt: at }
    return deploy.provision(moved)
}

// ── delete (§9 step 7) ─────────────────────────────────────────────────────────

/**
 * Delete an owned site (§13 ownership re-check first): drop the nginxpilot fragment + reload
 * + remove the row (`deploy.remove`), and tear down the custom-domain vhost/cert when the
 * site has one (§729).
 */
export async function deleteSite(viewer: SiteViewer, id: string): Promise<void> {
    const site = ownedSite(id, viewer)
    if (site.hostKind === 'custom') {
        await domains.teardownCustomVhost(site)
    }
    await deploy.remove(site)
}

// ── redeploy (§9 step 6 — the "Redeploy" button) ─────────────────────────────────

/** Force an immediate redeploy of an owned site (`POST /sync/{domain}`, §13 re-check). */
export async function redeploySite(viewer: SiteViewer, id: string): Promise<Site> {
    const site = ownedSite(id, viewer)
    return deploy.redeploy(site)
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

/** The managed-mode resource state for a domain (§0/Phase A) — null unless managed + present. */
export interface SiteNginxResourceState {
    state: 'active' | 'disabled'
    reason?: string
}

/** The site's stored row plus the live nginxpilot `/status` entry for its domain (or null). */
export interface SiteStatusResult {
    site: Site
    nginxpilot: NginxpilotSiteStatus | null
    /** Managed-mode resource state for this domain (null in unmanaged mode or when unseen). */
    nginxResource: SiteNginxResourceState | null
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
    const nginxResource = resource ? { state: resource.state, reason: resource.reason } : null
    return { site, nginxpilot: entry, nginxResource }
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
    if (err instanceof NginxError) {
        return { status: 502, code: 'nginx_error' }
    }
    return { status: 500, code: 'internal_error' }
}
