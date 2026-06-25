// Pure hostname-namespace rules (§10, §16) — no `server-only`, no I/O. Subdomain
// labels and custom domains share ONE hostname namespace (exactly how nginxpilot
// treats `sites` + `proxies`), and every hostname must be strictly DNS-safe before
// it can reach a YAML fragment or an nginx config (§16: hostname injection). The
// load-bearing decisions live here so they can be unit-tested in isolation:
//
//   • `checkLabel`     — a subdomain label is DNS-safe, in-length, not reserved.
//   • `checkDomain`    — a custom domain is a well-formed, DNS-safe FQDN.
//   • `dnsPointsAt`    — a resolved A-record set actually contains our ingress IP
//                        (fails closed on an empty/unknown answer — §16 takeover).
//
// `services/domains.ts` wraps these with the repository uniqueness checks, the
// nginx/certbot seam, and DNS resolution. See notes/static-hosting-app-design.md
// §4, §10, §16.

// ── DNS label / domain shape (RFC 1035 LDH) ───────────────────────────────────

/** Max length of a single DNS label (RFC 1035). */
export const MAX_LABEL_LENGTH = 63

/** Max length of a full domain name (RFC 1035). */
export const MAX_DOMAIN_LENGTH = 253

// A single DNS label: lowercase letter/digit at each end, letters/digits/hyphens
// inside, 1–63 chars, never leading/trailing hyphen. This is the LDH rule nginx and
// every resolver expect; anything else is rejected rather than normalized away.
const LABEL_SRC = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?'

/** A subdomain label in isolation (`alice`, `my-site`). */
export const LABEL_PATTERN = new RegExp(`^${LABEL_SRC}$`)

/** A fully-qualified custom domain: ≥2 LDH labels with an alphabetic TLD. */
export const DOMAIN_PATTERN = new RegExp(`^(?:${LABEL_SRC}\\.)+[a-z]{2,}$`)

/**
 * Reserved subdomain labels that may never be claimed by a user (§10). Beyond the
 * `www`/`api`/`admin`/`app` the spec names, this blocks the labels a public host
 * conventionally reserves for its own infrastructure, mail, and control surfaces —
 * so a user can never stand a site up at e.g. `login.perch.dev` or `mail.perch.dev`.
 */
export const RESERVED_LABELS: ReadonlySet<string> = new Set([
    // the spec's named four
    'www',
    'api',
    'admin',
    'app',
    // control plane / product surfaces
    'perch',
    'owner',
    'dashboard',
    'console',
    'account',
    'accounts',
    'billing',
    'login',
    'logout',
    'signin',
    'signup',
    'register',
    'auth',
    'oauth',
    'sso',
    'sponsor',
    'sponsors',
    'plan',
    'plans',
    'status',
    'health',
    'healthz',
    'help',
    'support',
    'docs',
    'doc',
    'blog',
    'about',
    // infra / serving stack
    'nginx',
    'certbot',
    'ssl',
    'tls',
    'cdn',
    'static',
    'assets',
    'internal',
    'system',
    'root',
    'ns',
    'ns1',
    'ns2',
    'dns',
    'proxy',
    'gateway',
    'ingress',
    // mail
    'mail',
    'email',
    'smtp',
    'imap',
    'pop',
    'webmail',
    'mx',
    'postmaster',
    'hostmaster',
    'webmaster',
    'noreply',
    'no-reply',
    'abuse',
    'security',
    // common environments
    'dev',
    'test',
    'stage',
    'staging',
    'demo',
    'preview',
    'beta',
])

// ── label validation (subdomain mode, §10) ────────────────────────────────────

/** Why a label was rejected (machine-readable; the service maps it to an HTTP code). */
export type LabelRejection = 'empty' | 'too_long' | 'charset' | 'reserved'

/** Result of {@link checkLabel}: the normalized label, or a typed rejection. */
export type LabelCheck =
    | { ok: true; label: string }
    | { ok: false; reason: LabelRejection; message: string }

/**
 * Validate a user-supplied subdomain label *shape* (§10, §16): trim + lowercase,
 * then enforce the RFC-1035 LDH charset, the 63-char length, and the reserved-word
 * blocklist. Returns the normalized label on success. Global uniqueness against the
 * shared hostname namespace is the service's job (it needs `siteRepo`); this is the
 * pure, I/O-free part so it can be unit-tested directly.
 */
export function checkLabel(raw: string): LabelCheck {
    const label = raw.trim().toLowerCase()
    if (label === '') {
        return { ok: false, reason: 'empty', message: 'subdomain label is required' }
    }
    if (label.length > MAX_LABEL_LENGTH) {
        return {
            ok: false,
            reason: 'too_long',
            message: `subdomain label must be at most ${MAX_LABEL_LENGTH} characters`,
        }
    }
    if (!LABEL_PATTERN.test(label)) {
        return {
            ok: false,
            reason: 'charset',
            message:
                'subdomain label must be DNS-safe: lowercase letters, digits, and hyphens ' +
                '(not leading/trailing)',
        }
    }
    if (RESERVED_LABELS.has(label)) {
        return { ok: false, reason: 'reserved', message: `"${label}" is a reserved subdomain` }
    }
    return { ok: true, label }
}

// ── custom-domain validation (custom mode, §10) ───────────────────────────────

/** Why a custom domain was rejected. */
export type DomainRejection = 'empty' | 'too_long' | 'charset'

/** Result of {@link checkDomain}: the normalized FQDN, or a typed rejection. */
export type DomainCheck =
    | { ok: true; domain: string }
    | { ok: false; reason: DomainRejection; message: string }

/**
 * Validate a user-supplied custom domain *shape* (§10, §16): trim, lowercase, strip a
 * trailing dot, then enforce the 253-char total length and a strict FQDN charset
 * (≥2 LDH labels, alphabetic TLD). Returns the normalized domain. Uniqueness and the
 * "this is actually one of our base domains — use a subdomain" check are the
 * service's job (they need the repositories).
 */
export function checkDomain(raw: string): DomainCheck {
    const domain = raw.trim().toLowerCase().replace(/\.$/, '')
    if (domain === '') {
        return { ok: false, reason: 'empty', message: 'custom domain is required' }
    }
    if (domain.length > MAX_DOMAIN_LENGTH) {
        return {
            ok: false,
            reason: 'too_long',
            message: `custom domain must be at most ${MAX_DOMAIN_LENGTH} characters`,
        }
    }
    if (!DOMAIN_PATTERN.test(domain)) {
        return {
            ok: false,
            reason: 'charset',
            message:
                'custom domain must be a valid DNS hostname, e.g. www.example.com ' +
                '(lowercase letters, digits, hyphens, and dots)',
        }
    }
    return { ok: true, domain }
}

// ── DNS verification decision (custom-domain takeover guard, §16) ──────────────

/**
 * Whether a domain's resolved A-records actually include our ingress IP — the pure
 * decision behind the "Verify" action (§10) that prevents domain takeover (§16: a
 * user can't claim a domain they don't control). **Fails closed**: an empty/unknown
 * answer (NXDOMAIN, no A record, resolver error → `[]`) or an unconfigured ingress
 * IP (`expected === ''`) is never a match, so provisioning never proceeds on a domain
 * that doesn't demonstrably point at us.
 */
export function dnsPointsAt(resolved: readonly string[], expected: string): boolean {
    const want = expected.trim()
    if (want === '') return false
    return resolved.some((ip) => ip.trim() === want)
}
