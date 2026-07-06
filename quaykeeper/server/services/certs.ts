// Certificate-management service (cert_feature.md) — the owner-facing seam for driving
// nginxpilot's certificate lifecycle over REST: list/issue/upload/renew/delete certs and
// the ACME DNS-provider credentials store. Every operation runs against the caller's ACTIVE
// realm (multiple_realms.md §E.2) via `realms.clientForActive`, so the owner manages certs on
// whichever instance the realm switcher has selected. The decrypted admin token never leaves
// the server; no secret material is ever logged or audited (only the provider name / domain).
//
// Pure decisions (domain normalization, provider validation, the credential-shape pre-checks)
// live in `domain/cert-input.ts` so they stay unit-testable; this is the `server-only` wiring
// that binds them to the realm client and the audit log. Routes stay thin: they parse the body,
// build the context, call a function here, and map the error with `httpErrorFor`.
//
// Server-only. Never import from a client component.

import 'server-only'
import { randomBytes } from 'node:crypto'
import { resolve4, resolve6 } from 'node:dns/promises'
import * as realms from '@/server/services/realms'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import { getSettings } from '@/server/services/settings'
import {
    classifyCertPreflight,
    wildcardPreflight,
    type CertPreflightResult,
} from '@/server/domain/cert-preflight'
import { slog } from '@/server/infrastructure/server-log'
import {
    NginxpilotError,
    type NginxpilotCert,
    type AcmeCredentialInfo,
    type CertIssueAccepted,
    type CertJob,
    type CertUploadResult,
    type AcmeCredentialResult,
    type CertsRenewalStatus,
} from '@/server/infrastructure/nginxpilot'
import {
    CertInputError,
    normalizeCertDomain,
    isWildcard,
    validateIssueDomains,
    validateIssueEmail,
    validateProvider,
    validateCredentialRequest,
    type AcmeCredentialRequest,
} from '@/server/domain/cert-input'
import type { Role } from '@/server/domain/types'

/** The acting owner + their role, derived from the session — drives realm resolution + audit. */
export interface CertContext {
    githubId: number
    login: string
    role: Role
}

function audit(ctx: CertContext, action: string, detail: string, meta?: unknown): void {
    auditRepo.append({ githubId: ctx.githubId, login: ctx.login, action, site: null, detail, meta })
}

// ── reads ────────────────────────────────────────────────────────────────────────

/** Every TLS cert the active realm's nginxpilot has discovered (`GET /certs`). */
export async function listCertificates(ctx: CertContext): Promise<NginxpilotCert[]> {
    const client = await realms.clientForActive(ctx.githubId, ctx.role)
    return client.listCertificates()
}

/** Stored ACME DNS-provider credentials for the active realm — metadata only (`GET /acme/credentials`). */
export async function listCredentials(ctx: CertContext): Promise<AcmeCredentialInfo[]> {
    const client = await realms.clientForActive(ctx.githubId, ctx.role)
    return client.listAcmeCredentials()
}

/**
 * The active realm's renewal-scheduler state (A6) — the `certs_renewal` block of
 * `GET /status`. `null` when the block is missing from the envelope, which the UI
 * renders as "renewal scheduler unknown" rather than "off".
 */
export async function renewalStatus(ctx: CertContext): Promise<CertsRenewalStatus | null> {
    const client = await realms.clientForActive(ctx.githubId, ctx.role)
    const status = await client.status()
    return status.certs_renewal ?? null
}

// ── issuance pre-flight (B2 — NPM's testHttpsChallenge, control-plane-side) ────────

/** How long the HTTP-01 path probe waits before calling the domain unreachable. */
const PREFLIGHT_PROBE_TIMEOUT_MS = 5_000

/**
 * Pre-flight one domain before issuing (B2): resolve its A/AAAA records, compare them
 * to this deployment's configured ingress IPs, and probe the HTTP-01 challenge path
 * (`/.well-known/acme-challenge/<nonce>` — ANY http answer, a webroot 404 included,
 * means the path is routable; refused/timeout means the challenge would too).
 * Advisory: it gates nothing, it saves rate-limited ACME attempts. Wildcards
 * short-circuit to the DNS-01 hint without probing. Pure classification lives in
 * `domain/cert-preflight.ts`; this gathers the signals.
 */
export async function preflight(
    ctx: CertContext,
    domainRaw: string,
): Promise<CertPreflightResult & { domain: string }> {
    const domain = normalizeCertDomain(domainRaw)
    if (isWildcard(domain)) {
        audit(ctx, 'admin.cert.preflight', `${domain}: wildcard_needs_dns`)
        return { domain, ...wildcardPreflight() }
    }

    const [a, aaaa] = await Promise.allSettled([resolve4(domain), resolve6(domain)])
    const resolved = [
        ...(a.status === 'fulfilled' ? a.value : []),
        ...(aaaa.status === 'fulfilled' ? aaaa.value : []),
    ]

    const settings = getSettings()
    const ingress = [settings.ingressIpv4, settings.ingressIpv6].filter(Boolean)

    // Only probe a domain that resolves — otherwise fetch would just re-report no-DNS.
    // Skip when any resolved address is private/loopback: the probe would become an
    // internal-network request steered by attacker-controlled DNS (SSRF), and such a
    // domain can never pass HTTP-01 from the public internet anyway.
    let challenge: 'reachable' | 'unreachable' | 'skipped' = 'skipped'
    if (resolved.length > 0 && !resolved.some((ip) => realms.isPrivateOrLoopbackIp(ip))) {
        const nonce = randomBytes(8).toString('hex')
        try {
            await fetch(`http://${domain}/.well-known/acme-challenge/quaykeeper-preflight-${nonce}`, {
                cache: 'no-store',
                redirect: 'manual',
                signal: AbortSignal.timeout(PREFLIGHT_PROBE_TIMEOUT_MS),
            })
            challenge = 'reachable'
        } catch {
            challenge = 'unreachable'
        }
    }

    const result = classifyCertPreflight({ resolved, ingress, challenge })
    audit(ctx, 'admin.cert.preflight', `${domain}: ${result.verdict}`)
    slog('info', 'certs', 'issuance pre-flight', { by: ctx.login, domain, verdict: result.verdict })
    return { domain, ...result }
}

// ── certificate lifecycle ──────────────────────────────────────────────────────────

/**
 * Issue a cert via certbot. Validates the domain set locally for fast feedback; the daemon
 * re-checks. `email` and `provider` are optional per-issue overrides — a blank email uses the
 * daemon's configured `acme.email`, a blank provider uses its configured `acme.dns.provider`.
 * `provider` should be one of the realm's stored DNS credentials (selected in the UI).
 */
export async function issueCertificate(
    ctx: CertContext,
    input: {
        domains: string | string[]
        certName?: string
        staging?: boolean
        email?: string
        provider?: string
    },
): Promise<CertIssueAccepted> {
    const domains = validateIssueDomains(input.domains)
    const certName = input.certName?.trim() || undefined
    const staging = input.staging === true
    const email = input.email?.trim() ? validateIssueEmail(input.email) : undefined
    const provider = input.provider?.trim() ? validateProvider(input.provider) : undefined
    const client = await realms.clientForActive(ctx.githubId, ctx.role)
    // Async: this returns once the daemon has ACCEPTED the job (202), not once certbot finishes.
    const accepted = await client.issueCertificate({ domains, certName, staging, email, provider })
    audit(
        ctx,
        'admin.cert.issue',
        `${certName ?? domains[0]} [${domains.join(', ')}]${provider ? ` via ${provider}` : ''}${
            email ? ` as ${email}` : ''
        }${staging ? ' (staging)' : ''} (job ${accepted.job_id})`,
        // Snapshot (B3): the full request minus nothing secret — issuance has no secret fields.
        { domains, cert_name: certName, staging, email, provider, job_id: accepted.job_id },
    )
    slog('info', 'certs', 'started certificate issuance', {
        by: ctx.login,
        domains,
        staging,
        provider,
        job: accepted.job_id,
    })
    return accepted
}

/** Poll one async issuance job on the active realm (`GET /certs/jobs/{id}`). */
export async function getIssueJob(ctx: CertContext, jobId: string): Promise<CertJob> {
    const client = await realms.clientForActive(ctx.githubId, ctx.role)
    return client.getCertJob(jobId)
}

/**
 * Recent async issuance jobs on the active realm (`GET /certs/jobs`), newest first.
 * Ephemeral on the daemon — recent history, not an archive.
 */
export async function listIssueJobs(ctx: CertContext): Promise<CertJob[]> {
    const client = await realms.clientForActive(ctx.githubId, ctx.role)
    return client.listCertJobs()
}

/** Upload a manual cert/key pair (no certbot). The key is never logged or audited. */
export async function uploadCertificate(
    ctx: CertContext,
    domainRaw: string,
    input: { cert: string; key: string },
): Promise<CertUploadResult> {
    const domain = normalizeCertDomain(domainRaw)
    if (isWildcard(domain)) {
        throw new CertInputError(
            'a manual upload uses a non-wildcard file stem (e.g. example.com), not a "*." wildcard',
            'invalid_domain',
        )
    }
    if (!input.cert?.trim() || !input.key?.trim()) {
        throw new CertInputError('both the certificate and the private key (PEM) are required', 'invalid_request')
    }
    const client = await realms.clientForActive(ctx.githubId, ctx.role)
    const result = await client.uploadCertificate(domain, { cert: input.cert, key: input.key })
    // Snapshot (B3): the resulting cert METADATA only — the PEM pair never reaches the log.
    audit(ctx, 'admin.cert.upload', `${domain} (${result.status})`, {
        domain,
        status: result.status,
        names: result.cert?.names,
        not_after: result.cert?.not_after,
    })
    slog('info', 'certs', 'uploaded manual certificate', { by: ctx.login, domain })
    return result
}

/** Renew every cert near expiry; returns certbot's plain-text summary. */
export async function renewAll(ctx: CertContext): Promise<string> {
    const client = await realms.clientForActive(ctx.githubId, ctx.role)
    const out = await client.renewDueCertificates()
    audit(ctx, 'admin.cert.renew_all', 'renew certs due for renewal')
    slog('info', 'certs', 'renewed due certificates', { by: ctx.login })
    return out
}

/** Force-renew one cert by name (the cert-name is the domain with any leading "*." stripped). */
export async function renewOne(ctx: CertContext, domainRaw: string): Promise<void> {
    const domain = normalizeCertDomain(domainRaw).replace(/^\*\./, '')
    const client = await realms.clientForActive(ctx.githubId, ctx.role)
    await client.renewCertificate(domain)
    audit(ctx, 'admin.cert.renew', domain)
    slog('info', 'certs', 'force-renewed certificate', { by: ctx.login, domain })
}

/** Delete a cert (certbot-managed or a manual pair — the daemon picks the source). */
export async function deleteCertificate(ctx: CertContext, domainRaw: string): Promise<void> {
    const domain = normalizeCertDomain(domainRaw).replace(/^\*\./, '')
    const client = await realms.clientForActive(ctx.githubId, ctx.role)
    await client.deleteCertificate(domain)
    audit(ctx, 'admin.cert.delete', domain)
    slog('info', 'certs', 'deleted certificate', { by: ctx.login, domain })
}

// ── ACME credentials store ──────────────────────────────────────────────────────────

/** Store (or replace) a provider's DNS credential. The secret body is NEVER logged or audited. */
export async function setCredentials(
    ctx: CertContext,
    providerRaw: string,
    req: AcmeCredentialRequest,
): Promise<AcmeCredentialResult> {
    const provider = validateProvider(providerRaw)
    validateCredentialRequest(provider, req)
    const client = await realms.clientForActive(ctx.githubId, ctx.role)
    const result = await client.setAcmeCredentials(provider, req)
    audit(ctx, 'admin.cert.creds_set', `${provider} (${result.status})`)
    slog('info', 'certs', 'stored acme provider credentials', { by: ctx.login, provider })
    return result
}

/** Remove a provider's stored credential. */
export async function deleteCredentials(ctx: CertContext, providerRaw: string): Promise<void> {
    const provider = validateProvider(providerRaw)
    const client = await realms.clientForActive(ctx.githubId, ctx.role)
    await client.deleteAcmeCredentials(provider)
    audit(ctx, 'admin.cert.creds_delete', provider)
    slog('info', 'certs', 'deleted acme provider credentials', { by: ctx.login, provider })
}

// ── error → HTTP mapping ────────────────────────────────────────────────────────────

export interface CertHttpError {
    status: number
    code: string
    /** A safe, operator-facing message (the daemon's reason for a cert op, or a validation detail). */
    message?: string
}

/**
 * Map a cert-service error to its HTTP status + code, forwarding an operator-useful message.
 * Cert ops are owner-only, so unlike the realm registry (which hides daemon messages) we DO
 * surface nginxpilot's reason — a certbot failure, "acme is not enabled", a bad-PEM rejection —
 * via `NginxpilotError.detail`. Client-meaningful daemon statuses (400/404/409/501) pass through;
 * anything else collapses to `502`. `CertInputError` is a local `400`; realm errors delegate.
 */
export function httpErrorFor(err: unknown): CertHttpError {
    if (err instanceof CertInputError) {
        return { status: 400, code: err.code, message: err.message }
    }
    if (err instanceof NginxpilotError) {
        const s = err.status
        const status = s === 400 || s === 404 || s === 409 || s === 501 ? s : 502
        const code =
            status === 501
                ? 'not_enabled'
                : status === 404
                  ? 'not_found'
                  : status === 502
                    ? 'nginxpilot_error'
                    : 'bad_request'
        return { status, code, message: err.detail }
    }
    // RealmError (no active realm, unknown realm) and anything else → the shared realm mapping.
    const { status, code } = realms.httpErrorFor(err)
    return { status, code }
}
