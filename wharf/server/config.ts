// Centralized, validated configuration. Reads `process.env` once and fails fast
// at first import if a required variable is missing (blueprint §config). Two
// listeners run in one process: the Next dashboard on PORT and the Agent API on
// AGENT_PORT (planning §5). Server-only — never import from a client component.

import 'server-only'

function required(name: string): string {
    const value = process.env[name]
    if (!value || value.trim() === '') {
        // During `next build` the module graph is imported for tracing; env is not
        // yet provided. Defer the failure to runtime rather than breaking the build.
        if (process.env.NEXT_PHASE === 'phase-production-build') return ''
        throw new Error(
            `[wharf] Missing required environment variable: ${name}. See .env.example for the full list.`,
        )
    }
    return value
}

/** Like `required`, but also rejects a too-short secret (weak HMAC / weak key). */
function requiredSecret(name: string, minLen: number): string {
    const value = required(name)
    if (value && value.length < minLen) {
        throw new Error(
            `[wharf] ${name} must be at least ${minLen} characters (got ${value.length}). ` +
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
    // ── auth ──
    githubClientId: required('GITHUB_CLIENT_ID'),
    githubClientSecret: required('GITHUB_CLIENT_SECRET'),
    oauthRedirectUri: required('OAUTH_REDIRECT_URI'),
    // Public-facing origin the browser actually talks to. Behind a reverse proxy
    // `req.url` reflects the internal listen address, so derive the origin from the
    // (trusted) OAuth redirect URI. Override with PUBLIC_ORIGIN if they differ.
    get publicOrigin(): string {
        const explicit = process.env.PUBLIC_ORIGIN
        if (explicit && explicit.trim() !== '') return explicit.trim().replace(/\/+$/, '')
        try {
            return new URL(this.oauthRedirectUri).origin
        } catch {
            return ''
        }
    },
    authSecret: requiredSecret('AUTH_SECRET', 16),
    sessionTtl: num('SESSION_TTL', 86400),
    allowedLogins: csv('GITHUB_ALLOWED_LOGINS'),
    allowedOrg: optional('GITHUB_ALLOWED_ORG', ''),

    // ── encryption (values at rest + backups; keyring for rotation, gap-1) ──
    // 32-byte key as 64 hex chars. `cipher.ts` builds a keyring of {current, prev}.
    encryptionKey: requiredSecret('ENCRYPTION_KEY', 32),
    encryptionKeyPrev: optional('ENCRYPTION_KEY_PREV', ''),

    // ── storage ──
    workspaceDir: optional('WORKSPACE_DIR', '/workspace'),
    /** SQLite database file — system of record for app state (see server/data/db.ts). */
    get dbPath() {
        return process.env.DB_PATH && process.env.DB_PATH.trim() !== ''
            ? process.env.DB_PATH.trim()
            : `${this.workspaceDir}/wharf.db`
    },
    get backupDir() {
        return optional('BACKUP_DIR', `${this.workspaceDir}/backups`)
    },
    backupIntervalHours: num('BACKUP_INTERVAL_HOURS', 24),
    backupRetention: num('BACKUP_RETENTION', 14),
    auditRetentionDays: num('AUDIT_RETENTION_DAYS', 90),

    // ── dashboard listener (human, public) ──
    port: num('PORT', 3000),

    // ── agent API listener (machine, internal-only — planning §5) ──
    agentPort: num('AGENT_PORT', 4000),
    agentHost: optional('AGENT_HOST', '0.0.0.0'),
    /** Where the baked-in cross-compiled wharf-client binaries + checksums.txt live. */
    get clientDir() {
        return optional('WHARF_CLIENT_DIR', `${process.cwd()}/wharf/client-bin`)
    },
}

export type Config = typeof config
