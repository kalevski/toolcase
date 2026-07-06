// Centralized, validated configuration. Reads `process.env` once and fails
// fast at first import if a required variable is missing (§4.4, §11).
//
// Server-only. Never import from client components.

import 'server-only'

// Every app-owned variable is namespaced `TASKFORGE_<NAME>`; the bare name is
// still honored as a fallback so existing deployments keep working. Shared
// infra knobs (PORT, DB_PATH, WORKSPACE_DIR) conventionally stay bare — the
// prefixed form simply wins when both are set.
function raw(name: string): string | undefined {
    const prefixed = process.env[`TASKFORGE_${name}`]
    if (prefixed !== undefined && prefixed.trim() !== '') return prefixed
    return process.env[name]
}

function required(name: string): string {
    const value = raw(name)
    if (!value || value.trim() === '') {
        // During `next build` the module graph is imported for tracing; env is
        // not yet provided. Defer the failure to runtime (fail-fast at boot /
        // first request) rather than breaking the build.
        if (process.env.NEXT_PHASE === 'phase-production-build') return ''
        throw new Error(
            `[taskforge] Missing required environment variable: TASKFORGE_${name} (or ${name}). ` +
                `See .env.example for the full list.`,
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
            `[taskforge] ${name} must be at least ${minLen} characters (got ${value.length}). ` +
                `Use a long random string, e.g. \`openssl rand -hex 32\`.`,
        )
    }
    return value
}

function optional(name: string, fallback: string): string {
    const value = raw(name)
    return value && value.trim() !== '' ? value : fallback
}

function num(name: string, fallback: number): number {
    const value = raw(name)
    if (!value || value.trim() === '') return fallback
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

function bool(name: string, fallback: boolean): boolean {
    const value = raw(name)
    if (value === undefined || value.trim() === '') return fallback
    return value === '1' || value.toLowerCase() === 'true'
}

function csv(name: string): string[] {
    const value = raw(name)
    if (!value) return []
    return value.split(',').flatMap((s) => {
        const trimmed = s.trim()
        return trimmed ? [trimmed] : []
    })
}

export const config = {
    // ── auth ──
    githubClientId: required('GITHUB_CLIENT_ID'),
    githubClientSecret: required('GITHUB_CLIENT_SECRET'),
    oauthRedirectUri: required('OAUTH_REDIRECT_URI'),
    // Public-facing origin (scheme + host[:port]) the browser actually talks to.
    // Behind a reverse proxy, `req.url` reflects the internal listen address
    // (e.g. http://0.0.0.0:3000), so app-relative redirects built from it leak
    // that internal host to the browser. The OAuth redirect URI is the
    // authoritative public URL (GitHub redirects the browser there), so derive
    // the origin from it. Override with PUBLIC_ORIGIN if they differ.
    get publicOrigin(): string {
        const explicit = raw('PUBLIC_ORIGIN')
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

    // ── agent ──
    // No API key here: the `claude` CLI/daemon authenticates itself (e.g. via
    // `claude login` / its own stored credentials). We only spawn the binary.
    // (E4: the half-implemented `cursor` backend stub was removed — `claude`
    //  is the one supported backend; a second one needs a real AgentBackend seam.)
    agentBin: raw('CLAUDE_BIN') || raw('AGENT_BIN') || 'claude',
    // Fallback account alias when a task/project specifies none (multi-account
    // registry). Empty = no default; the parent process's inherited identity is
    // used (current single-account behavior).
    defaultAccount: optional('DEFAULT_ACCOUNT', ''),
    defaultModel: optional('DEFAULT_MODEL', 'claude-sonnet-4-6'),
    modelCatalog: (() => {
        const list = csv('MODEL_CATALOG')
        return list.length
            ? list
            : ['fast', 'mid', 'deep', 'claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-8']
    })(),
    agentExtraArgs: optional(
        'AGENT_EXTRA_ARGS',
        '--print --output-format=stream-json --verbose --permission-mode acceptEdits',
    ),

    // ── workspace ──
    workspaceDir: optional('WORKSPACE_DIR', '/workspace'),
    // Each project is a self-contained folder under `projects/<name>` holding
    // `repo/` (the clone, and git cwd), `tasks/`, `knowledge/`, a root CLAUDE.md
    // and a `.claude/skills` symlink. The agent always runs at the project root.
    get projectsDir() {
        return `${this.workspaceDir}/projects`
    },
    /**
     * Root of the per-alias Claude config dirs (multi-account registry). Each
     * account gets an isolated `CLAUDE_CONFIG_DIR` at `${accountsDir}/<alias>`.
     */
    get accountsDir() {
        return `${this.workspaceDir}/.claude-accounts`
    },
    /**
     * Root of the saved git SSH keys (deploy keys). Each key is one owner-only
     * (`0600`) file at `${gitKeysDir}/<alias>`; the dir also holds the
     * app-managed `known_hosts`. Key material never enters the database.
     */
    get gitKeysDir() {
        return `${this.workspaceDir}/.git-ssh-keys`
    },
    /** SQLite database file — system of record for app state (see server/db.ts). */
    get dbPath() {
        const explicit = raw('DB_PATH')
        return explicit && explicit.trim() !== '' ? explicit.trim() : `${this.workspaceDir}/taskforge.db`
    },
    skillsDir: optional('SKILLS_DIR', optional('WORKSPACE_DIR', '/workspace') + '/skills'),
    /** Bundled, read-only app-level skills shipped in the image. */
    appSkillsDir: optional('APP_SKILLS_DIR', process.cwd() + '/skills'),

    // ── limit handling ──
    limitAutoSleep: bool('LIMIT_AUTO_SLEEP', true),
    limitSleepBuffer: num('LIMIT_SLEEP_BUFFER', 60),
    limitSleepFallback: num('LIMIT_SLEEP_FALLBACK', 1800),
    limitSleepMax: num('LIMIT_SLEEP_MAX', 21600),
    limitMaxRetries: num('LIMIT_MAX_RETRIES', 5),

    // ── transient retry ──
    transientMaxRetries: num('TRANSIENT_MAX_RETRIES', 3),
    transientBaseDelay: num('TRANSIENT_BASE_DELAY', 10),

    // ── usage gate (pre-emptive pause before a task fails on the limit) ──
    // After each task settles, the engine runs `/usage` (local, no tokens); if any
    // bucket is at/above the threshold it pauses (SLEEPING) until usage drops.
    usageGateEnabled: bool('USAGE_GATE_ENABLED', true),
    usageGateThreshold: num('USAGE_GATE_THRESHOLD', 95), // percent
    /** Poll interval while paused waiting for usage to drop below the threshold. */
    usageGatePollSeconds: num('USAGE_GATE_POLL_SECONDS', 1800),

    // ── warm session ──
    warmSession: bool('WARM_SESSION', false),
    warmSessionMaxAge: num('WARM_SESSION_MAX_AGE', 14400),

    // ── process / generate ──
    forceKillGraceMs: num('FORCE_KILL_GRACE_MS', 5000),
    /** One-shot agent runs (task generation, /usage refresh). 0 = no timeout. */
    generateTimeoutMs: num('GENERATE_TIMEOUT_MS', 120000),

    // ── knowledge docs ──
    /** Regenerate/update the repo's knowledge/ docs after each completed task. */
    knowledgeAutoUpdate: bool('KNOWLEDGE_AUTO_UPDATE', true),
    /** 0 = no timeout. */
    knowledgeTimeoutMs: num('KNOWLEDGE_TIMEOUT_MS', 300000),

    // ── commit / git ──
    commitAfterTask: bool('COMMIT_AFTER_TASK', false),
    commitMessageMode: optional('COMMIT_MESSAGE_MODE', 'taskname') as 'taskname' | 'ai',
    commitModel: optional('COMMIT_MODEL', 'claude-haiku-4-5'),
    gitAuthorName: optional('GIT_AUTHOR_NAME', 'taskforge'),
    gitAuthorEmail: optional('GIT_AUTHOR_EMAIL', 'bot@taskforge.local'),
    gitRemoteToken: optional('GIT_REMOTE_TOKEN', ''),
    // Git op timeouts so a hung command (stuck index.lock, dead/black-hole
    // remote) can't wedge a run forever. Local ops are fast; remote ops (clone /
    // fetch / pull / push) get a generous budget for large repos. 0 = no timeout.
    gitTimeoutMs: num('GIT_TIMEOUT_MS', 120000),
    gitRemoteTimeoutMs: num('GIT_REMOTE_TIMEOUT_MS', 600000),

    // ── logs / notify ──
    logRetentionHours: num('LOG_RETENTION_HOURS', 168),
    slackWebhookUrl: optional('SLACK_WEBHOOK_URL', ''),
    // D2 — events that fire notifications (CSV of run:completed,run:errored,
    // task:error,limit,agent:done) + a generic outbound JSON webhook. Both can
    // be overridden per project (E1 settings).
    notifyEvents: csv('NOTIFY_EVENTS'),
    notifyWebhookUrl: optional('NOTIFY_WEBHOOK_URL', ''),

    // ── B8 reviewer ──
    reviewModel: optional('REVIEW_MODEL', 'claude-haiku-4-5'),
    /** 0 = no timeout. */
    reviewTimeoutMs: num('REVIEW_TIMEOUT_MS', 120000),

    port: num('PORT', 3000),
}

export type Config = typeof config

/** Whether `git push` is possible with the configured credentials. */
export function canPush(): boolean {
    // HTTPS token OR a mounted SSH key (we can't reliably detect the key file
    // here, so token presence is the explicit signal; SSH users can override).
    return config.gitRemoteToken !== '' || raw('GIT_SSH_CONFIGURED') === '1'
}
