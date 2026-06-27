// Hostname-namespace + custom-domain provisioning service (§4, §10, §16). A site
// attaches via one of two hostname modes that share ONE global namespace:
//
//   • subdomain  — `<label>.<baseDomain>` of an owner-registered base domain. No DNS
//                  work for the user and NO nginx reload: the wildcard `*.basedomain`
//                  server block + wildcard TLS already cover it (§4), so attaching is
//                  purely the nginxpilot fragment (handled by the deploy service).
//   • custom     — a verified custom domain with its own nginx vhost + cert. A
//                  paid-plan capability (`customDomains > 0`, §728), gated on a
//                  server-side DNS check that the domain points at our ingress IP
//                  BEFORE any cert is issued (§16: prevents domain takeover).
//
// All hostnames are strictly validated here before they can reach a YAML fragment or
// an nginx config (§16: hostname injection). The pure, unit-tested decisions —
// label/domain shape, the reserved-word blocklist, the DNS-match check — live in
// `domain/hostname.ts`; this is the `server-only` wiring that binds them to the
// repositories (uniqueness), the quota service (§728), the nginx/certbot seam, and
// the nginxpilot vhost renderer.
//
// See notes/static-hosting-app-design.md §4, §10, §16.

import 'server-only'
import * as siteRepo from '@/server/data/repositories/site-repo'
import * as baseDomainRepo from '@/server/data/repositories/base-domain-repo'
import * as userRepo from '@/server/data/repositories/user-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import * as nginx from '@/server/infrastructure/nginx'
import * as nginxpilot from '@/server/infrastructure/nginxpilot'
import * as deploy from '@/server/services/deploy'
import { assertCanUseCustomDomain } from '@/server/services/quota'
import { effectiveIngressIpv4 } from '@/server/services/settings'
import { slog } from '@/server/infrastructure/server-log'
import { checkDomain, checkLabel, dnsPointsAt } from '@/server/domain/hostname'
import type { Site } from '@/server/domain/types'

/**
 * A hostname-validation / provisioning refusal. Carries a machine-readable `code` and
 * the HTTP `status` a route should map it to (mirrors `QuotaError` / `GithubError`):
 * `400` for a malformed/reserved hostname, `409` for a namespace conflict or an
 * unverified domain, `503` when verification is unavailable.
 */
export class HostnameError extends Error {
    constructor(
        message: string,
        public code: string,
        public status: 400 | 409 | 503,
    ) {
        super(message)
        this.name = 'HostnameError'
    }
}

// ── hostname validation (one namespace, strict, §10 / §16) ─────────────────────

/**
 * Validate a subdomain `label` against a registered `baseDomain` and return the
 * resulting fully-qualified hostname (`<label>.<baseDomain>`). Enforces, in order:
 *
 *   1. the base domain is one the owner actually registered (§10 subdomain pool),
 *   2. the label is DNS-safe, in-length, and not reserved (pure `checkLabel`),
 *   3. global uniqueness across the WHOLE hostname namespace — `siteRepo.hostnameTaken`
 *      checks the single `site.hostname` column, which holds both subdomain hostnames
 *      AND custom domains, so a label can't collide with either (§10: one namespace).
 *
 * Throws `HostnameError` on any failure; never performs I/O beyond the repo reads.
 */
export function validateLabel(label: string, baseDomain: string): string {
    const base = baseDomain.trim().toLowerCase()
    if (!baseDomainRepo.list().some((b) => b.domain.toLowerCase() === base)) {
        throw new HostnameError(`unknown base domain "${baseDomain}"`, 'unknown_base_domain', 400)
    }

    const checked = checkLabel(label)
    if (!checked.ok) {
        throw new HostnameError(checked.message, `label_${checked.reason}`, 400)
    }

    const hostname = `${checked.label}.${base}`
    if (siteRepo.hostnameTaken(hostname)) {
        throw new HostnameError(`"${hostname}" is already taken`, 'hostname_taken', 409)
    }
    return hostname
}

/**
 * Validate a user-supplied custom domain and return its normalized form. Enforces:
 *
 *   1. a well-formed, DNS-safe FQDN (pure `checkDomain`),
 *   2. it isn't actually one of our base domains (or a subdomain of one) — that path
 *      must go through {@link validateLabel}, not the custom-domain flow,
 *   3. global uniqueness across the shared hostname namespace.
 *
 * This is the strict gate a custom domain passes before DNS verification and before it
 * ever reaches `GET /vhost/{domain}` or a cert request (§16). Throws `HostnameError`.
 */
export function validateCustomDomain(domain: string): string {
    const checked = checkDomain(domain)
    if (!checked.ok) {
        throw new HostnameError(checked.message, `domain_${checked.reason}`, 400)
    }
    const host = checked.domain

    for (const { domain: base } of baseDomainRepo.list()) {
        const b = base.toLowerCase()
        if (host === b || host.endsWith(`.${b}`)) {
            throw new HostnameError(
                `"${host}" is under a Perch base domain — attach it as a subdomain instead`,
                'use_subdomain',
                400,
            )
        }
    }

    if (siteRepo.hostnameTaken(host)) {
        throw new HostnameError(`"${host}" is already taken`, 'hostname_taken', 409)
    }
    return host
}

// ── subdomain attach (no nginx work — the wildcard covers it, §4 / §10) ─────────

/**
 * Attach a subdomain site. Subdomains need **no nginx reload and no cert work**: the
 * wildcard `*.basedomain` server block and its wildcard TLS cert already serve every
 * label (§4). Attaching is therefore purely the nginxpilot fragment — write + reload
 * the *daemon* + force the first sync — which is exactly the deploy service's
 * `provision`. This thin wrapper exists to make that "subdomains skip the nginx layer"
 * contract explicit at the call site; custom domains use {@link provisionCustomVhost}.
 */
export function attachSubdomain(site: Site): Promise<Site> {
    return deploy.provision(site)
}

// ── custom-domain verification (takeover guard, §10 / §16) ─────────────────────

/** Outcome of {@link verifyCustomDomain} — surfaced to the UI's "Verify" button. */
export interface DomainVerification {
    /** The normalized domain that was checked. */
    domain: string
    /** True iff the domain's A-records include our ingress IP. */
    verified: boolean
    /** The ingress IP the domain must point at (the effective setting, §13). */
    expected: string
    /** The A-records actually resolved (empty on NXDOMAIN / no A record / error). */
    resolved: string[]
}

/**
 * Resolve a custom domain server-side and confirm it points at the effective ingress
 * IP before provisioning (§10 "Verify", §16: prevents claiming a domain you don't
 * control). The ingress IP comes from the settings service (the owner-set override,
 * else the `PERCH_INGRESS_IPV4` env default). **Fails closed** at every step: an
 * unconfigured ingress IP, an NXDOMAIN/no-A-record/resolver error, or a non-matching
 * A-record all yield `verified: false` (never an issued cert). Validates the domain
 * shape first, so a malformed domain is rejected (`HostnameError`) before any lookup.
 */
export async function verifyCustomDomain(domain: string): Promise<DomainVerification> {
    const checked = checkDomain(domain)
    if (!checked.ok) {
        throw new HostnameError(checked.message, `domain_${checked.reason}`, 400)
    }
    const host = checked.domain
    const expected = effectiveIngressIpv4()

    if (!expected) {
        // We have no ingress IP to compare against — verification is unavailable.
        // Fail loudly rather than silently report "not verified", so the operator
        // knows to set the ingress IP (admin Settings, or PERCH_INGRESS_IPV4) (§16).
        throw new HostnameError(
            'custom-domain verification is unavailable — set the server IP in admin Settings',
            'ingress_unconfigured',
            503,
        )
    }

    const resolved = await nginx.resolveIpv4(host)
    const verified = dnsPointsAt(resolved, expected)
    slog('info', 'domains', verified ? 'custom domain verified' : 'custom domain not yet pointing at ingress', {
        domain: host,
        expected,
        resolved,
    })
    return { domain: host, verified, expected, resolved }
}

// ── custom-domain provisioning (own vhost + cert, §10) ─────────────────────────

/** Append one audit entry for a custom-domain transition, attributed to the site owner. */
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
 * Provision the nginx serving layer for a verified custom-domain site (§10): re-check
 * the plan gate (§728) and the DNS verification (defense in depth — never issue a cert
 * for an unverified domain, §16), render the vhost via nginxpilot's `GET /vhost/{domain}`,
 * install it into `conf.d/`, obtain a cert via certbot HTTP-01, reload nginx, and mark
 * the site `live`. The *content* channel (the nginxpilot fragment that syncs the repo)
 * is the deploy service's job and is provisioned separately; this owns only the nginx
 * vhost + cert layer that a custom domain — unlike a subdomain — requires.
 *
 * Throws `HostnameError` (plan/verification) or `NginxError` (vhost/cert/reload) on
 * failure, leaving the site un-`live` so a partial provision is never reported as ready.
 */
export async function provisionCustomVhost(site: Site): Promise<Site> {
    const owner = userRepo.get(site.ownerId)
    if (!owner) {
        throw new HostnameError('site owner not found', 'owner_not_found', 409)
    }
    // Custom domains are a paid-plan capability — delegate the gate to §728.
    assertCanUseCustomDomain(owner.login)

    // Re-verify right before issuing a cert: the DNS could have changed since the
    // user clicked "Verify", and a cert must never be minted for a domain that
    // doesn't demonstrably point at us (§16).
    const check = await verifyCustomDomain(site.hostname)
    if (!check.verified) {
        throw new HostnameError(
            `"${site.hostname}" does not point at ${check.expected} yet — verify DNS before provisioning`,
            'domain_not_verified',
            409,
        )
    }

    const vhostText = await nginxpilot.vhost(site.hostname)
    await nginx.installVhost(site.hostname, vhostText)
    await nginx.obtainCert(site.hostname)
    await nginx.reload()

    const at = new Date().toISOString()
    siteRepo.updateStatus(site.id, 'live', at)
    audit('site.custom_domain.live', site, `vhost installed + cert issued for ${site.hostname}`)
    return { ...site, status: 'live', updatedAt: at }
}

/**
 * Tear down a custom domain's nginx serving layer (§10): drop the vhost from `conf.d/`,
 * delete its cert, and reload nginx so it stops serving. Idempotent and best-effort on
 * the cert delete (a missing cert is not an error), so it composes cleanly with the
 * deploy service's `remove` (which drops the nginxpilot fragment + row). Used both on
 * site deletion and when a custom-domain site is suspended.
 */
export async function teardownCustomVhost(site: Site): Promise<void> {
    await nginx.removeVhost(site.hostname)
    await nginx.dropCert(site.hostname)
    await nginx.reload()
    audit('site.custom_domain.teardown', site, `dropped vhost + cert for ${site.hostname}`)
}
