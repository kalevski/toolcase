// Centralized, validated configuration for voxscribe (spec §10). Reads
// `process.env` once and fails fast at first import if a required variable is
// missing. Ported from the blueprint (taskforge/quaykeeper `server/config.ts`).
//
// Server-only. Never import from a client component.

import 'server-only'
import os from 'node:os'
import path from 'node:path'

function required(name: string): string {
    const value = process.env[name]
    if (!value || value.trim() === '') {
        // During `next build` the module graph is imported for tracing; env is
        // not yet provided. Defer the failure to runtime (fail-fast at boot /
        // first request) rather than breaking the build.
        if (process.env.NEXT_PHASE === 'phase-production-build') return ''
        throw new Error(
            `[voxscribe] Missing required environment variable: ${name}. ` +
                `See voxscribe/.env.example for the full list.`,
        )
    }
    return value
}

/** Like `required`, but also rejects a too-short secret (weak HMAC key). */
function requiredSecret(name: string, minLen: number): string {
    const value = required(name)
    if (value && value.length < minLen) {
        throw new Error(
            `[voxscribe] ${name} must be at least ${minLen} characters (got ${value.length}). ` +
                `Use a long random string, e.g. \`openssl rand -hex 32\`.`,
        )
    }
    return value
}

function optional(name: string, fallback: string): string {
    const value = process.env[name]
    return value && value.trim() !== '' ? value.trim() : fallback
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

function workspaceDir(): string {
    return optional('WORKSPACE_DIR', '/workspace')
}

export const config = {
    // ── GitHub OAuth ──
    githubClientId: required('VOXSCRIBE_GITHUB_CLIENT_ID'),
    githubClientSecret: required('VOXSCRIBE_GITHUB_CLIENT_SECRET'),
    oauthRedirectUri: required('VOXSCRIBE_OAUTH_REDIRECT_URI'),

    // Public-facing origin (scheme + host[:port]) the browser actually talks to.
    // Behind a reverse proxy, `req.url` reflects the internal listen address, so
    // app-relative redirects built from it leak that internal host. The OAuth
    // redirect URI is the authoritative public URL; derive the origin from it.
    // Override with VOXSCRIBE_PUBLIC_ORIGIN if they differ.
    get publicOrigin(): string {
        const explicit = process.env.VOXSCRIBE_PUBLIC_ORIGIN
        if (explicit && explicit.trim() !== '') return explicit.trim().replace(/\/+$/, '')
        try {
            return new URL(this.oauthRedirectUri).origin
        } catch {
            return ''
        }
    },

    // ── session cookie ──
    authSecret: requiredSecret('VOXSCRIBE_AUTH_SECRET', 32),
    sessionTtl: num('VOXSCRIBE_SESSION_TTL', 86400),

    // ── optional allowlist / org gate (empty = open) ──
    allowedLogins: csv('VOXSCRIBE_GITHUB_ALLOWED_LOGINS'),
    allowedOrg: optional('VOXSCRIBE_GITHUB_ALLOWED_ORG', ''),

    // ── engine ──
    whisperBin: optional('VOXSCRIBE_WHISPER_BIN', 'whisper-cli'),
    get modelDir(): string {
        return optional('VOXSCRIBE_MODEL_DIR', path.join(workspaceDir(), 'models'))
    },
    defaultModel: optional('VOXSCRIBE_DEFAULT_MODEL', 'small'),
    allowedModels: (() => {
        const list = csv('VOXSCRIBE_ALLOWED_MODELS')
        return list.length > 0 ? list : ['tiny', 'base', 'small']
    })(),
    threads: num('VOXSCRIBE_THREADS', Math.max(1, os.cpus().length - 1)),

    // ── limits ──
    maxUploadBytes: num('VOXSCRIBE_MAX_UPLOAD_MB', 500) * 1024 * 1024,
    maxDurationSeconds: num('VOXSCRIBE_MAX_DURATION_MIN', 240) * 60,
    jobTimeoutMs: num('VOXSCRIBE_JOB_TIMEOUT_MIN', 120) * 60 * 1000,
    userQuotaBytes: num('VOXSCRIBE_USER_QUOTA_MB', 2048) * 1024 * 1024,

    // ── shared infra ──
    get workspaceDir(): string {
        return workspaceDir()
    },
    port: num('PORT', 4200),
}

export type Config = typeof config
