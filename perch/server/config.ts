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

    // ── GitHub Sponsors → plan (§8, §16) ──
    // HMAC secret the Sponsors webhook signs `X-Hub-Signature-256` with. Validated
    // lazily (a getter) so the rest of the app boots without it — only the webhook
    // route reads it, and a missing/weak secret must fail loudly there (§16: a
    // forged/unsigned event can never grant a plan).
    get sponsorsWebhookSecret(): string {
        return requiredSecret('PERCH_SPONSORS_WEBHOOK_SECRET', 16)
    },
    // Owner PAT the scheduled reconcile uses to read `viewer.sponsorshipsAsMaintainer`
    // (the source of truth that self-heals missed webhooks). Optional: when unset
    // the reconcile job no-ops and only the webhook keeps the table fresh.
    sponsorsReconcileToken: optional('PERCH_SPONSORS_TOKEN', ''),
    // 5-field cron for the reconcile ticker (mirrors TaskForge's scheduler). Default
    // every 15 minutes.
    sponsorsReconcileCron: optional('PERCH_SPONSORS_RECONCILE_CRON', '*/15 * * * *'),

    // ── nginxpilot integration seam (§4, §16) ──
    // Base URL of nginxpilot's admin REST API (loopback by default — `admin.listen`
    // defaults to 127.0.0.1:9090; keep it off the public network, §16).
    nginxpilotAdminUrl: optional('PERCH_NGINXPILOT_ADMIN_URL', 'http://127.0.0.1:9090').replace(/\/+$/, ''),
    // Bearer token matching nginxpilot's `admin.token_env`. Optional: empty means the
    // admin endpoint runs unauthenticated (loopback default) and Perch sends no header.
    nginxpilotAdminToken: optional('PERCH_NGINXPILOT_ADMIN_TOKEN', ''),
    // Shared `sites.d/` directory Perch drops fragments into (Channel A). nginxpilot
    // picks them up on reload. Server-controlled path; fragment filenames are
    // server-generated (§16), never derived from user input.
    nginxpilotSitesDir: optional('PERCH_NGINXPILOT_SITES_DIR', '/etc/nginxpilot/sites.d'),
    // Fallback reload trigger (§4): until nginxpilot ships `POST /reload` (M4), Perch
    // touches this file and a reload-sidecar HUPs nginxpilot. Empty disables the
    // fallback (the file-drop alone is then picked up by a path/timer watcher).
    nginxpilotReloadTrigger: optional('PERCH_NGINXPILOT_RELOAD_TRIGGER', ''),

    port: num('PORT', 4100),
}

export type Config = typeof config
