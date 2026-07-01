// Pure ACME / certificate input rules — the load-bearing decisions behind Perch's
// certificate-management surface (driving nginxpilot's cert endpoints, cert_feature.md).
// Like `domain/types.ts` and `domain/hostname.ts` this file is client+server safe: NO
// `import 'server-only'`, no I/O. The UI imports the provider registry; the `services/
// certs.ts` wiring imports the validators; both share one source of truth so the form,
// the service, and nginxpilot agree on what a valid request looks like.
//
// nginxpilot re-validates everything server-side (it owns the certbot invocation), so
// these checks exist for fast UX feedback and to keep obviously-bad input off the wire —
// they are NOT the security boundary.

import { checkDomain } from './hostname'

/**
 * A certificate-input refusal. Carries a machine-readable `code` and is mapped to a
 * `400` by `services/certs.ts` (mirrors `HostnameError` / `RealmError`). The message is
 * safe to surface to the owner (no secret material ever flows through here).
 */
export class CertInputError extends Error {
    constructor(
        message: string,
        public code: string,
    ) {
        super(message)
        this.name = 'CertInputError'
    }
}

/** True for a leading-wildcard cert domain (`*.example.com`). Only DNS-01 can issue these. */
export function isWildcard(domain: string): boolean {
    return domain.startsWith('*.')
}

/**
 * Normalize one cert domain: trim, lowercase, drop a trailing dot, and validate the
 * shape. A SINGLE leading `*.` wildcard is allowed (the only place `*` may appear) —
 * `config.NormalizeDomain` on the daemon rejects wildcards, so this mirrors the admin
 * layer's `normalizeCertDomain` special-case. Throws {@link CertInputError}.
 */
export function normalizeCertDomain(raw: string): string {
    const d = raw.trim().toLowerCase().replace(/\.$/, '')
    if (d === '') throw new CertInputError('a domain is required', 'invalid_domain')
    const wild = isWildcard(d)
    const base = wild ? d.slice(2) : d
    if (base.includes('*')) {
        throw new CertInputError(
            `invalid domain "${raw}": a wildcard is only allowed as a single leading "*."`,
            'invalid_domain',
        )
    }
    const res = checkDomain(base)
    if (!res.ok) {
        throw new CertInputError(`invalid domain "${raw}": ${res.message}`, 'invalid_domain')
    }
    return wild ? `*.${res.domain}` : res.domain
}

/** Split a free-text domain list (commas / whitespace / newlines) into trimmed entries. */
export function parseDomains(input: string): string[] {
    return input
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
}

/**
 * Validate + normalize the domain set for an issue request: at least one domain, each
 * a valid (optionally wildcard) host, de-duplicated while preserving order. Accepts
 * either an array (API body) or a free-text string (the form field). Throws
 * {@link CertInputError}. The wildcard-requires-dns rule is enforced by nginxpilot at
 * issue time (it knows the configured challenge; Perch does not), surfaced as its `400`.
 */
export function validateIssueDomains(raw: string | string[]): string[] {
    const list = Array.isArray(raw) ? raw.map(String) : parseDomains(raw)
    if (list.length === 0) throw new CertInputError('at least one domain is required', 'no_domains')
    const out: string[] = []
    const seen = new Set<string>()
    for (const d of list) {
        const nd = normalizeCertDomain(d)
        if (!seen.has(nd)) {
            seen.add(nd)
            out.push(nd)
        }
    }
    return out
}

/**
 * Validate the optional per-issue ACME-account email override (a fast UX check only — the CA
 * is the real authority and rejects e.g. `@example.com`). Trims; throws {@link CertInputError}
 * on an obviously malformed address. Callers only invoke this when an email was actually
 * supplied; a blank email means "use the daemon's configured `acme.email`".
 */
export function validateIssueEmail(raw: string): string {
    const e = raw.trim()
    if (e === '') throw new CertInputError('an email is required', 'invalid_email')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
        throw new CertInputError(`invalid email "${raw}"`, 'invalid_email')
    }
    return e
}

// ── ACME DNS provider registry (the credentials store, cert_feature.md §2.8) ─────────

/** How a provider's credential is supplied through the convenience form (vs raw passthrough). */
export type CredentialShape = 'token' | 'aws' | 'google' | 'raw'

/** One known certbot DNS provider — its plugin name, label, and convenience-field shape. */
export interface ProviderSpec {
    /** The certbot DNS-plugin suffix → `--dns-<id>` (also the on-disk credential name). */
    id: string
    label: string
    shape: CredentialShape
    /** Short operator hint for the form (what the token/keys are). */
    hint: string
}

/**
 * The providers with a convenience form. Mirrors nginxpilot's `credstore.Build` registry —
 * any provider NOT listed here (or `shape: 'raw'`) must supply the full credentials body.
 * Keep this in sync with `internal/credstore/credstore.go`.
 */
export const KNOWN_PROVIDERS: readonly ProviderSpec[] = [
    { id: 'digitalocean', label: 'DigitalOcean', shape: 'token', hint: 'Personal access token with write scope.' },
    { id: 'cloudflare', label: 'Cloudflare', shape: 'token', hint: 'API token scoped to DNS edit for the zone.' },
    { id: 'linode', label: 'Linode', shape: 'token', hint: 'API v4 personal access token.' },
    { id: 'route53', label: 'AWS Route 53', shape: 'aws', hint: 'IAM access key + secret with Route 53 change access.' },
    { id: 'google', label: 'Google Cloud DNS', shape: 'google', hint: 'Service-account JSON key with DNS admin.' },
] as const

/** The certbot DNS-plugin name charset — also guards the on-disk filename (mirrors the daemon). */
export const PROVIDER_PATTERN = /^[a-z0-9-]+$/

/** The provider spec for an id, or undefined for an unknown / raw-only provider. */
export function providerSpec(id: string): ProviderSpec | undefined {
    return KNOWN_PROVIDERS.find((p) => p.id === id)
}

/** Human label for a credential mechanism (from `GET /acme/credentials`). */
export function mechanismLabel(mechanism: string): string {
    switch (mechanism) {
        case 'aws-file':
            return 'AWS shared credentials'
        case 'google':
            return 'Service-account JSON'
        case 'flag':
        default:
            return 'Credentials file'
    }
}

/** Validate + normalize a provider id (trim, lowercase). Throws {@link CertInputError}. */
export function validateProvider(raw: string): string {
    const p = raw.trim().toLowerCase()
    if (!PROVIDER_PATTERN.test(p)) {
        throw new CertInputError(
            `invalid provider "${raw}" — must match ${PROVIDER_PATTERN.source}`,
            'invalid_provider',
        )
    }
    return p
}

/**
 * The credential request body — the union nginxpilot's `credstore.Request` accepts. `credentials`
 * is the provider-agnostic raw INI/JSON passthrough (always wins); the typed fields are the
 * convenience form for the known providers. A secret value, so this NEVER appears in a log or audit.
 */
export interface AcmeCredentialRequest {
    /** Raw INI/JSON body — the escape hatch for any provider (wins over the typed fields). */
    credentials?: string
    /** DigitalOcean / Cloudflare / Linode token. */
    token?: string
    /** Route 53 access key id. */
    access_key?: string
    /** Route 53 secret access key. */
    secret_key?: string
    /** Google Cloud service-account JSON. */
    service_account_json?: string
}

const isSet = (s?: string): boolean => typeof s === 'string' && s.trim() !== ''

/**
 * Light pre-validation of a credential request for fast feedback: a raw `credentials` body is
 * always accepted; otherwise a known provider must carry the convenience field(s) its shape
 * requires, and an unknown provider must use the raw body. nginxpilot's `credstore.Build` is the
 * authority (it renders the artifact) — this only catches the obvious empty-form case early.
 * Throws {@link CertInputError}.
 */
export function validateCredentialRequest(provider: string, req: AcmeCredentialRequest): void {
    if (isSet(req.credentials)) return
    const spec = providerSpec(provider)
    if (!spec || spec.shape === 'raw') {
        throw new CertInputError(
            `provider "${provider}" has no convenience form — supply the raw credentials body`,
            'credentials_required',
        )
    }
    if (spec.shape === 'token' && !isSet(req.token)) {
        throw new CertInputError(`${spec.label} needs a token (or a raw credentials body)`, 'credentials_required')
    }
    if (spec.shape === 'aws' && (!isSet(req.access_key) || !isSet(req.secret_key))) {
        throw new CertInputError(
            `${spec.label} needs an access key and secret key (or a raw credentials body)`,
            'credentials_required',
        )
    }
    if (spec.shape === 'google' && !isSet(req.service_account_json)) {
        throw new CertInputError(
            `${spec.label} needs a service-account JSON key (or a raw credentials body)`,
            'credentials_required',
        )
    }
}
