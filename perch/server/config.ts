// Centralized, validated configuration for Perch. Reads `process.env` once and
// fails fast at first import if a required variable is missing. Ported from
// TaskForge's `server/config.ts`, trimmed to the auth/OAuth surface this project
// needs today (the rest — nginxpilot seam, sponsors — arrive with later tasks).
//
// Server-only. Never import from a client component.
// See notes/static-hosting-app-design.md §5, §7, §16.

import 'server-only'

function required(name: string): string {
    const value = process.env[name]
    if (!value || value.trim() === '') {
        // During `next build` the module graph is imported for tracing; env is
        // not yet provided. Defer the failure to runtime (fail-fast at boot /
        // first request) rather than breaking the build.
        if (process.env.NEXT_PHASE === 'phase-production-build') return ''
        throw new Error(
            `[perch] Missing required environment variable: ${name}. ` +
                `See notes/static-hosting-app-design.md §7 for the auth env vars.`,
        )
    }
    return value
}

/** Like `required`, but also rejects a too-short secret (weak HMAC key). */
function requiredSecret(name: string, minLen: number): string {
    const value = required(name)
    // `required` returns '' during `next build` tracing — skip the length gate
    // there and let the runtime boot enforce it on the real value.
    if (value && value.length < minLen) {
        throw new Error(
            `[perch] ${name} must be at least ${minLen} characters (got ${value.length}). ` +
                `Use a long random string, e.g. \`openssl rand -hex 32\`.`,
        )
    }
    return value
}

function optional(name: string, fallback: string): string {
    const value = process.env[name]
    return value && value.trim() !== '' ? value : fallback
}

function num(name: string, fallback: number): number {
    const raw = process.env[name]
    if (!raw || raw.trim() === '') return fallback
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : fallback
}

function csv(name: string): string[] {
    const raw = process.env[name]
    if (!raw) return []
    return raw.split(',').flatMap((s) => {
        const trimmed = s.trim()
        return trimmed ? [trimmed] : []
    })
}

export const config = {
    // ── GitHub OAuth (§7) ──
    githubClientId: required('PERCH_GITHUB_CLIENT_ID'),
    githubClientSecret: required('PERCH_GITHUB_CLIENT_SECRET'),
    oauthRedirectUri: required('PERCH_OAUTH_REDIRECT_URI'),

    // Public-facing origin (scheme + host[:port]) the browser actually talks to.
    // Behind a reverse proxy, `req.url` reflects the internal listen address
    // (e.g. http://0.0.0.0:4100), so app-relative redirects built from it leak
    // that internal host to the browser. The OAuth redirect URI is the
    // authoritative public URL (GitHub redirects the browser there), so derive
    // the origin from it. Override with PERCH_PUBLIC_ORIGIN if they differ.
    get publicOrigin(): string {
        const explicit = process.env.PERCH_PUBLIC_ORIGIN
        if (explicit && explicit.trim() !== '') return explicit.trim().replace(/\/+$/, '')
        try {
            return new URL(this.oauthRedirectUri).origin
        } catch {
            return ''
        }
    },

    // ── session cookie (§7) ──
    authSecret: requiredSecret('PERCH_AUTH_SECRET', 16),
    sessionTtl: num('PERCH_SESSION_TTL', 86400),

    // ── optional allowlist / org gate (§7 — off by default for a public free service) ──
    allowedLogins: csv('PERCH_ALLOWED_LOGINS'),
    allowedOrg: optional('PERCH_ALLOWED_ORG', ''),

    port: num('PORT', 4100),
}

export type Config = typeof config
