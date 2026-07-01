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
import * as realms from '@/server/services/realms'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import { slog } from '@/server/infrastructure/server-log'
import {
    NginxpilotError,
    type NginxpilotCert,
    type AcmeCredentialInfo,
    type CertIssueAccepted,
    type CertJob,
    type CertUploadResult,
    type AcmeCredentialResult,
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

function audit(ctx: CertContext, action: string, detail: string): void {
    auditRepo.append({ githubId: ctx.githubId, login: ctx.login, action, site: null, detail })
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
    audit(ctx, 'admin.cert.upload', `${domain} (${result.status})`)
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
